// Session list summaries (sidebar/list-screen source), independent of any
// one runtime connection — populated from REST (`session.list` or similar,
// M07) and nudged by the reducer's `refreshSessions` effect. Title updates
// that arrive live (session.info's `session.title` handling) land on the
// per-session record in session-states.ts instead — this list is expected to
// catch up on the next refresh, matching the desktop's own `$sessions` vs.
// `$sessionStates` split.

import { atom } from 'nanostores'

export interface SessionSummary {
  storedSessionId: string
  title: string
  updatedAt: number
}

export const $sessions = atom<SessionSummary[]>([])

export function setSessions(sessions: SessionSummary[]): void {
  $sessions.set(sessions)
}

/** D27: sign-out's own clear (session-connection.ts) — the cached list
 *  belongs to the connection that just signed out; nothing in it is safe to
 *  keep showing once the socket is gone. */
export function clearSessions(): void {
  $sessions.set([])
}

export function upsertSessionSummary(summary: SessionSummary): void {
  const current = $sessions.get()
  const index = current.findIndex(session => session.storedSessionId === summary.storedSessionId)

  if (index === -1) {
    $sessions.set([...current, summary])

    return
  }

  const next = [...current]
  next[index] = summary
  $sessions.set(next)
}

/**
 * M07: the reducer's `refreshSessions` effect (sessions.changed,
 * session.reclaimed, a replay-epoch cold start) fires while the session list
 * screen may already be mounted and visible, so a fetch-on-mount alone would
 * miss it. A bare counter rather than owning the fetch here: this module has
 * no REST client (src/api/sessions.ts, above session-connection.ts in the
 * dependency graph) and the list screen already knows how to fetch — it just
 * needs telling *when*.
 */
export const $sessionListRefreshRequests = atom(0)

export function requestSessionListRefresh(): void {
  $sessionListRefreshRequests.set($sessionListRefreshRequests.get() + 1)
}
