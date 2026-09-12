/**
 * `/api/tools/toolsets*` REST helpers — ported from
 * `apps/desktop/src/api/toolsets.ts` onto `src/net/http.ts` (see `rest.ts`).
 * `settings/toolsets.tsx` (M14) surfaces a compact toolset list (enable
 * toggle only, no per-toolset provider/model picker — that is a deep enough
 * surface to deserve its own pass later); M09 had this same list embedded
 * in the models screen before that M14 commit moved it to its own route.
 *
 * `getTerminalBackends`/`selectTerminalBackend` and
 * `getComputerUseStatus`/`grantComputerUsePermissions` are deliberately NOT
 * ported: AGENTS.md's "Machine features don't exist here" names the terminal
 * backend explicitly, and computer-use needs a display this app never has.
 */

import type { ToolsetConfig, ToolsetInfo, ToolsetModelsResponse } from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getToolsets(profile?: string): Promise<ToolsetInfo[]> {
  return restRequest<ToolsetInfo[]>('/api/tools/toolsets', { profile })
}

export function setToolsetEnabled(
  name: string,
  enabled: boolean,
  profile?: string
): Promise<{ enabled: boolean; name: string; ok: boolean }> {
  return restRequest<{ enabled: boolean; name: string; ok: boolean }>(
    `/api/tools/toolsets/${encodeURIComponent(name)}`,
    {
      body: { enabled },
      method: 'PUT',
      profile
    }
  )
}

export function getToolsetConfig(name: string, profile?: string): Promise<ToolsetConfig> {
  return restRequest<ToolsetConfig>(`/api/tools/toolsets/${encodeURIComponent(name)}/config`, { profile })
}

export function getToolsetModels(name: string, provider?: string, profile?: string): Promise<ToolsetModelsResponse> {
  const suffix = provider ? `?provider=${encodeURIComponent(provider)}` : ''

  return restRequest<ToolsetModelsResponse>(`/api/tools/toolsets/${encodeURIComponent(name)}/models${suffix}`, {
    profile
  })
}

export function selectToolsetModel(
  name: string,
  model: string,
  provider?: string,
  profile?: string
): Promise<{ model: string; name: string; ok: boolean }> {
  return restRequest<{ model: string; name: string; ok: boolean }>(
    `/api/tools/toolsets/${encodeURIComponent(name)}/model`,
    {
      body: { model, provider },
      method: 'PUT',
      profile
    }
  )
}

export interface SelectToolsetProviderResponse {
  capability?: string
  /** Present (true) when a managed Nous row was selected but the Portal
   *  entitlement is missing. */
  feature?: string
  name: string
  needs_nous_auth?: boolean
  ok: boolean
  provider: string
}

export function selectToolsetProvider(
  name: string,
  provider: string,
  capability?: 'extract' | 'search',
  profile?: string
): Promise<SelectToolsetProviderResponse> {
  return restRequest<SelectToolsetProviderResponse>(`/api/tools/toolsets/${encodeURIComponent(name)}/provider`, {
    body: capability ? { capability, provider } : { provider },
    method: 'PUT',
    profile
  })
}
