// OAuth access-token refresh (M08) — the piece src/net/auth/ladder.ts's own doc comment left
// for M08 to plug in ("M08's OAuth mode plugs in a real one here"). Server contract, read from
// hermes_cli/dashboard_auth/routes.py's `auth_native_refresh`:
//   POST /auth/native/refresh { refresh_token, provider } ->
//     200 { access_token, refresh_token, expires_at, provider, user_id }  (rotated — see below)
//     401 { error: "session_expired", ... }   -- every provider rejected the RT; genuinely dead
//     503                                     -- a provider was unreachable; NOT a confirmed
//                                                 rejection (AGENTS.md: 5xx never triggers a
//                                                 login prompt)
//
// AGENTS.md "Credentials and reauth": "A rotated refresh token is persisted before the refresh
// promise resolves" — Portal's refresh tokens are reuse-detected (a stale RT replay revokes the
// whole chain), so a caller that reads the old RT again after a successful-but-unpersisted
// refresh would revoke its own session. `doRefresh` below writes SecureStore before returning.
//
// Single in-flight refresh per connection (a WS-close reauth and a proactive pre-request check
// racing each other must not both hit the server): concurrent callers for the same connection
// share one in-flight promise instead of each minting — and racing to persist — their own.

import { deleteConnectionOAuth, getConnectionOAuth, setConnectionOAuth } from '../../connections/secure'
import { HttpError, httpRequest } from '../http'

/** Refresh slightly before actual expiry so a request in flight doesn't race
 *  the token dying mid-call — mirrors the server's own 60s floor
 *  (`access_token_max_age`, hermes_cli/dashboard_auth/request_utils.py) and
 *  native-oauth.ts's `tokenNeedsRefresh` default skew. */
const REFRESH_SKEW_SECONDS = 60

interface NativeRefreshResponse {
  access_token?: string
  expires_at?: number
  provider?: string
  refresh_token?: string
  user_id?: string
}

const inFlightRefreshes = new Map<string, Promise<boolean>>()

/** True when a stored session is at/near expiry and should be refreshed
 *  before use. Unknown expiry (never observed from a well-formed token
 *  response, but defensive) counts as needing refresh — better an extra
 *  round trip than a silently stale token. Pure/exported for unit testing. */
export function oauthAccessTokenNeedsRefresh(expiresAt: number | undefined, nowSeconds: number): boolean {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return true
  }

  return nowSeconds >= expiresAt - REFRESH_SKEW_SECONDS
}

async function doRefresh(connectionId: string, baseUrl: string): Promise<boolean> {
  const session = await getConnectionOAuth(connectionId)

  if (!session?.refreshToken) {
    return false
  }

  let body: NativeRefreshResponse

  try {
    body = await httpRequest<NativeRefreshResponse>(baseUrl, '/auth/native/refresh', {
      body: { provider: session.provider ?? '', refresh_token: session.refreshToken },
      method: 'POST'
    })
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      // Confirmed: `{ error: "session_expired" }` — every provider rejected
      // this refresh token. Clear it so a stale/replayed RT can never be
      // resent (Portal's reuse detection would revoke the whole chain).
      await deleteConnectionOAuth(connectionId)
    }

    // 401 (session_expired), 503 (provider unreachable), a timeout, or a
    // connection failure all land here — this function's only obligation
    // for a false is not to retry on its own. AGENTS.md's "5xx/timeout never
    // triggers a login prompt" is the caller's job to honor (session-connection.ts
    // wires this to needsLogin only where that rule already applies).
    return false
  }

  if (!body.access_token) {
    return false
  }

  // Persist BEFORE returning — see this module's header. `refresh_token`
  // absent in the response means the provider didn't rotate it; keep the one
  // that still worked rather than dropping it.
  await setConnectionOAuth(connectionId, {
    accessToken: body.access_token,
    expiresAt: typeof body.expires_at === 'number' ? body.expires_at : undefined,
    provider: body.provider ?? session.provider,
    refreshToken: body.refresh_token ?? session.refreshToken,
    userId: body.user_id ?? session.userId
  })

  return true
}

/**
 * Refresh the stored OAuth session for `connectionId` against `baseUrl`.
 * Resolves `true` only on a confirmed rotation (already persisted by the
 * time this resolves); `false` for every other outcome, including a
 * genuinely expired refresh token (cleared as a side effect) and a merely
 * unreachable provider (left untouched — a later retry may still succeed).
 * Concurrent calls for the same connection share one in-flight attempt.
 */
export function refreshConnectionOAuth(connectionId: string, baseUrl: string): Promise<boolean> {
  const existing = inFlightRefreshes.get(connectionId)

  if (existing) {
    return existing
  }

  const attempt = doRefresh(connectionId, baseUrl).finally(() => {
    inFlightRefreshes.delete(connectionId)
  })

  inFlightRefreshes.set(connectionId, attempt)

  return attempt
}

/**
 * The proactive half: read the stored session, refresh it first if it's at
 * or past `expires_at - 60s`, and return the (possibly just-rotated) access
 * token — or `null` if there is no stored session, or a needed refresh
 * failed. Every call site that resolves an OAuth bearer token for a request
 * should go through this instead of reading `getConnectionOAuth` directly,
 * so a token about to expire is renewed before it's used rather than after
 * it fails.
 *
 * "Foreground-only" (M08's task line) is not a separate guard here: nothing
 * in this app calls this — or dials the gateway, or issues a REST request —
 * from the background in the first place (D10 removed the client-side
 * background timer; M07's lifecycle only reconnects/probes on foreground
 * return). A proactive check gated on "about to make a real request" is
 * therefore foreground-gated by construction.
 */
export async function ensureFreshOAuthAccessToken(connectionId: string, baseUrl: string): Promise<null | string> {
  const session = await getConnectionOAuth(connectionId)

  if (!session) {
    return null
  }

  if (!oauthAccessTokenNeedsRefresh(session.expiresAt, Date.now() / 1000)) {
    return session.accessToken
  }

  const refreshed = await refreshConnectionOAuth(connectionId, baseUrl)

  if (!refreshed) {
    // The stored session is either cleared (confirmed session_expired) or
    // still the pre-refresh one (transient failure) — either way, the value
    // read above is no longer trustworthy to hand out as "fresh".
    return null
  }

  const updated = await getConnectionOAuth(connectionId)

  return updated?.accessToken ?? null
}

/** Test-only: clear the in-flight-refresh map between tests. */
export function resetTokenRefreshForTests(): void {
  inFlightRefreshes.clear()
}
