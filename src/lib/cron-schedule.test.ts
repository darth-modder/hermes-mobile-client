import { describe, expect, it } from 'vitest'

import {
  cronParts,
  describeCronExpr,
  formatCronTime,
  scheduleExpr,
  scheduleKindForExpr,
  scheduleWords
} from './cron-schedule'

describe('cronParts', () => {
  it('accepts a 5-field expression and collapses runs of whitespace', () => {
    expect(cronParts('  0   9 * * *  ')).toEqual(['0', '9', '*', '*', '*'])
  })

  it.each(['0 9 * *', '0 9 * * * *', '', 'every 30m'])('rejects %j as not a 5-field expression', expr => {
    expect(cronParts(expr)).toBeNull()
  })
})

describe('formatCronTime', () => {
  it.each([
    ['0', '9', '9:00 AM'],
    ['30', '14', '2:30 PM'],
    ['0', '0', '12:00 AM'],
    ['5', '12', '12:05 PM'],
    ['0', '23', '11:00 PM']
  ])('formats minute %s hour %s as %s', (minute, hour, expected) => {
    expect(formatCronTime(minute, hour)).toBe(expected)
  })

  // The desktop's own guard (index.tsx:165-167) — a non-integer token falls
  // through to the raw `hour:minute` pair rather than rendering NaN.
  it.each([
    ['0', '*', '*:0'],
    ['*/15', '*', '*:*/15'],
    ['0', '99', '99:0']
  ])('falls back to the raw pair for minute %j hour %j', (minute, hour, expected) => {
    expect(formatCronTime(minute, hour)).toBe(expected)
  })
})

describe('scheduleKindForExpr', () => {
  it.each([
    ['0 9 * * *', 'daily'],
    ['0 9 * * 1-5', 'weekdays'],
    ['0 9 * * 1', 'weekly'],
    ['0 9 1 * *', 'monthly'],
    ['0 * * * *', 'hourly'],
    ['*/15 * * * *', 'every-15-minutes']
  ])('matches the preset %s exactly as %s', (expr, kind) => {
    expect(scheduleKindForExpr(expr)).toBe(kind)
  })

  it.each([
    ['30 7 * * *', 'daily'],
    ['15 6 * * 1-5', 'weekdays'],
    ['0 18 * * 5', 'weekly'],
    ['0 6 15 * *', 'monthly'],
    ['20 * * * *', 'hourly']
  ])('classifies the non-preset %s as %s', (expr, kind) => {
    expect(scheduleKindForExpr(expr)).toBe(kind)
  })

  it.each(['*/7 * * * *', '0 9 * 3 *', '0 9 1-5 * 2', 'every 30m', 'nonsense'])('leaves %j as custom', expr => {
    expect(scheduleKindForExpr(expr)).toBe('custom')
  })
})

describe('describeCronExpr', () => {
  it.each([
    ['0 9 * * *', 'Every day at 9:00 AM'],
    ['30 7 * * *', 'Every day at 7:30 AM'],
    ['0 9 * * 1-5', 'Weekdays at 9:00 AM'],
    ['0 9 * * 1', 'Every Monday at 9:00 AM'],
    ['0 18 * * 5', 'Every Friday at 6:00 PM'],
    ['0 9 1 * *', 'Monthly on day 1 at 9:00 AM'],
    ['0 * * * *', 'At the top of every hour'],
    ['20 * * * *', 'Every hour at :20'],
    ['*/15 * * * *', 'Every 15 minutes']
  ])('describes %s as %j', (expr, expected) => {
    expect(describeCronExpr(expr)).toBe(expected)
  })

  // The brief's rule: anything it cannot describe returns null so the caller
  // shows the raw expression rather than a wrong sentence.
  it.each(['*/7 * * * *', '0 9 * 3 *', 'every 30m', '0 9 * *', ''])('returns null for %j', expr => {
    expect(describeCronExpr(expr)).toBeNull()
  })

  // Sunday is both 0 and 7 in cron; en.ts `cron.days` maps both.
  it('names both cron spellings of Sunday', () => {
    expect(describeCronExpr('0 9 * * 0')).toBe('Every Sunday at 9:00 AM')
    expect(describeCronExpr('0 9 * * 7')).toBe('Every Sunday at 9:00 AM')
  })
})

describe('scheduleWords', () => {
  // The host stores the typed string as `display` for cron
  // (cron/jobs.py:716-726), so `schedule_display` IS the expression here and
  // must be humanized rather than shown as-is.
  it('humanizes a schedule_display that is really a cron expression', () => {
    expect(scheduleWords({ schedule: { expr: '0 9 * * *' }, schedule_display: '0 9 * * *' })).toBe(
      'Every day at 9:00 AM'
    )
  })

  // An interval already has a host-written sentence (cron/jobs.py:729-730).
  it('passes an interval sentence through untouched', () => {
    expect(scheduleWords({ schedule: { kind: 'interval' }, schedule_display: 'every 30m' } as never)).toBe('every 30m')
  })

  it('passes a one-shot sentence through untouched', () => {
    expect(scheduleWords({ schedule_display: 'once at 2026-02-03 14:00' })).toBe('once at 2026-02-03 14:00')
  })

  it('falls back to schedule.expr when schedule_display is empty', () => {
    expect(scheduleWords({ schedule: { expr: '0 9 * * 1' }, schedule_display: null })).toBe('Every Monday at 9:00 AM')
  })

  it('returns null when nothing describable is present', () => {
    expect(scheduleWords({})).toBeNull()
    expect(scheduleWords({ schedule: { expr: '*/7 * * * *' } })).toBeNull()
  })
})

describe('scheduleExpr', () => {
  it('prefers schedule.expr, then schedule_display, then an em dash', () => {
    expect(scheduleExpr({ schedule: { expr: '0 9 * * *' }, schedule_display: 'ignored' })).toBe('0 9 * * *')
    expect(scheduleExpr({ schedule_display: 'every 30m' })).toBe('every 30m')
    expect(scheduleExpr({})).toBe('—')
  })
})
