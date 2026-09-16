import { describe, expect, it } from 'vitest'

import { formatRunTimestamp } from './task-format'

// Fixed "now" so the same-day branch is exercised deterministically rather
// than depending on when the suite runs.
const NOW = new Date(2026, 8, 16, 15, 0, 0) // 16 Sep 2026, 3:00 PM local

describe('formatRunTimestamp', () => {
  it.each([null, undefined, ''])('renders %j as an em dash', value => {
    expect(formatRunTimestamp(value, NOW)).toBe('—')
  })

  it('echoes an unparseable string rather than rendering Invalid Date', () => {
    expect(formatRunTimestamp('not a date', NOW)).toBe('not a date')
  })

  it('formats a different-day ISO timestamp as the prototype does', () => {
    expect(formatRunTimestamp(new Date(2026, 8, 13, 9, 0, 0).toISOString(), NOW)).toBe('Sep 13, 2026, 9:00 AM')
  })

  it('shortens a same-day timestamp to "today <time>"', () => {
    expect(formatRunTimestamp(new Date(2026, 8, 16, 9, 0, 0).toISOString(), NOW)).toBe('today 9:00 AM')
  })

  it.each([
    [new Date(2026, 8, 13, 0, 0, 0), 'Sep 13, 2026, 12:00 AM'],
    [new Date(2026, 8, 13, 12, 5, 0), 'Sep 13, 2026, 12:05 PM'],
    [new Date(2026, 8, 13, 23, 30, 0), 'Sep 13, 2026, 11:30 PM']
  ])('formats midnight/noon/evening correctly (%s)', (date, expected) => {
    expect(formatRunTimestamp(date.toISOString(), NOW)).toBe(expected)
  })

  // A run row is a SessionInfo, whose `started_at` is float epoch SECONDS
  // (src/upstream/types/hermes.ts:543) — the same seconds-vs-ms split
  // src/lib/artifacts.ts:194-200 applies.
  it('reads a float epoch-seconds value as seconds', () => {
    const seconds = new Date(2026, 8, 13, 9, 0, 0).getTime() / 1000

    expect(formatRunTimestamp(seconds, NOW)).toBe('Sep 13, 2026, 9:00 AM')
  })

  it('reads an epoch-milliseconds value as milliseconds', () => {
    const ms = new Date(2026, 8, 13, 9, 0, 0).getTime()

    expect(formatRunTimestamp(ms, NOW)).toBe('Sep 13, 2026, 9:00 AM')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('renders the non-timestamp %j as an em dash', value => {
    expect(formatRunTimestamp(value, NOW)).toBe('—')
  })
})
