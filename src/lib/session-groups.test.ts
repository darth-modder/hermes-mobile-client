import { describe, expect, it } from 'vitest'

import type { SessionInfo } from '../upstream/types/hermes'

import { groupSessions } from './session-groups'

function session(overrides: Partial<SessionInfo>): SessionInfo {
  return {
    ended_at: null,
    id: 'id',
    input_tokens: 0,
    last_active: 0,
    output_tokens: 0,
    pinned: false,
    started_at: 0,
    title: 'Untitled',
    unread: false,
    ...overrides
  } as SessionInfo
}

const NOW = new Date('2026-09-12T12:00:00Z').getTime()
const nowSeconds = NOW / 1000

describe('groupSessions', () => {
  it('puts pinned sessions in their own leading group regardless of date', () => {
    const groups = groupSessions(
      [
        session({ id: 'old-pinned', last_active: nowSeconds - 30 * 86_400, pinned: true }),
        session({ id: 'today', last_active: nowSeconds - 60 })
      ],
      NOW
    )

    expect(groups[0]).toEqual({ label: 'Pinned', sessions: [expect.objectContaining({ id: 'old-pinned' })] })
    expect(groups[1].label).toBe('Earlier today')
  })

  it('buckets by day: today, yesterday, then a weekday name inside a week', () => {
    const groups = groupSessions(
      [
        session({ id: 'a', last_active: nowSeconds - 60 }),
        session({ id: 'b', last_active: nowSeconds - 86_400 - 60 }),
        session({ id: 'c', last_active: nowSeconds - 3 * 86_400 })
      ],
      NOW
    )

    expect(groups.map(g => g.label)).toEqual(['Earlier today', 'Yesterday', expect.any(String)])
    expect(groups[2].label).not.toBe('Yesterday')
    expect(groups[2].label).not.toBe('Earlier today')
  })

  it('keeps consecutive same-day sessions in one group, in their incoming order', () => {
    const groups = groupSessions(
      [session({ id: 'first', last_active: nowSeconds - 10 }), session({ id: 'second', last_active: nowSeconds - 20 })],
      NOW
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].sessions.map(s => s.id)).toEqual(['first', 'second'])
  })

  it('returns no groups for an empty list', () => {
    expect(groupSessions([], NOW)).toEqual([])
  })
})
