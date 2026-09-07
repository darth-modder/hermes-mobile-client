// Auth-mode discovery for a candidate backend: what does it require, and
// (once authenticated) who are we. All public until noted otherwise.

import { httpRequest } from '../http'

export interface HealthResponse {
  ok: boolean
  version?: string
  auth_required: boolean
}

/** GET /api/health — public, lightweight liveness + gate check. */
export async function probeHealth(baseUrl: string): Promise<HealthResponse> {
  return httpRequest<HealthResponse>(baseUrl, '/api/health')
}

export interface AuthProviderInfo {
  name: string
  display_name?: string
  supports_password: boolean
}

/** GET /api/auth/providers — public. 503 (zero registered providers) surfaces
 *  as an HttpError; callers treat that the same as "no password option". */
export async function probeAuthProviders(baseUrl: string): Promise<AuthProviderInfo[]> {
  const body = await httpRequest<{ providers: AuthProviderInfo[] }>(baseUrl, '/api/auth/providers')

  return body.providers ?? []
}

export interface StatusResponse {
  version?: string
  auth_required?: boolean
  install_id?: string
  [key: string]: unknown
}

/** GET /api/status, authenticated (Bearer token or cookie session per mode). */
export async function probeStatus(
  baseUrl: string,
  options: { token?: string; headers?: Record<string, string> } = {}
): Promise<StatusResponse> {
  return httpRequest<StatusResponse>(baseUrl, '/api/status', {
    credentials: 'include',
    headers: options.headers,
    token: options.token
  })
}

export interface AuthMeResponse {
  user_id: string
  email?: string
  display_name?: string
  org_id?: string
  provider: string
  expires_at?: number
}

/** GET /api/auth/me — auth-required; the gate enforces it. 401 means the
 *  session (cookie or bearer) is not live. */
export async function probeMe(
  baseUrl: string,
  options: { token?: string; headers?: Record<string, string> } = {}
): Promise<AuthMeResponse> {
  return httpRequest<AuthMeResponse>(baseUrl, '/api/auth/me', {
    credentials: 'include',
    headers: options.headers,
    token: options.token
  })
}
