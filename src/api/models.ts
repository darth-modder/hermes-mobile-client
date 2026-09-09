/**
 * `/api/model/*` REST helpers — ported from `apps/desktop/src/api/models.ts`
 * onto `src/net/http.ts` (see `rest.ts`). Backs the "models" settings screen.
 * `getUsageAnalytics` (capability-scoped analytics, desktop's own
 * multi-gateway concept) is not ported — no equivalent surface here.
 */

import type {
  AuxiliaryModelsResponse,
  MoaConfigResponse,
  ModelAssignmentRequest,
  ModelAssignmentResponse,
  ModelInfoResponse,
  ModelOptionsResponse
} from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getGlobalModelInfo(profile?: string): Promise<ModelInfoResponse> {
  return restRequest<ModelInfoResponse>('/api/model/info', { profile })
}

export interface GetGlobalModelOptionsParams {
  explicitOnly?: boolean
  includeUnconfigured?: boolean
  refresh?: boolean
}

export function getGlobalModelOptions(
  opts: GetGlobalModelOptionsParams = {},
  profile?: string
): Promise<ModelOptionsResponse> {
  const params = new URLSearchParams()

  if (opts.refresh) {
    params.set('refresh', '1')
  }

  if (opts.includeUnconfigured) {
    params.set('include_unconfigured', '1')
  }

  if (opts.explicitOnly !== false) {
    params.set('explicit_only', '1')
  }

  const suffix = params.toString()

  return restRequest<ModelOptionsResponse>(suffix ? `/api/model/options?${suffix}` : '/api/model/options', { profile })
}

export interface RecommendedDefaultModel {
  /** True/false for Nous (free vs paid tier); null for other providers. */
  free_tier: boolean | null
  model: string
  provider: string
}

/** Recommended default model for a freshly-authenticated provider — mirrors
 *  the curation `hermes model` does. */
export function getRecommendedDefaultModel(provider: string, profile?: string): Promise<RecommendedDefaultModel> {
  return restRequest<RecommendedDefaultModel>(
    `/api/model/recommended-default?provider=${encodeURIComponent(provider)}`,
    {
      profile
    }
  )
}

/** Sets the MAIN model — the one an exit criterion checks for ("a model
 *  switch is reflected in the next `session.info`"). Profile-scoped via the
 *  caller's active-connection profile (M09 task: "profile switching scopes
 *  REST (`?profile=`)"). */
export function setGlobalModel(
  provider: string,
  model: string,
  profile?: string
): Promise<{ model: string; ok: boolean; provider: string }> {
  return restRequest<{ model: string; ok: boolean; provider: string }>('/api/model/set', {
    body: { model, provider, scope: 'main' },
    method: 'POST',
    profile
  })
}

export function getAuxiliaryModels(profile?: string): Promise<AuxiliaryModelsResponse> {
  return restRequest<AuxiliaryModelsResponse>('/api/model/auxiliary', { profile })
}

export function getMoaModels(profile?: string): Promise<MoaConfigResponse> {
  return restRequest<MoaConfigResponse>('/api/model/moa', { profile })
}

export function saveMoaModels(body: MoaConfigResponse, profile?: string): Promise<MoaConfigResponse & { ok: boolean }> {
  return restRequest<MoaConfigResponse & { ok: boolean }>('/api/model/moa', { body, method: 'PUT', profile })
}

export function setModelAssignment(body: ModelAssignmentRequest, profile?: string): Promise<ModelAssignmentResponse> {
  return restRequest<ModelAssignmentResponse>('/api/model/set', { body, method: 'POST', profile })
}
