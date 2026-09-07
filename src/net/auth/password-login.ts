// POST /auth/password-login {provider, username, password} -> sets session
// cookies (non-native path — this app is never the "native broker" the route
// also handles, that's M08's OAuth flow); POST /api/auth/ws-ticket mints the
// one-time WS ticket the gateway subprotocol carries (dial.ts).
//
// Never logs username, password, or any URL — matches AGENTS.md's "Nothing
// secret is ever logged" for the token case; a password is exactly as
// sensitive.

import { HttpError, httpRequest } from '../http'

export interface PasswordLoginResult {
  ok: true
  next: string
}

/** Thrown on 401 (bad credentials) and 429 (rate-limited) specifically, so
 *  callers can show "wrong password" vs "try again later" without inspecting
 *  HttpError.status themselves. Anything else surfaces as the raw HttpError. */
export class PasswordLoginError extends Error {
  readonly reason: 'invalid-credentials' | 'rate-limited' | 'unknown-provider'

  constructor(reason: PasswordLoginError['reason'], message: string) {
    super(message)
    this.name = 'PasswordLoginError'
    this.reason = reason
  }
}

export async function passwordLogin(
  baseUrl: string,
  params: { provider: string; username: string; password: string }
): Promise<PasswordLoginResult> {
  try {
    return await httpRequest<PasswordLoginResult>(baseUrl, '/auth/password-login', {
      body: { provider: params.provider, username: params.username, password: params.password },
      credentials: 'include',
      method: 'POST'
    })
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) {
        throw new PasswordLoginError('invalid-credentials', 'Incorrect username or password.')
      }

      if (error.status === 429) {
        throw new PasswordLoginError('rate-limited', 'Too many login attempts. Try again shortly.')
      }

      if (error.status === 404) {
        throw new PasswordLoginError('unknown-provider', 'This backend has no password sign-in provider.')
      }
    }

    throw error
  }
}

export interface WsTicketResult {
  ticket: string
  ttl_seconds: number
}

/** POST /api/auth/ws-ticket — one ticket per WS connect; mint immediately
 *  before dialing (M03's dial.ts never caches or reuses one). */
export async function mintWsTicket(
  baseUrl: string,
  options: { headers?: Record<string, string> } = {}
): Promise<WsTicketResult> {
  return httpRequest<WsTicketResult>(baseUrl, '/api/auth/ws-ticket', {
    credentials: 'include',
    headers: options.headers,
    method: 'POST'
  })
}
