import { describe, expect, it } from 'vitest'

import {
  AUTO_SEND_GRACE_MS,
  type DictationEvent,
  type DictationState,
  HOLD_AUTO_SEND_MS,
  initialDictationState,
  isCapturing,
  reduceDictation,
  showsAutoSendState,
  showsEditEscape
} from './hold-to-dictate'

/** Runs a script of events from `idle`, returning the final state and every effect in order. */
function run(events: DictationEvent[], from: DictationState = initialDictationState) {
  const effects: string[] = []
  let state = from

  for (const event of events) {
    const { effect, next } = reduceDictation(state, event)

    effects.push(effect)
    state = next
  }

  return { effects, state }
}

describe('hold-to-dictate threshold', () => {
  it('is the 2.5 s D16.3 tuning', () => {
    expect(HOLD_AUTO_SEND_MS).toBe(2500)
  })

  it('a press from idle starts recording and holds', () => {
    const { effects, state } = run([{ at: 0, type: 'press' }])

    expect(effects).toEqual(['start-recording'])
    expect(state.phase).toBe('holding')
    expect(isCapturing(state)).toBe(true)
  })

  it('crossing the threshold arms the auto-send with a haptic', () => {
    const { effects, state } = run([{ at: 0, type: 'press' }, { type: 'threshold' }])

    expect(effects).toEqual(['start-recording', 'haptic-armed'])
    expect(state.phase).toBe('armed')
    expect(showsAutoSendState(state)).toBe(true)
    // Nothing is in the composer yet, so there is nothing to edit.
    expect(showsEditEscape(state)).toBe(false)
  })

  it('a threshold that fires when the finger is already up is ignored', () => {
    const { effects, state } = run([{ at: 0, type: 'press' }, { at: 100, type: 'release' }, { type: 'threshold' }])

    expect(effects).toEqual(['start-recording', 'none', 'none'])
    expect(state.phase).toBe('recording')
  })
})

describe('release', () => {
  it('a tap from idle leaves the recorder running — M11’s toggle, unchanged', () => {
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { at: 120, type: 'release' }
    ])

    expect(effects).toEqual(['start-recording', 'none'])
    expect(state.phase).toBe('recording')
    expect(isCapturing(state)).toBe(true)
  })

  it('a second tap stops and fills the composer, sending nothing', () => {
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { at: 120, type: 'release' },
      { at: 900, type: 'press' },
      { at: 1000, type: 'release' }
    ])

    expect(effects).toEqual(['start-recording', 'none', 'none', 'stop-and-fill'])
    expect(state).toEqual(initialDictationState)
  })

  it('a release at exactly the threshold auto-sends', () => {
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { type: 'threshold' },
      { at: HOLD_AUTO_SEND_MS, type: 'release' }
    ])

    expect(effects).toEqual(['start-recording', 'haptic-armed', 'stop-and-queue'])
    expect(state.phase).toBe('pending')
  })

  it('a release one millisecond short of the threshold does not', () => {
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { at: HOLD_AUTO_SEND_MS - 1, type: 'release' }
    ])

    expect(effects).toEqual(['start-recording', 'none'])
    expect(state.phase).toBe('recording')
  })

  it('a long enough release auto-sends even if the threshold timer never fired', () => {
    // A starved JS thread mid-stream is the ordinary case, not a hypothetical:
    // release measures the hold itself rather than trusting the timer.
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { at: 4000, type: 'release' }
    ])

    expect(effects).toEqual(['start-recording', 'stop-and-queue'])
    expect(state.phase).toBe('pending')
  })

  it('holding past the threshold while already toggle-recording still auto-sends', () => {
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { at: 120, type: 'release' },
      { at: 500, type: 'press' },
      { at: 500 + HOLD_AUTO_SEND_MS, type: 'release' }
    ])

    // No second 'start-recording': the recorder was already running.
    expect(effects).toEqual(['start-recording', 'none', 'none', 'stop-and-queue'])
    expect(state.phase).toBe('pending')
  })
})

describe('the queued send and its escape', () => {
  const held: DictationEvent[] = [
    { at: 0, type: 'press' },
    { type: 'threshold' },
    { at: HOLD_AUTO_SEND_MS, type: 'release' }
  ]

  it('the grace window is 1.5 s', () => {
    expect(AUTO_SEND_GRACE_MS).toBe(1500)
  })

  it('offers the escape while the transcript sits in the composer', () => {
    const { state } = run(held)

    expect(showsAutoSendState(state)).toBe(true)
    expect(showsEditEscape(state)).toBe(true)
  })

  it('sends when the grace window closes untouched', () => {
    const { effects, state } = run([...held, { type: 'grace-elapsed' }])

    expect(effects.at(-1)).toBe('send')
    expect(state).toEqual(initialDictationState)
  })

  it('the escape cancels the send and keeps the text', () => {
    const { effects, state } = run([...held, { type: 'escape' }])

    expect(effects.at(-1)).toBe('cancel-send')
    expect(state).toEqual(initialDictationState)
  })

  it('a grace timer that fires after the escape does nothing', () => {
    // The timer is not cancellable from the reducer, so this is the guard
    // that stops an escaped transcript flying anyway.
    const { effects, state } = run([...held, { type: 'escape' }, { type: 'grace-elapsed' }])

    expect(effects.slice(-2)).toEqual(['cancel-send', 'none'])
    expect(state).toEqual(initialDictationState)
  })

  it('an empty transcript never auto-sends', () => {
    // M11 saw exactly this on the emulator: silence in, empty transcript out.
    const { effects, state } = run([...held, { type: 'transcript-empty' }])

    expect(effects.at(-1)).toBe('cancel-send')
    expect(state).toEqual(initialDictationState)
  })

  it('reaching for the mic again cancels the queued send rather than racing it', () => {
    const { effects, state } = run([...held, { at: 9000, type: 'press' }])

    expect(effects.at(-1)).toBe('cancel-send')
    expect(state.phase).toBe('holding')
  })

  it('a second escape is a no-op', () => {
    const { effects } = run([...held, { type: 'escape' }, { type: 'escape' }])

    expect(effects.slice(-2)).toEqual(['cancel-send', 'none'])
  })
})

describe('cancel', () => {
  it('abandons an in-progress hold without inserting anything', () => {
    const { effects, state } = run([{ at: 0, type: 'press' }, { type: 'cancel' }])

    expect(effects.at(-1)).toBe('abandon')
    expect(state).toEqual(initialDictationState)
  })

  it('abandons an armed hold', () => {
    const { effects } = run([{ at: 0, type: 'press' }, { type: 'threshold' }, { type: 'cancel' }])

    expect(effects.at(-1)).toBe('abandon')
  })

  it('abandons a toggle recording left running', () => {
    const { effects } = run([{ at: 0, type: 'press' }, { at: 100, type: 'release' }, { type: 'cancel' }])

    expect(effects.at(-1)).toBe('abandon')
  })

  it('cancels a queued send rather than abandoning a recorder that already stopped', () => {
    const { effects } = run([
      { at: 0, type: 'press' },
      { type: 'threshold' },
      { at: HOLD_AUTO_SEND_MS, type: 'release' },
      { type: 'cancel' }
    ])

    expect(effects.at(-1)).toBe('cancel-send')
  })

  it('is a no-op from idle', () => {
    const { effects, state } = run([{ type: 'cancel' }])

    expect(effects).toEqual(['none'])
    expect(state).toEqual(initialDictationState)
  })
})

describe('out-of-phase events never move the machine', () => {
  it('ignores a release with no press', () => {
    expect(run([{ at: 10, type: 'release' }])).toEqual({ effects: ['none'], state: initialDictationState })
  })

  it('ignores grace, escape and empty-transcript from idle', () => {
    const { effects, state } = run([{ type: 'grace-elapsed' }, { type: 'escape' }, { type: 'transcript-empty' }])

    expect(effects).toEqual(['none', 'none', 'none'])
    expect(state).toEqual(initialDictationState)
  })

  it('ignores a second press while the finger is already down', () => {
    const { effects, state } = run([
      { at: 0, type: 'press' },
      { at: 50, type: 'press' }
    ])

    expect(effects).toEqual(['start-recording', 'none'])
    // The original press time survives, so the hold is still measured from it.
    expect(state.pressedAt).toBe(0)
  })
})
