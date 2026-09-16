/**
 * Port of `apps/desktop/src/app/cron/job-state.ts` — the Tasks tab's state
 * dot, state label and row title. Ported rather than re-derived so the two
 * clients cannot disagree about whether a job is "running now"; that file's
 * own header says it exists to stop the desktop's sidebar and Cron page
 * drifting, and this is a third consumer of the same rule.
 *
 * `STATE_DOT` (:5-13) is a Tailwind class map there, so only its *vocabulary*
 * ports — `completed`, `disabled`, `enabled`, `error`, `paused`, `running`,
 * `scheduled` — with the colours resolved from this app's own theme tokens at
 * the call site. The tone grouping below is read straight off those classes:
 * `bg-primary` for enabled/running/scheduled, `bg-destructive` for error,
 * `bg-amber-500` for paused, `bg-(--ui-text-quaternary)` for
 * completed/disabled.
 */
import type { CronJob } from '../upstream/types/hermes'

export type JobStateTone = 'busy' | 'danger' | 'good' | 'muted' | 'warn'

/**
 * Tone per state, from `STATE_DOT`'s own classes (job-state.ts:5-13).
 *
 * `running` is the one split from the desktop's map: it is `bg-primary`
 * there, identical to `scheduled`, because the desktop animates the pip at
 * the call site to tell them apart ("Animation/size live at the call site").
 * The Tasks list has no animated pip, so `running` gets its own tone — this
 * screen's whole "is anything happening right now?" affordance
 * (`docs/mobile-prototypes/tasks.html:26-27`, a `Field`) depends on running
 * and scheduled being distinguishable at a glance.
 */
export const STATE_TONE: Record<string, JobStateTone> = {
  completed: 'muted',
  disabled: 'muted',
  enabled: 'good',
  error: 'danger',
  paused: 'warn',
  running: 'busy',
  scheduled: 'good'
}

/** Verbatim port of `jobState` (job-state.ts:16-20): explicit state wins,
 *  otherwise infer from the `enabled` flag. */
export function jobState(job: CronJob): string {
  const state = typeof job.state === 'string' ? job.state.trim() : ''

  return state || (job.enabled === false ? 'disabled' : 'scheduled')
}

/** Verbatim port of `jobTitle` (job-state.ts:24-29): name → first 60 of
 *  prompt → first 60 of script → id. */
export function jobTitle(job: CronJob): string {
  const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const clip = (v: string) => (v.length > 60 ? `${v.slice(0, 60)}…` : v)

  return pick(job.name) || clip(pick(job.prompt)) || clip(pick(job.script)) || job.id || 'Cron job'
}

export function jobStateTone(job: CronJob): JobStateTone {
  return STATE_TONE[jobState(job)] ?? 'muted'
}

/** True when this job is mid-run — `jobState(job) === 'running'`, the
 *  condition round 10's research pinned for the "Running now" counter. */
export function isRunningNow(job: CronJob): boolean {
  return jobState(job) === 'running'
}
