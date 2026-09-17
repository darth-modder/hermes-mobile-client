/**
 * Schedule vocabulary for the Tasks tab (M15 C) — the "schedule in words"
 * half of a task row, the detail grid's SCHEDULE line, and the New task
 * sheet's plain-language echo.
 *
 * **Layers searched before writing anything here** (M14 Deviation 13's rule:
 * name the layer before calling something absent):
 *
 * 1. `src/upstream/` (vendored). No humanizer — but `src/upstream/i18n/en.ts`
 *    `cron.*` DOES carry the whole output vocabulary: `days`, `dayFallback`,
 *    `everyDayAt`, `weekdaysAt`, `everyDayOfWeekAt`, `monthlyOnDayAt`,
 *    `topOfHour`, `everyHourAt`, `scheduleHints`. Those strings exist because
 *    the desktop has a humanizer that feeds them.
 * 2. `apps/desktop/` — it does. `apps/desktop/src/app/cron/index.tsx`:
 *    `cronParts` (:151-155), `dayName` (:157-159), `formatCronTime`
 *    (:161-173), `isIntegerToken` (:175-177), `scheduleOptionForExpr`
 *    (:179-232) and `scheduleSummary` (:234-264), over `SCHEDULE_OPTIONS`
 *    (:101-109). This module is a port of those, not a new invention — which
 *    is why the branch order and the exact predicates below match theirs
 *    line for line.
 * 3. `node_modules/` — no `cronstrue` or equivalent is a dependency.
 * 4. The host (`../hermes-agent`, read-only). It deliberately does NOT
 *    humanize cron: `cron/jobs.py:716-726` (`_cron_schedule`) stores
 *    `{"kind": "cron", "expr": expr, "display": display}` where `display` is
 *    *the string the user typed*. So for `0 9 * * *` the server's
 *    `schedule_display` comes back as the literal `"0 9 * * *"`, never
 *    "Every day at 9:00 AM". Only intervals (`:729-730`, `"every 30m"`) and
 *    one-shots (`:778`, `:793`, `"once at …"`) get a sentence host-side.
 *
 * That last point is why this module is needed on the *list* too, not only in
 * the create sheet: round 10's research recorded "schedule in words is
 * server-provided", which is true for intervals and one-shots and false for
 * every cron expression. `scheduleWords` therefore prefers the server's own
 * sentence and only humanizes when what came back is a bare cron expression.
 *
 * Anything this cannot describe returns `null`, and every caller renders the
 * raw expression instead — a wrong sentence about when your job runs is worse
 * than the expression you typed.
 */
import { t } from './t'

/** The desktop's `SCHEDULE_OPTIONS` values (index.tsx:101-109). */
export type ScheduleKind = 'custom' | 'daily' | 'every-15-minutes' | 'hourly' | 'monthly' | 'weekdays' | 'weekly'

/** Port of `cronParts` (index.tsx:151-155) — 5 fields exactly, or not cron. */
export function cronParts(expr: string): null | string[] {
  const parts = expr.trim().replace(/\s+/g, ' ').split(' ')

  return parts.length === 5 ? parts : null
}

/** Port of `isIntegerToken` (index.tsx:175-177). */
function isIntegerToken(value: string): boolean {
  return /^\d+$/.test(value)
}

/**
 * Port of `formatCronTime` (index.tsx:161-173) with one deliberate change,
 * recorded as a Deviation in the M15 doc: the desktop calls
 * `toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})`,
 * which on Electron is Chromium's full ICU. Here the same call would make the
 * echo depend on the device locale and on whichever Intl the Hermes engine
 * was built with, so the sentence describing a *locale-independent* cron
 * expression would vary by phone — and the unit tests below would assert
 * whatever the CI box happened to be set to. This formats 12-hour
 * en-US-style directly, which is also exactly what the prototype draws
 * (`docs/mobile-prototypes/tasks.html:130`, "Every day at 9:00 AM").
 */
export function formatCronTime(minute: string, hour: string): string {
  const numericHour = Number(hour)
  const numericMinute = Number(minute)

  if (!isIntegerToken(hour) || !isIntegerToken(minute) || numericHour > 23 || numericMinute > 59) {
    return `${hour}:${minute}`
  }

  const suffix = numericHour < 12 ? 'AM' : 'PM'
  const twelve = numericHour % 12 === 0 ? 12 : numericHour % 12

  return `${twelve}:${String(numericMinute).padStart(2, '0')} ${suffix}`
}

/** Port of `dayName` (index.tsx:157-159). */
function dayName(value: string): string {
  const days: Record<string, string> = t.cron.days

  return days[value] ?? t.cron.dayFallback(value)
}

/**
 * Port of `scheduleOptionForExpr` (index.tsx:179-232), including its exact
 * branch order — `daily` before `weekdays` before `weekly` before `monthly`
 * before `hourly` — and its exact-match-first shortcut against
 * `SCHEDULE_OPTIONS`.
 */
export function scheduleKindForExpr(expr: string): ScheduleKind {
  const normalized = expr.trim().replace(/\s+/g, ' ')
  const exact = SCHEDULE_PRESETS.find(preset => preset.expr === normalized)

  if (exact) {
    return exact.kind
  }

  const parts = cronParts(normalized)

  if (!parts) {
    return 'custom'
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*' && isIntegerToken(minute) && isIntegerToken(hour)) {
    return 'daily'
  }

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5' && isIntegerToken(minute) && isIntegerToken(hour)) {
    return 'weekdays'
  }

  if (
    dayOfMonth === '*' &&
    month === '*' &&
    isIntegerToken(dayOfWeek) &&
    isIntegerToken(minute) &&
    isIntegerToken(hour)
  ) {
    return 'weekly'
  }

  if (
    month === '*' &&
    dayOfWeek === '*' &&
    isIntegerToken(dayOfMonth) &&
    isIntegerToken(minute) &&
    isIntegerToken(hour)
  ) {
    return 'monthly'
  }

  if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*' && isIntegerToken(minute)) {
    return 'hourly'
  }

  if (normalized === '*/15 * * * *') {
    return 'every-15-minutes'
  }

  return 'custom'
}

/**
 * Port of `scheduleSummary` (index.tsx:234-264) with one difference that the
 * round's brief calls for explicitly: where the desktop falls back to
 * `c.scheduleHints[option.value]` — for `custom` that is "Cron syntax or
 * natural language", which describes the *input format* rather than the
 * schedule — this returns `null` so the caller can show the raw expression.
 */
export function describeCronExpr(expr: string): null | string {
  const parts = cronParts(expr)

  if (!parts) {
    return null
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts
  const kind = scheduleKindForExpr(expr)

  if (kind === 'daily') {
    return t.cron.everyDayAt(formatCronTime(minute, hour))
  }

  if (kind === 'weekdays') {
    return t.cron.weekdaysAt(formatCronTime(minute, hour))
  }

  if (kind === 'weekly') {
    return t.cron.everyDayOfWeekAt(dayName(dayOfWeek), formatCronTime(minute, hour))
  }

  if (kind === 'monthly') {
    return t.cron.monthlyOnDayAt(dayOfMonth, formatCronTime(minute, hour))
  }

  if (kind === 'hourly') {
    return minute === '0' ? t.cron.topOfHour : t.cron.everyHourAt(minute.padStart(2, '0'))
  }

  if (kind === 'every-15-minutes') {
    return t.cron.scheduleLabels['every-15-minutes']
  }

  return null
}

/** The template presets the New task sheet offers, desktop values and exprs
 *  verbatim (`SCHEDULE_OPTIONS`, index.tsx:101-109). `custom` has no `expr`
 *  there and none here. */
export const SCHEDULE_PRESETS: ReadonlyArray<{ expr: string; kind: ScheduleKind }> = [
  { expr: '0 9 * * *', kind: 'daily' },
  { expr: '0 9 * * 1-5', kind: 'weekdays' },
  { expr: '0 9 * * 1', kind: 'weekly' },
  { expr: '0 9 1 * *', kind: 'monthly' },
  { expr: '0 * * * *', kind: 'hourly' },
  { expr: '*/15 * * * *', kind: 'every-15-minutes' }
]

/**
 * What a row/detail shows as "schedule in words".
 *
 * The desktop's own fallback chain for the raw side is
 * `jobScheduleDisplay` (index.tsx:130-133) —
 * `schedule_display || schedule?.display || schedule?.expr || '—'`. The
 * difference here is the cron case described in this module's header: when
 * that chain yields something that is itself a bare cron expression (which is
 * exactly what the host stores for `kind: "cron"`), it is not words at all,
 * so it gets humanized. An interval's `"every 30m"` or a one-shot's
 * `"once at 2026-02-03 14:00"` is already a sentence and passes through
 * untouched.
 */
export function scheduleWords(job: {
  schedule?: { display?: string; expr?: string }
  schedule_display?: null | string
}): null | string {
  const display = (job.schedule_display ?? '').trim() || (job.schedule?.display ?? '').trim()
  const expr = (job.schedule?.expr ?? '').trim()

  if (display && !cronParts(display)) {
    return display
  }

  return describeCronExpr(display || expr)
}

/** The raw expression to show beside the words — `jobScheduleExpr`
 *  (index.tsx:135-137): `schedule?.expr` first, then `schedule_display`. */
export function scheduleExpr(job: {
  schedule?: { display?: string; expr?: string }
  schedule_display?: null | string
}): string {
  return (job.schedule?.expr ?? '').trim() || (job.schedule_display ?? '').trim() || '—'
}
