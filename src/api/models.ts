/**
 * `/api/model/*` REST helpers — ported from `apps/desktop/src/api/models.ts`
 * onto `src/net/http.ts` (see `rest.ts`). Backs the "models" settings screen.
 * `getUsageAnalytics` (capability-scoped analytics, desktop's own
 * multi-gateway concept) is not ported — no equivalent surface here.
 *
 * `setSessionModel`/`setSessionReasoningEffort` (M15 B, per D17.3) are a
 * second, gateway-RPC surface in this same file: the composer's model and
 * effort chips scope a switch to ONE session, never the host's default, so
 * they cannot go through `setGlobalModel`/`/api/model/set` above (`scope:
 * 'main'`, host-wide). Both call the gateway's `config.set`
 * (`tui_gateway/methods_config_set.py`), addressed by the session's runtime
 * id via `session-connection.ts`'s `gatewayRequest`/`runtimeIdForStored` —
 * the same stored->runtime resolution every session-scoped RPC in that file
 * uses, since callers here only know the stored id.
 */

import { gatewayRequest, runtimeIdForStored } from '../gateway/session-connection'
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

/** `config.set`'s response envelope for a session-scoped `model`/`reasoning`
 *  switch (`tui_gateway/methods_config_set.py`'s `_kv`/`_cfgset_model_ok`).
 *  `deferred` is the mid-turn "stashed" case
 *  (`methods_config_set.py:116-117`, `_stash_pending_model_switch`): the pick
 *  didn't apply yet, it's queued for the next turn start, and the NEXT
 *  `session.info` for this session still reports the pre-switch model until
 *  then. `confirm_required`/`confirm_message` cover the one case `model`
 *  answers with a guard instead of applying — an expensive-model switch that
 *  needs `setSessionModel` called again with `confirmExpensiveModel: true` —
 *  not reached by `reasoning`, which has no such guard. */
export interface SessionConfigSwitchResult {
  confirm_message?: string
  confirm_required?: boolean
  deferred?: boolean
  key: string
  scope?: string
  value: string
  warning?: string
}

/**
 * Per-session model switch — the composer's model chip (M15 B). Always
 * passes `--session` in the `config.set` value string so the pick can never
 * move the host's `model.default`, matching the desktop's own non-primary
 * picker path (`apps/desktop/src/app/shell/model-menu-panel.tsx:216-220`,
 * `apps/desktop/src/app/session/hooks/use-model-controls.ts:273-281`:
 * `scope = touchesPrimary && !isSessionOnlyPreset ? '' : ' --session'` — this
 * app has no "primary session" concept to touch, so it is unconditionally
 * the `--session` branch). `resolve_persist_behavior` confirms `--session`
 * returns `False` (never persists) regardless of host state
 * (`hermes_cli/model_switch.py:493,512-513`).
 */
export function setSessionModel(
  storedSessionId: string,
  model: string,
  provider: string,
  confirmExpensiveModel?: boolean
): Promise<SessionConfigSwitchResult> {
  return gatewayRequest<SessionConfigSwitchResult>('config.set', {
    key: 'model',
    session_id: runtimeIdForStored(storedSessionId),
    value: `${model} --provider ${provider} --session`,
    ...(confirmExpensiveModel ? { confirm_expensive_model: true } : {})
  })
}

/**
 * Per-session reasoning effort — the composer's effort chip (M15 B). The
 * `config.set` *key* is `reasoning`, not `reasoning_effort`: M15's own doc
 * named the latter, but that's only the `session.info` read-back field
 * (`src/gateway/session-stream/session-info.ts:71-72`,
 * `tui_gateway/server.py:2041-2044,2063`) — the desktop's own effort control
 * sends `key: 'reasoning'` (`apps/desktop/src/store/model-presets.ts:89`),
 * and the gateway's dispatch table has no `reasoning_effort` entry at all
 * (`tui_gateway/methods_config_set.py:451`, which maps `"reasoning":
 * _set_reasoning`). No `scope` param: unlike `model`, `_set_reasoning`
 * already scopes to the session by default whenever one is present — only
 * `scope: 'global'` would move the host default (`methods_config_set.py:
 * 289-317`, the `if scope == "global" or session is None: ... else:
 * session["create_reasoning_override"] = parsed` branch).
 */
export function setSessionReasoningEffort(storedSessionId: string, effort: string): Promise<SessionConfigSwitchResult> {
  return gatewayRequest<SessionConfigSwitchResult>('config.set', {
    key: 'reasoning',
    session_id: runtimeIdForStored(storedSessionId),
    value: effort
  })
}
