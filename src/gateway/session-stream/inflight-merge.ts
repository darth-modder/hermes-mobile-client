// D31 point 6 / D32: session.resume's `inflight` snapshot is the assistant
// text already streamed for a turn that's still running when this client
// reattaches. Without merging it in, a mid-turn resume shows the user's
// message and nothing of the reply so far — the transcript "blanks" the
// current exchange until the next live delta happens to arrive, which is
// the release-build symptom this exists to fix.
//
// Scope cut (explicit, not silent — see the fix/reconcile-and-notifications
// branch history for the plan this was reviewed against):
//   - Only `inflight.streaming === true`, with no `error`/`error_surface`
//     and no `corrections`. A retained FAILED turn (error/error_surface
//     present) is a different case — a turn that already ended, not one
//     still running — and should route through the existing
//     applyFailAssistantMessage path (message-stream.ts, already built for
//     the live failed-turn-retained scenario) in a follow-up, not through
//     this function. Left exactly as today (no card, no error shown) until
//     that's built, rather than half-rendering it wrong.
//   - `corrections`/`correction_offsets` (mid-turn redirects, interleaved at
//     specific text offsets into `assistant`) are also a follow-up — naively
//     appending `assistant` alone would place a correction bubble in the
//     wrong spot instead of where the reader typed it.
//   - Only wired into the full resumeSession() path. The light reconcile
//     (session-connection.ts's reconcileSession, the socket-survived
//     trigger) explicitly never touches messages at all.
//
// Safe to plain-append, verified against the server rather than assumed:
// this app never calls session.events.since (event_replay.py's opt-in
// replay RPC — grepped, no caller anywhere in src/ or app/), so a
// reattaching client is never resent delta text already captured in this
// snapshot. And `_live_session_payload` (tui_gateway/server.py) takes the
// inflight snapshot and binds the new transport inside the SAME
// `history_lock`, so no delta can be emitted in the gap between the
// snapshot and this client attaching — confirmed by reading both sides, not
// assumed from either alone.

import { assistantTextPart } from '../../upstream/lib/chat-messages'
import type { SessionResumeResponse } from '../../upstream/types/hermes'

import { nextStreamMessageId } from './ids'
import { updateSession } from './session-keys'
import type { ReducerState } from './types'

export function mergeInflightIntoMessages(
  state: ReducerState,
  storedSessionId: string,
  inflight: SessionResumeResponse['inflight']
): ReducerState {
  if (!inflight || !inflight.streaming || inflight.error || inflight.error_surface) {
    return state
  }

  const text = typeof inflight.assistant === 'string' ? inflight.assistant : ''

  if (!text) {
    return state
  }

  return updateSession(state, storedSessionId, session => {
    // Already has a live streaming row (shouldn't happen on a fresh resume,
    // but never overwrite or duplicate one if it somehow does).
    if (session.streamId && session.messages.some(message => message.id === session.streamId)) {
      return session
    }

    const streamId = nextStreamMessageId('assistant-stream')
    const timestamp = Date.now() / 1000

    return {
      ...session,
      messages: [
        ...session.messages,
        { id: streamId, parts: [assistantTextPart(text, timestamp)], pending: true, role: 'assistant', timestamp }
      ],
      streamId
    }
  }).state
}
