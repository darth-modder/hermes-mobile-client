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
