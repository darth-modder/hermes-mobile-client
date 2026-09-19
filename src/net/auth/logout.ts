// Sign a connection out (M08 task line: "POST /auth/logout best effort, then clear SecureStore
// entries"). Applies to every auth mode a connection can have, not just oauth — token/password
// connections need their SecureStore entries cleared on logout too, and there's exactly one
// place in the app that already knows how (secure.ts's `deleteAllConnectionSecrets`, built by
// M04).
//
// Known upstream gap, worth being explicit about rather than silently working around: hermes_cli/
// dashboard_auth/routes.py's `auth_logout` reads its revocable refresh token from the SESSION
// COOKIE (`read_session_cookies`) — the only auth mode that sets one is password login. Token
// mode (`Authorization: Bearer <session token>`) and M08's native OAuth mode (bearer tokens,
// deliberately cookieless — see native-login.ts's header) both have nothing for that route to
// revoke server-side today. The call is still made (harmless, and matches the task's own "best
// effort" framing exactly), but for those two modes logout is effectively local-only: the
// SecureStore clear below is what actually ends the session on this device. A future upstream
// route that accepts a bearer refresh token for revocation would only need this module's
// `resolveLogoutAuth` extended, not a rewrite.

import { getConnection, listConnections, upsertConnection } from '../../connections/registry'
import { deleteAllConnectionSecrets, getConnectionOAuth, getConnectionToken } from '../../connections/secure'
import type { MobileConnection } from '../../connections/types'
import { disconnectForSignOut } from '../../gateway/session-connection'
import { httpRequest, type HttpRequestOptions } from '../http'

import { clearAllCookies } from './cookie-clear'

async function resolveLogoutAuth(connection: MobileConnection): Promise<Pick<HttpRequestOptions, 'token'>> {
  if (connection.authMode === 'token') {
    return { token: (await getConnectionToken(connection.id)) ?? undefined }
  }

  if (connection.authMode === 'oauth') {
    return { token: (await getConnectionOAuth(connection.id))?.accessToken }
  }

  return {}
}

/**
 * `POST /auth/logout` best-effort (a failure here — network down, server
 * gone — must not block the local sign-out; AGENTS.md never makes the
 * client's own state depend on a confirmed server response for anything
 * short of a 401/403), then clears every SecureStore entry this connection
 * owns: the session/OAuth token and any extra proxy headers (secure.ts's
 * `deleteAllConnectionSecrets`, matching the header names the connection's
 * own registry entry lists).
 *
 * `timeoutMs` defaults to `httpRequest`'s own 15s — `signOutConnection`
 * passes a short one (Opus's round-2 review: this is local state
 * protection, not a network operation the user should ever wait 15s for).
 */
export async function logoutConnection(
  connection: MobileConnection,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  const auth = await resolveLogoutAuth(connection)

  await httpRequest(connection.baseUrl, '/auth/logout', {
    credentials: 'include',
    method: 'POST',
    timeoutMs: options.timeoutMs,
    ...auth
  }).catch(() => undefined)

  await deleteAllConnectionSecrets(connection.id, connection.headerNames ?? [])
}

/**
 * M08 Defect 2: `logoutConnection` above had no caller anywhere in the app —
 * `Delete` on the connections screen clears secrets directly
 * (`deleteAllConnectionSecrets`) without ever sending the best-effort
 * `POST /auth/logout`, and there was no separate "sign out" affordance at
 * all. This is the connections screen's actual "Sign out" button: run the
 * full logout above, then flip `needsLogin` in the registry so the screen
 * immediately shows the connection needs re-authentication — same flag
 * `session-connection.ts` sets for an unauthorized close or a dead refresh
 * token, reused here since the end state is identical (no usable
 * credentials left for this connection).
 *
 * D27 (Fable's ruling, via Opus's review): three gaps this used to leave
 * open —
 *
 * 1. The live gateway socket (if this was the active connection) kept
 *    serving RPCs after Sign out — nothing here ever invalidated it.
 *    `disconnectForSignOut` (session-connection.ts) does, plus clears every
 *    piece of runtime state that connection owned (a no-op for a
 *    non-active connection — there's only ever one live socket, M04).
 * 2. `needsLogin` alone doesn't stop anything from being READ — that's
 *    resolveAuth/restRequest/sessionsRequest's job now (D27 point 2,
 *    session-connection.ts / src/api/rest.ts / src/api/sessions.ts).
 * 3. A password-mode session cookie survives in RN's native cookie jar
 *    independent of everything above — cleared (best-effort, global) by
 *    `clearAllCookies` below. Because that clear is global, not per-host,
 *    every OTHER password-mode connection's cookie is invalidated
 *    alongside it, so they're all marked `needsLogin` in the same action —
 *    otherwise the registry would claim a connection is still signed in
 *    when its cookie no longer works.
 *
 * Order (Opus's round-2 review — this used to await the best-effort POST
 * FIRST, up to 15s offline; during that whole window the socket stayed
 * live and needsLogin was unset, so an app kill mid-window left neither
 * gate up): mark needsLogin and invalidate the socket FIRST, synchronously
 * and unconditionally, before anything that touches the network or can
 * hang. Everything after that point is cleanup this sign-out would still
 * be correct without.
 */
export async function signOutConnection(connection: MobileConnection): Promise<void> {
  // Re-read the current registry entry rather than spreading the possibly
  // stale `connection` argument the caller passed in — this connection may
  // have picked up fields (a rotated header, a different label) since
  // whatever snapshot the caller is holding.
  const current = getConnection(connection.id) ?? connection

  upsertConnection({ ...current, needsLogin: true })
  disconnectForSignOut(connection.id)

  // Best-effort, short timeout — this is local state protection at this
  // point, not a network call the user should ever wait on.
  await logoutConnection(connection, { timeoutMs: 5_000 })

  // The cookie clear runs AFTER the logout POST attempt above: that POST
  // needs the still-valid cookie to have anything to revoke server-side.
  await clearAllCookies()

  for (const other of listConnections()) {
    if (other.id !== connection.id && other.authMode === 'password' && !other.needsLogin) {
      upsertConnection({ ...other, needsLogin: true })
    }
  }
}
