/**
 * `/api/cron/*` REST helpers (upstream `hermes_cli/web_routers/cron.py`) —
 * built on the M09 `rest.ts` pattern (`restRequest`), same as `messaging.ts`.
 * Live updates ride the `cron.changed` gateway event (see
 * `src/store/live-sync.ts` / `src/gateway/session-connection.ts`), not
 * polling — `GET /api/cron/jobs` returns a bare array, not `{jobs: [...]}`.
 *
 * Cut from this module: `GET /api/cron/blueprints` +
 * `POST /api/cron/blueprints/instantiate` (Automation Blueprints — a
 * parameterized template catalog with its own form-builder UI) and
 * `GET /api/cron/jobs/{id}/runs` (run history, itself just `SessionInfo`
 * rows the M07 session list already renders). Neither is named by M10's task
 * list or exit criteria (create + trigger a job, `cron.changed` updates the
 * list live); the create/read/update/pause/resume/trigger/delete surface
 * below is the whole of what's needed and it's a strict subset of desktop's
 * own `apps/desktop/src/api/cron.ts`, not a divergent shape.
 */

import type { CronJob, CronJobCreatePayload, CronJobUpdates } from '../upstream/types/hermes'

import { restRequest } from './rest'

function profileQuery(profile?: string): { profile?: string } {
  return profile ? { profile } : {}
}

/** `GET /api/cron/jobs` — bare array, not wrapped. */
export function listCronJobs(profile?: string): Promise<CronJob[]> {
  return restRequest<CronJob[]>('/api/cron/jobs', profileQuery(profile))
}

export function getCronJob(jobId: string, profile?: string): Promise<CronJob> {
  return restRequest<CronJob>(`/api/cron/jobs/${encodeURIComponent(jobId)}`, profileQuery(profile))
}

/** `POST /api/cron/jobs`. `schedule` is a cron expression or one of the
 *  scheduler's recognized shorthands (`hermes_cli/web_server_cron.py`
 *  resolves it); `deliver` defaults server-side to `"local"` (save only). */
export function createCronJob(body: CronJobCreatePayload, profile?: string): Promise<CronJob> {
  return restRequest<CronJob>('/api/cron/jobs', { body, method: 'POST', ...profileQuery(profile) })
}

/** `PUT /api/cron/jobs/{id}` — the body wraps the patch in `updates`
 *  (`CronJobUpdate.updates: dict` server-side), unlike every other PUT/PATCH
 *  in this app's REST layer. */
export function updateCronJob(jobId: string, updates: CronJobUpdates, profile?: string): Promise<CronJob> {
  return restRequest<CronJob>(`/api/cron/jobs/${encodeURIComponent(jobId)}`, {
    body: { updates },
    method: 'PUT',
    ...profileQuery(profile)
  })
}

export function pauseCronJob(jobId: string, profile?: string): Promise<CronJob> {
  return restRequest<CronJob>(`/api/cron/jobs/${encodeURIComponent(jobId)}/pause`, {
    method: 'POST',
    ...profileQuery(profile)
  })
}

export function resumeCronJob(jobId: string, profile?: string): Promise<CronJob> {
  return restRequest<CronJob>(`/api/cron/jobs/${encodeURIComponent(jobId)}/resume`, {
    method: 'POST',
    ...profileQuery(profile)
  })
}

/** `POST /api/cron/jobs/{id}/trigger` — fires now, out of schedule. A paused
 *  job is force-resumed-and-claimed by the server; a run already in flight
 *  answers 409 (surfaced here as an `HttpError`, not swallowed). */
export function triggerCronJob(jobId: string, profile?: string): Promise<CronJob> {
  return restRequest<CronJob>(`/api/cron/jobs/${encodeURIComponent(jobId)}/trigger`, {
    method: 'POST',
    ...profileQuery(profile)
  })
}

export function deleteCronJob(jobId: string, profile?: string): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>(`/api/cron/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    ...profileQuery(profile)
  })
}
