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

import { upsertConnection } from '../../connections/registry'
import { deleteAllConnectionSecrets, getConnectionOAuth, getConnectionToken } from '../../connections/secure'
import type { MobileConnection } from '../../connections/types'
import { httpRequest, type HttpRequestOptions } from '../http'

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
 */
export async function logoutConnection(connection: MobileConnection): Promise<void> {
  const auth = await resolveLogoutAuth(connection)

  await httpRequest(connection.baseUrl, '/auth/logout', {
    credentials: 'include',
    method: 'POST',
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
 */
export async function signOutConnection(connection: MobileConnection): Promise<void> {
  await logoutConnection(connection)
  upsertConnection({ ...connection, needsLogin: true })
}
