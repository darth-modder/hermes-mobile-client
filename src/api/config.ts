/**
 * `/api/status`, `/api/env`, `/api/providers/*` REST helpers — ported from
 * `apps/desktop/src/api/config.ts` onto `src/net/http.ts` (see `rest.ts`'s
 * header for what changes and why: no Electron IPC, no multi-gateway
 * `connectionId` axis, `profile` scoping only).
 *
 * Backs the "providers" settings screen: env-var-keyed provider credentials
 * (`/api/env`) and OpenAI-compatible custom endpoints
 * (`/api/providers/custom-endpoints`). Desktop's provider-OAuth flow
 * (`startOAuthLogin`/`submitOAuthCode`/`pollOAuthSession`/`cancelOAuthSession`
 * — a device-code/PKCE dance for e.g. a Claude Pro/Max subscription) is not
 * ported: it needs a browser-poll UI of its own scope, and no M09 exit
 * criterion exercises it — noted in the milestone file's Deviations.
 * `getHermesConfig`/`getHermesConfigSchema`/`saveHermesConfig` (raw
 * config.yaml editing) are likewise out — the named "providers" screen is
 * env-vars and custom endpoints, not a schema-driven config editor.
 */

import type {
  CustomEndpointsResponse,
  CustomEndpointUpdate,
  CustomEndpointValidationResponse,
  EnvVarInfo,
  OAuthProvidersResponse,
  StatusResponse
} from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getStatus(profile?: string): Promise<StatusResponse> {
  return restRequest<StatusResponse>('/api/status', { profile })
}

export function getEnvVars(profile?: string): Promise<Record<string, EnvVarInfo>> {
  return restRequest<Record<string, EnvVarInfo>>('/api/env', { profile })
}

export function setEnvVar(key: string, value: string, profile?: string): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>('/api/env', { body: { key, value }, method: 'PUT', profile })
}

export function deleteEnvVar(key: string, profile?: string): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>('/api/env', { body: { key }, method: 'DELETE', profile })
}

export function revealEnvVar(key: string, profile?: string): Promise<{ key: string; value: string }> {
  return restRequest<{ key: string; value: string }>('/api/env/reveal', { body: { key }, method: 'POST', profile })
}

export function validateProviderCredential(
  key: string,
  value: string,
  apiKey?: string
): Promise<{ message: string; models?: string[]; ok: boolean; reachable: boolean }> {
  return restRequest<{ message: string; models?: string[]; ok: boolean; reachable: boolean }>(
    '/api/providers/validate',
    {
      body: { api_key: apiKey ?? '', key, value },
      method: 'POST'
    }
  )
}

export function getCustomEndpoints(): Promise<CustomEndpointsResponse> {
  return restRequest<CustomEndpointsResponse>('/api/providers/custom-endpoints')
}

export function saveCustomEndpoint(endpoint: CustomEndpointUpdate): Promise<CustomEndpointsResponse> {
  return restRequest<CustomEndpointsResponse>('/api/providers/custom-endpoints', { body: endpoint, method: 'POST' })
}

export function validateCustomEndpoint(endpoint: CustomEndpointUpdate): Promise<CustomEndpointValidationResponse> {
  return restRequest<CustomEndpointValidationResponse>('/api/providers/custom-endpoints/validate', {
    body: endpoint,
    method: 'POST'
  })
}

export function activateCustomEndpoint(id: string): Promise<{ model: string; ok: boolean; provider: string }> {
  return restRequest<{ model: string; ok: boolean; provider: string }>(
    `/api/providers/custom-endpoints/${encodeURIComponent(id)}/activate`,
    { method: 'POST' }
  )
}

export function deleteCustomEndpoint(id: string): Promise<CustomEndpointsResponse> {
  return restRequest<CustomEndpointsResponse>(`/api/providers/custom-endpoints/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

export function listOAuthProviders(): Promise<OAuthProvidersResponse> {
  return restRequest<OAuthProvidersResponse>('/api/providers/oauth')
}

export function disconnectOAuthProvider(providerId: string): Promise<{ ok: boolean; provider: string }> {
  return restRequest<{ ok: boolean; provider: string }>(`/api/providers/oauth/${encodeURIComponent(providerId)}`, {
    method: 'DELETE'
  })
}
