/**
 * Shared REST plumbing for the `src/api/*.ts` modules ported in M09
 * (`config`, `models`, `profiles`, `skills`, `toolsets`, `mcp`, `messaging`,
 * `plugins`, `system` — `sessions.ts` predates this file and keeps its own
 * inline copy, as do M11's `src/push/api.ts` / `src/voice/api.ts`; this is
 * the same auth-branch pattern factored out once for the modules landing
 * together here rather than four more inline copies).
 *
 * Upstream's api/client.ts resolves scope through Electron IPC
 * (`window.hermesDesktop.api`, `connectionScoped`/`capabilityScoped` picking
 * one of potentially many registered gateways). This app dials exactly one
 * backend at a time (src/connections/registry.ts's active connection), so
 * that whole multi-gateway routing layer has no equivalent here — `restAuth`
 * below is this app's entire answer to `hermesApi`'s connection resolution.
 * `profile` scoping (the one axis that DOES apply — M09 task "profile
 * switching scopes REST") is passed straight through to `httpRequest`'s own
 * `?profile=` handling (src/net/http.ts), same as sessions.ts already does.
 */

import { getActiveConnection } from '../connections/registry'
import { getConnectionHeaders, getConnectionOAuth, getConnectionToken } from '../connections/secure'
import { needsSignIn } from '../connections/sign-in-route'
import type { MobileConnection } from '../connections/types'
import { markConnectionNeedsLogin } from '../gateway/session-connection'
import { classifyConnectReason, describeConnectReason } from '../net/connect-reason'
import { HttpError, httpRequest, type HttpRequestOptions } from '../net/http'

/** The active connection, or throws — every caller needs one to exist. */
export function requireActiveConnection(): MobileConnection {
  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  return connection
}

/** Auth fields for `httpRequest`, resolved for `connection`'s `authMode` —
 *  the same three branches `resolveAuth` in `src/gateway/session-connection.ts`
 *  uses for the WS dial, and that `src/api/sessions.ts` already established
 *  for REST. */
export async function restAuthFor(
  connection: MobileConnection
): Promise<Pick<HttpRequestOptions, 'credentials' | 'token'>> {
  if (connection.authMode === 'token') {
    const token = await getConnectionToken(connection.id)

    return { token: token ?? undefined }
  }

  if (connection.authMode === 'oauth') {
    const oauth = await getConnectionOAuth(connection.id)

    return { token: oauth?.accessToken }
  }

  return { credentials: 'include' }
}

/** `httpRequest` against the active connection, with auth resolved and any
 *  configured proxy headers attached. `profile` in `options` scopes the call
 *  the same way `?profile=` already scopes `session.create` (M09 task).
 *
 *  D27 point 2 (Opus's review): `needsLogin` gates every authenticated
 *  outbound REST call at THIS choke point, not per screen — refuses before
 *  resolving auth or dialing anything, with the same needs-login result the
 *  shared Sign in piece (sign-in-route.ts) renders. `bots.ts`'s own guard
 *  (D23.1) may stay as a backstop, but this is the actual barrier now; no
 *  other `src/api/*.ts` module needs (or should add) its own copy. */
export async function restRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const connection = requireActiveConnection()

  if (needsSignIn(connection)) {
    throw new Error(describeConnectReason('unauthorized'))
  }

  const auth = await restAuthFor(connection)

  const proxyHeaders =
    connection.headerNames && connection.headerNames.length > 0
      ? await getConnectionHeaders(connection.id, connection.headerNames)
      : undefined

  try {
    return await httpRequest<T>(connection.baseUrl, path, {
      ...options,
      ...auth,
      headers: { ...proxyHeaders, ...options.headers }
    })
  } catch (error) {
    // Same classification `src/api/sessions.ts` applies to its own inline
    // copy of this pattern, and D24.1.2's "any REST call" is exactly this
    // shared function — every M09-era `src/api/*.ts` module goes through it.
    if (error instanceof HttpError) {
      const reason = classifyConnectReason({ httpStatus: error.status })

      if (reason === 'unauthorized' || reason === 'forbidden') {
        markConnectionNeedsLogin(connection.id)
      }

      throw new Error(describeConnectReason(reason), { cause: error })
    }

    throw error
  }
}
