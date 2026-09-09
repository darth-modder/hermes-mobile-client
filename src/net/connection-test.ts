/**
 * Connection test for the M09 connections settings screen. Exit criterion:
 * "A failing connection test shows the ladder's reason (unauthorized vs
 * forbidden vs unreachable)" — reusing `src/net/auth/ladder.ts`'s
 * classification (`classifyHttpError`/`classifyFailure`), never reinventing
 * it, per AGENTS.md's reauth rules.
 *
 * "Exercises the authenticated leg (a WS ticket), not just `/api/status`"
 * (M09 task) — and `/api/status` is not a stand-in for "authenticated" at
 * all: it is on the server's own public allowlist
 * (`hermes_cli/dashboard_auth/public_paths.py`, `PUBLIC_API_PATHS`) and
 * answers 200 with no Authorization header whatsoever, gated or not (this
 * was verified live against a throwaway `hermes serve` — a bogus Bearer
 * token still got a 200). A test built on it would report "connected" for a
 * connection whose token is completely wrong, which is worse than not
 * testing at all.
 *
 * For password/oauth connections this mints a one-time WS ticket via
 * `POST /api/auth/ws-ticket` — the exact call `resolveAuth` in
 * `src/gateway/session-connection.ts` makes before every dial, and (unlike
 * `/api/status`) genuinely requires the cookie/bearer session to be valid.
 * Token connections have no ticket step (the stored token IS the WS
 * credential, as `resolveAuth`'s token branch shows), so this hits
 * `GET /api/sessions?limit=1` instead — confirmed (same live check) to 401 on
 * a missing or wrong token even when the server has no login gate at all,
 * which is exactly the authenticated leg a token connection's dial relies on.
 */

import { getConnectionHeaders, getConnectionOAuth, getConnectionToken } from '../connections/secure'
import type { MobileConnection } from '../connections/types'

import { classifyFailure, classifyHttpError } from './auth/ladder'
import { HttpError, httpRequest } from './http'

export type ConnectionTestReason = 'forbidden' | 'ok' | 'unauthorized' | 'unreachable'

export interface ConnectionTestResult {
  message: string
  ok: boolean
  reason: ConnectionTestReason
}

function resultFor(error: unknown): ConnectionTestResult {
  const signal = classifyHttpError(error)
  const classification = classifyFailure(signal)

  if (classification === 'unauthorized') {
    return { message: 'Unauthorized — the stored credentials were rejected.', ok: false, reason: 'unauthorized' }
  }

  if (classification === 'forbidden') {
    return { message: 'Forbidden — signed in, but not permitted.', ok: false, reason: 'forbidden' }
  }

  // 'other': either a real HTTP status the ladder deliberately treats the
  // same as a network failure (5xx — never a login prompt), or no status at
  // all (timeout, abort, DNS/connection failure). Both read as "unreachable"
  // to the user; the underlying message (kept below) still distinguishes
  // them for anyone who taps through.
  const detail =
    error instanceof HttpError ? `HTTP ${error.status}` : error instanceof Error ? error.message : String(error)

  return { message: `Unreachable — ${detail}`, ok: false, reason: 'unreachable' }
}

/**
 * Test `connection`'s authenticated leg without disturbing the app's actual
 * active connection or dialing a real gateway socket.
 */
export async function testConnection(connection: MobileConnection): Promise<ConnectionTestResult> {
  const headers =
    connection.headerNames && connection.headerNames.length > 0
      ? await getConnectionHeaders(connection.id, connection.headerNames)
      : undefined

  try {
    if (connection.authMode === 'token') {
      const token = await getConnectionToken(connection.id)

      if (!token) {
        return { message: 'No stored session token for this connection.', ok: false, reason: 'unauthorized' }
      }

      const result = await httpRequest<{ total?: number }>(connection.baseUrl, '/api/sessions?limit=1', {
        credentials: 'include',
        headers,
        token
      })

      return { message: `Connected — token accepted (${result.total ?? 0} session(s)).`, ok: true, reason: 'ok' }
    }

    const bearer = connection.authMode === 'oauth' ? (await getConnectionOAuth(connection.id))?.accessToken : undefined

    const ticket = await httpRequest<{ ticket: string; ttl_seconds: number }>(
      connection.baseUrl,
      '/api/auth/ws-ticket',
      {
        credentials: 'include',
        headers,
        method: 'POST',
        token: bearer
      }
    )

    return { message: `Connected — WS ticket minted (${ticket.ttl_seconds}s ttl).`, ok: true, reason: 'ok' }
  } catch (error) {
    return resultFor(error)
  }
}
