// Session-key bookkeeping for ReducerState: resolving a wire-level (runtime)
// session id to the stored id the rest of the app keys everything by, and
// rebinding that mapping — without ever dropping the transcript already
// collected under it — when the backend tells us the stored id (session.info)
// or reclaims the runtime out from under us (session.reclaimed, decision D2
// in project-planning/DECISIONS.md).

import { createSessionState, type ReducerState, type SessionState } from './types'

/**
 * The stored id a runtime id currently resolves to. Until the backend has
 * told us (via `session.info.stored_session_id` or `session.reclaimed`), the
 * runtime id is used as its own placeholder key — this is what lets
 * `message.start` and friends update session state the instant a fresh
 * `session.create` starts streaming, well before the first `session.info`
 * lands.
 */
export function resolveStoredSessionId(state: ReducerState, runtimeSessionId: string): string {
  return state.runtimeToStored.get(runtimeSessionId) ?? runtimeSessionId
}

/** Functional update of one session's state, keyed by stored id. Creates the
 *  entry (via `createSessionState`) if it doesn't exist yet. */
export function updateSession(
  state: ReducerState,
  storedSessionId: string,
  updater: (session: SessionState) => SessionState
): { state: ReducerState; session: SessionState } {
  const current = state.sessions.get(storedSessionId) ?? createSessionState(storedSessionId)
  const next = updater(current)

  if (next === current) {
    return { state, session: current }
  }

  const sessions = new Map(state.sessions)
  sessions.set(storedSessionId, next)

  return { state: { ...state, sessions }, session: next }
}

/**
 * Point `runtimeSessionId` at `storedSessionId`, carrying over whatever
 * transcript/turn state was already accumulated under the runtime id's own
 * placeholder key — never dropping it (D2). If `storedSessionId` already has
 * its own entry (e.g. this stored session was hydrated from history before
 * any runtime bound to it), that entry's `messages` wins — the placeholder
 * can only have live-turn state, never durable history — but every other
 * live field (busy, streamId, turnStartedAt, ...) still moves over, because
 * the placeholder is the more recent truth for those.
 *
 * A no-op when the mapping already points there.
 */
export function rebindSessionKey(state: ReducerState, runtimeSessionId: string, storedSessionId: string): ReducerState {
  if (state.runtimeToStored.get(runtimeSessionId) === storedSessionId) {
    return state
  }

  const placeholderKey = resolveStoredSessionId(state, runtimeSessionId)
  const sessions = new Map(state.sessions)
  const runtimeToStored = new Map(state.runtimeToStored)

  if (placeholderKey !== storedSessionId) {
    const placeholderSession = sessions.get(placeholderKey)

    // No live state exists for this runtime id (a reclaim for a session this
    // client never opened — a background broadcast, or one from a prior
    // connection). Nothing to carry over: just record the mapping below,
    // without materializing an empty session entry for a conversation we
    // have never touched.
    if (placeholderSession) {
      sessions.delete(placeholderKey)

      const existingTarget = sessions.get(storedSessionId)

      sessions.set(storedSessionId, {
        ...placeholderSession,
        storedSessionId,
        messages:
          existingTarget && existingTarget.messages.length > 0 ? existingTarget.messages : placeholderSession.messages,
        title: existingTarget?.title || placeholderSession.title
      })
    }
  }

  runtimeToStored.set(runtimeSessionId, storedSessionId)

  return { ...state, sessions, runtimeToStored }
}

/** Called by the connection layer right after `session.create`/`session.resume`
 *  resolves, before any gateway event for it has arrived — establishes the
 *  runtime<->stored mapping up front and (unless told otherwise) makes this
 *  the active session. */
export function bindSession(
  state: ReducerState,
  runtimeSessionId: string,
  storedSessionId: string,
  options: { makeActive?: boolean } = {}
): ReducerState {
  const next = rebindSessionKey(state, runtimeSessionId, storedSessionId)

  return options.makeActive === false ? next : { ...next, activeRuntimeSessionId: runtimeSessionId }
}

/** Switch which runtime session is "on screen" — drives every `isActiveEvent`
 *  gate in the family handlers. */
export function setActiveSession(state: ReducerState, runtimeSessionId: string | null): ReducerState {
  return state.activeRuntimeSessionId === runtimeSessionId
    ? state
    : { ...state, activeRuntimeSessionId: runtimeSessionId }
}
