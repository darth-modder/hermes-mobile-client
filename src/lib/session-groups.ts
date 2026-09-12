// M14: docs/mobile-prototypes/sessions.html groups the list the way the
// desktop sidebar does — pinned first under its own label, then date
// dividers ("Earlier today", "Yesterday", …) — not tagged `Field:`, so this
// is parity, not a new addition. Pure so the bucketing can be tested without
// pulling in React Native.
import type { SessionInfo } from '../upstream/types/hermes'

export interface SessionGroup {
  label: string
  sessions: SessionInfo[]
}

function startOfDay(epochMs: number): number {
  const date = new Date(epochMs)

  date.setHours(0, 0, 0, 0)

  return date.getTime()
}

/** "Earlier today" / "Yesterday" / a short weekday, or the date beyond a
 *  week — the desktop's own date-divider granularity (sessions-sidebar.html). */
function dayLabel(epochSeconds: number, now: number): string {
  const dayMs = 86_400_000
  const diffDays = Math.round((startOfDay(now) - startOfDay(epochSeconds * 1000)) / dayMs)

  if (diffDays <= 0) {
    return 'Earlier today'
  }

  if (diffDays === 1) {
    return 'Yesterday'
  }

  if (diffDays < 7) {
    return new Date(epochSeconds * 1000).toLocaleDateString(undefined, { weekday: 'long' })
  }

  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Pinned first (its own group, already sorted by the caller), then the
 *  rest bucketed by day, most recent day first, preserving each session's
 *  incoming order within a bucket. */
export function groupSessions(sessions: readonly SessionInfo[], now: number = Date.now()): SessionGroup[] {
  const pinned = sessions.filter(session => session.pinned)
  const rest = sessions.filter(session => !session.pinned)

  const groups: SessionGroup[] = []

  if (pinned.length > 0) {
    groups.push({ label: 'Pinned', sessions: pinned })
  }

  for (const session of rest) {
    const label = dayLabel(session.last_active, now)
    const existing = groups.at(-1)?.label === label ? groups.at(-1) : undefined

    if (existing) {
      existing.sessions.push(session)
    } else {
      groups.push({ label, sessions: [session] })
    }
  }

  return groups
}
