/**
 * Hold-to-dictate (M15 B): tapping the mic keeps M11's toggle dictation
 * exactly as it was, and holding it past a threshold arms an auto-send that
 * fires when the finger lifts.
 *
 * Pure and reducer-shaped so the threshold, the release decision, the escape
 * and the cancel are all unit-testable without mounting `Composer`, running a
 * real recorder, or waiting 2.5 s of wall clock — the same reason
 * `latest-pill.ts` and `dictation-guard.ts` were split out of their
 * components.
 *
 * `Composer` owns the side effects (recording, transcription, haptics,
 * timers); this module only decides what should happen.
 */

/**
 * D16.3: "Three numeric tunings in M15 (a 2.5 s hold, an 88 px swipe commit,
 * a one-viewport follow window) are design choices restated from observation
 * of the product, not from its source." This is that 2.5 s hold — an
 * observed tuning, reimplemented, not copied.
 */
export const HOLD_AUTO_SEND_MS = 2500

/**
 * How long the queued send waits after the finger lifts, so "Edit before
 * sending" is reachable while the transcript is sitting in the composer and
 * still editable. Not one of D16.3's three observed tunings — this window is
 * this project's own, and exists only because the escape needs somewhere to
 * live.
 */
export const AUTO_SEND_GRACE_MS = 1500

export type DictationPhase =
  /** Not recording. */
  | 'idle'
  /** Recording, finger down. Whether the release auto-sends depends on how long it stays down. */
  | 'holding'
  /** Recording, finger down, past `HOLD_AUTO_SEND_MS` — the release will auto-send. */
  | 'armed'
  /** Recording, finger up. M11's toggle: the next tap stops and fills the composer. */
  | 'recording'
  /** Released while armed; the transcript is in the composer and the send is queued. */
  | 'pending'

export interface DictationState {
  phase: DictationPhase
  /** `press`'s timestamp, so `release` can measure the hold itself. */
  pressedAt: null | number
  /** Whether the press that started this hold landed on an already-running recording. */
  wasRecording: boolean
}

export const initialDictationState: DictationState = {
  phase: 'idle',
  pressedAt: null,
  wasRecording: false
}

export type DictationEvent =
  | { at: number; type: 'press' }
  | { at: number; type: 'release' }
  /** The `HOLD_AUTO_SEND_MS` timer fired while the finger was still down. */
  | { type: 'threshold' }
  /** Transcription of a queued (auto-send) recording came back with nothing usable. */
  | { type: 'transcript-empty' }
  /** "Edit before sending" — the user kept the text but cancelled the send. */
  | { type: 'escape' }
  /** `AUTO_SEND_GRACE_MS` elapsed with no escape. */
  | { type: 'grace-elapsed' }
  /** The composer is going away or switching sessions mid-recording. */
  | { type: 'cancel' }

export type DictationEffect =
  | 'none'
  /** Begin capturing. */
  | 'start-recording'
  /** Threshold crossed: haptic, and the "Auto-send" state becomes visible. */
  | 'haptic-armed'
  /** Stop, transcribe, insert into the composer. Nothing is sent. */
  | 'stop-and-fill'
  /** Stop, transcribe, insert into the composer, then send once the grace window closes. */
  | 'stop-and-queue'
  /** The grace window closed with no escape: send what is in the composer. */
  | 'send'
  /** The queued send is off. The transcript stays in the composer, editable. */
  | 'cancel-send'
  /** Stop recording and insert nothing. */
  | 'abandon'

export interface DictationTransition {
  effect: DictationEffect
  next: DictationState
}

const stay = (state: DictationState): DictationTransition => ({ effect: 'none', next: state })

/**
 * `release` measures the hold from `pressedAt` rather than trusting the
 * `threshold` event to have arrived. The timer only drives the *visible*
 * armed state and its haptic; a release that is late enough still auto-sends
 * even if the timer was starved (a slow JS thread mid-stream is the ordinary
 * case here, not a hypothetical).
 */
export function reduceDictation(state: DictationState, event: DictationEvent): DictationTransition {
  switch (event.type) {
    case 'press': {
      if (state.phase === 'holding' || state.phase === 'armed') {
        return stay(state)
      }

      const wasRecording = state.phase === 'recording'

      return {
        // A press during `pending` also interrupts the queued send — see
        // `cancel-send`: the user reaching for the mic again is not a user
        // who wants the previous transcript to fly.
        effect: state.phase === 'pending' ? 'cancel-send' : wasRecording ? 'none' : 'start-recording',
        next: { phase: 'holding', pressedAt: event.at, wasRecording }
      }
    }

    case 'threshold': {
      if (state.phase !== 'holding') {
        return stay(state)
      }

      return { effect: 'haptic-armed', next: { ...state, phase: 'armed' } }
    }

    case 'release': {
      if (state.phase !== 'holding' && state.phase !== 'armed') {
        return stay(state)
      }

      const heldMs = state.pressedAt === null ? 0 : event.at - state.pressedAt

      if (heldMs >= HOLD_AUTO_SEND_MS) {
        return { effect: 'stop-and-queue', next: { phase: 'pending', pressedAt: null, wasRecording: false } }
      }

      // Below the threshold this is a plain tap, and M11's toggle owns it:
      // the first tap leaves the recorder running, the second stops it and
      // fills the composer.
      if (state.wasRecording) {
        return { effect: 'stop-and-fill', next: initialDictationState }
      }

      return { effect: 'none', next: { phase: 'recording', pressedAt: null, wasRecording: false } }
    }

    case 'transcript-empty': {
      if (state.phase !== 'pending') {
        return stay(state)
      }

      // Silence must never auto-send an empty prompt — M11 saw exactly this
      // transcript on the emulator.
      return { effect: 'cancel-send', next: initialDictationState }
    }

    case 'escape': {
      if (state.phase !== 'pending') {
        return stay(state)
      }

      return { effect: 'cancel-send', next: initialDictationState }
    }

    case 'grace-elapsed': {
      // Ignored in every other phase, which is what makes the escape safe: a
      // grace timer that fires after the escape already moved us to `idle`
      // does nothing.
      if (state.phase !== 'pending') {
        return stay(state)
      }

      return { effect: 'send', next: initialDictationState }
    }

    case 'cancel': {
      if (state.phase === 'idle') {
        return stay(state)
      }

      return { effect: state.phase === 'pending' ? 'cancel-send' : 'abandon', next: initialDictationState }
    }

    default:
      return stay(state)
  }
}

/** The "Auto-send" state is visible from the moment the threshold is crossed
 *  until the send fires or is escaped. */
export function showsAutoSendState(state: DictationState): boolean {
  return state.phase === 'armed' || state.phase === 'pending'
}

/** The escape is only offered once the transcript is actually in the composer. */
export function showsEditEscape(state: DictationState): boolean {
  return state.phase === 'pending'
}

/** Whether the recorder should be running in this phase. */
export function isCapturing(state: DictationState): boolean {
  return state.phase === 'holding' || state.phase === 'armed' || state.phase === 'recording'
}
