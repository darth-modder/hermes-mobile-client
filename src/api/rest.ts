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
import type { MobileConnection } from '../connections/types'
import { httpRequest, type HttpRequestOptions } from '../net/http'

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
 *  the same way `?profile=` already scopes `session.create` (M09 task). */
export async function restRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const connection = requireActiveConnection()
  const auth = await restAuthFor(connection)

  const proxyHeaders =
    connection.headerNames && connection.headerNames.length > 0
      ? await getConnectionHeaders(connection.id, connection.headerNames)
      : undefined

  return httpRequest<T>(connection.baseUrl, path, {
    ...options,
    ...auth,
    headers: { ...proxyHeaders, ...options.headers }
  })
}
