/**
 * `/api/cron/*` REST helpers (upstream `hermes_cli/web_routers/cron.py`) —
 * built on the M09 `rest.ts` pattern (`restRequest`), same as `messaging.ts`.
 * Live updates ride the `cron.changed` gateway event (see
 * `src/store/live-sync.ts` / `src/gateway/session-connection.ts`), not
 * polling — `GET /api/cron/jobs` returns a bare array, not `{jobs: [...]}`.
 *
 * `getCronJobRuns`/`listCronBlueprints`/`instantiateCronBlueprint` (M14):
 * this module's own header used to say these three were cut because M10's
 * task list didn't name them — re-checked directly against
 * `hermes_cli/web_routers/cron.py` (M14 Deviation 13's standing rule: name
 * the layer searched before calling something absent) and all three are
 * real, registered routes, not a desktop-only shape this app doesn't have.
 * `GET .../{id}/runs` returns `{runs: SessionInfo[], limit}` — "same row
 * shape as `/api/sessions` so the frontend reuses `SessionInfo`" per that
 * route's own docstring, which is why no separate `CronJobRun` type exists
 * below. The M10-era decision to leave these unwrapped stands corrected in
 * cause, not in effect until this milestone: `cron/[id].tsx` (M14) now
 * wraps and uses both.
 *
 * `CronBlueprint`/`CronBlueprintField` (M15 task 1): these two were briefly
 * hand-added to the vendored `../upstream/types/hermes.ts` in M14
 * (`e8156bf`) — a rule violation (upstream types are synced by
 * `scripts/sync-upstream.mjs`, never hand-edited) that also happened to be
 * wrong on the facts: `apps/desktop/src/types/hermes.ts` has never declared
 * `CronBlueprint`/`CronBlueprintField` at any commit (checked the full
 * history: only `AutomationBlueprint`/`AutomationBlueprintField` ever
 * existed there). They describe `GET /api/cron/blueprints` /
 * `POST /api/cron/blueprints/instantiate`'s JSON
 * (`../hermes-agent/cron/blueprint_catalog.py`'s `blueprint_catalog_entry`,
 * a superset of `blueprint_form_schema`) — a shape this app defined itself
 * from the REST route, not a desktop type — so they live here, not in the
 * vendored file. `type` is one of `'text' | 'enum' | 'time' | 'weekdays'` in
 * practice (the catalog's own `BlueprintSlot.type`), kept as `string` since
 * the server treats it as an open set.
 *
 * `getCronDeliveryTargets` (M15 task 3, `CronDeliveryTarget` — a genuine
 * desktop type, `apps/desktop/src/types/hermes.ts:924-929`, already vendored
 * straight, unlike `CronBlueprint` above): `createCronJob`/`updateCronJob`'s
 * `deliver` field already existed in both payload types before this
 * milestone, but this app had no way to list which delivery targets are
 * actually valid on this host to populate a picker with.
 * `GET /api/cron/delivery-targets` (`hermes_cli/web_routers/cron.py:231-243`,
 * `get_cron_delivery_targets`) always includes `{id: 'local', name: 'Local
 * (save only)', home_target_set: true, home_env_var: null}` first, then
 * `cron_delivery_targets()`'s configured gateway platforms — a platform with
 * no cron home channel is still listed, with `home_target_set: false`, so a
 * picker can show it disabled-with-reason instead of omitting it. The desktop
 * (`apps/desktop/src/api/cron.ts:55-63`) scopes this call with
 * `profileScoped()`/`connectionScoped()`, both Electron-IPC concepts with no
 * equivalent here (this file's header); the route itself takes no `profile`
 * query param at all (checked its signature directly — no `Optional[str]`),
 * so the optional `profile` below is accepted for this module's own
 * consistency with every other function here, not because the server reads
 * it.
 */

import type {
  CronDeliveryTarget,
  CronJob,
  CronJobCreatePayload,
  CronJobUpdates,
  SessionInfo
} from '../upstream/types/hermes'

import { restRequest } from './rest'

export interface CronBlueprintField {
  default?: string
  help?: string
  label: string
  name: string
  optional?: boolean
  options?: string[]
  strict?: boolean
  type: string
}

export interface CronBlueprint {
  appUrl: string
  category?: string
  command: string
  description?: string
  fields: CronBlueprintField[]
  key: string
  schedule: string
  scheduleHuman: string
  tags?: string[]
  title: string
}

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

/** `GET /api/cron/jobs/{id}/runs` — newest first, `SessionInfo`-shaped
 *  (each run is a real session, id `cron_{job_id}_{timestamp}`). */
export function getCronJobRuns(
  jobId: string,
  profile?: string,
  limit?: number
): Promise<{ limit: number; runs: SessionInfo[] }> {
  const suffix = limit ? `?limit=${encodeURIComponent(String(limit))}` : ''

  return restRequest<{ limit: number; runs: SessionInfo[] }>(
    `/api/cron/jobs/${encodeURIComponent(jobId)}/runs${suffix}`,
    profileQuery(profile)
  )
}

/** `GET /api/cron/blueprints` — the template catalog, one form schema per
 *  entry (see `CronBlueprint`'s own doc comment for the field shape). */
export function listCronBlueprints(): Promise<{ blueprints: CronBlueprint[] }> {
  return restRequest<{ blueprints: CronBlueprint[] }>('/api/cron/blueprints')
}

/** `POST /api/cron/blueprints/instantiate` — fills a blueprint's fields and
 *  creates the job server-side (the form-submit path; values are the raw
 *  field values keyed by `CronBlueprintField.name`). */
export function instantiateCronBlueprint(
  blueprint: string,
  values: Record<string, string>,
  profile?: string
): Promise<CronJob> {
  return restRequest<CronJob>('/api/cron/blueprints/instantiate', {
    body: { blueprint, values },
    method: 'POST',
    ...profileQuery(profile)
  })
}

/** `GET /api/cron/delivery-targets` — the deliver-to picker's options: always
 *  `local` first, then each configured gateway platform (`home_target_set:
 *  false` when the platform has no cron home channel yet, still listed so a
 *  picker can show it disabled-with-reason rather than omit it). */
export function getCronDeliveryTargets(profile?: string): Promise<{ targets: CronDeliveryTarget[] }> {
  return restRequest<{ targets: CronDeliveryTarget[] }>('/api/cron/delivery-targets', profileQuery(profile))
}
