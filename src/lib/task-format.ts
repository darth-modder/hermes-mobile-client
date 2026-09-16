/**
 * Run-timestamp formatting for the Tasks tab (M15 C).
 *
 * Port of `formatTime` (`apps/desktop/src/app/cron/index.tsx:266-278`) —
 * null/empty is an em dash, an unparseable string is echoed back rather than
 * rendered as "Invalid Date", and only a real date is formatted. The guard
 * order is theirs.
 *
 * The one change, recorded as a Deviation in the M15 doc alongside
 * `cron-schedule.ts`'s `formatCronTime`: the desktop ends in
 * `date.toLocaleString()`, Chromium's full-ICU default for the host locale.
 * Here that would render differently per device and per Hermes-engine Intl
 * build, and — unlike a cron expression, which is genuinely locale-free — a
 * timestamp column that silently changes shape between phones makes the
 * "next run / last run" pair hard to scan and impossible to assert in a
 * test. This formats the prototype's own shape instead
 * (`docs/mobile-prototypes/tasks.html:131`, "Next Sep 13, 2026, 9:00 AM ·
 * last today 9:00 AM").
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function clockTime(date: Date): string {
  const hours = date.getHours()
  const suffix = hours < 12 ? 'AM' : 'PM'
  const twelve = hours % 12 === 0 ? 12 : hours % 12

  return `${twelve}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`
}

/**
 * Anything below this is epoch *seconds*, above it epoch *milliseconds*.
 * Same constant and same test this repo already applies to session
 * timestamps (`src/lib/artifacts.ts:194-200`, `normalizeArtifactTimestamp`;
 * `src/gateway/session-stream/session-info.ts:132` does the `* 1000` inline).
 * Needed here because the two timestamp sources on this screen disagree:
 * `CronJob.next_run_at`/`last_run_at` are ISO strings, while a run row is a
 * `SessionInfo` whose `started_at` is float epoch seconds
 * (`src/upstream/types/hermes.ts:543`).
 */
const MAX_UNIX_SECONDS = 1e11

/**
 * `null`/`undefined`/empty → `'—'`; an unparseable string → itself; otherwise
 * `Sep 13, 2026, 9:00 AM`.
 *
 * `now` is injectable so the "today" shortening below is testable without
 * freezing the clock globally.
 */
export function formatRunTimestamp(value?: null | number | string, now: Date = new Date()): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return '—'
    }

    return formatRunTimestamp(new Date(value < MAX_UNIX_SECONDS ? value * 1000 : value).toISOString(), now)
  }

  const iso = value
  const date = new Date(iso)

  if (Number.isNaN(date.valueOf())) {
    return iso
  }

  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()

  // The prototype writes the same-day case as "today 9:00 AM" (tasks.html:131)
  // — a real reduction in a column that is mostly today's runs.
  if (sameDay) {
    return `today ${clockTime(date)}`
  }

  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${clockTime(date)}`
}
