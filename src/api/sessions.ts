/**
 * `/api/sessions*` REST helpers — ported from apps/desktop/src/api/sessions.ts
 * (`listSessions`, the PATCH rename/flag endpoint, delete). M06 built no REST
 * layer (session-connection.ts's RPCs cover the chat screen); M07 needs REST
 * here because the WS `session.list` RPC (tui_gateway/methods_session.py) is
 * a thin `{id, title, preview, started_at, message_count, source}` shape with
 * no `pinned`/`unread`/`last_active` — exactly the fields this screen's list,
 * search and pin affordances need. `httpRequest` (src/net/http.ts) already
 * carries the Bearer/cookie-jar split M04 built; this module just resolves
 * which one applies for the active connection's `authMode`, the same three
 * branches `resolveAuth` in session-connection.ts uses for the WS dial.
 */

import { getActiveConnection } from '../connections/registry'
import { getConnectionOAuth, getConnectionToken } from '../connections/secure'
import { httpRequest, type HttpRequestOptions } from '../net/http'
import type { PaginatedSessions } from '../upstream/types/hermes'

async function restAuth(): Promise<Pick<HttpRequestOptions, 'credentials' | 'token'>> {
  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  if (connection.authMode === 'token') {
    const token = await getConnectionToken(connection.id)

    return { token: token ?? undefined }
  }

  if (connection.authMode === 'oauth') {
    const oauth = await getConnectionOAuth(connection.id)

    return { token: oauth?.accessToken }
  }

  // Gated password provider: session cookies, same as password-login.ts.
  return { credentials: 'include' }
}

async function sessionsRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  const auth = await restAuth()

  return httpRequest<T>(connection.baseUrl, path, { ...options, ...auth })
}

export interface ListSessionsParams {
  archived?: 'exclude' | 'include' | 'only'
  limit?: number
  offset?: number
  /** `recent` sorts by latest activity across a compression chain (a
   *  long-running chat that auto-compressed onto a fresh id stays on page
   *  one) — the desktop's default for its sidebar. */
  order?: 'created' | 'recent'
  /** M09: scopes the list to one Hermes profile via `?profile=` — omit for
   *  the connection's default profile. See `src/store/profile.ts`. */
  profile?: string
}

/** `GET /api/sessions` (hermes_cli/web_routers/sessions.py `get_sessions`). */
export async function listSessions(params: ListSessionsParams = {}): Promise<PaginatedSessions> {
  const query = new URLSearchParams()

  if (params.limit !== undefined) {
    query.set('limit', String(params.limit))
  }

  if (params.offset !== undefined) {
    query.set('offset', String(params.offset))
  }

  if (params.order) {
    query.set('order', params.order)
  }

  if (params.archived) {
    query.set('archived', params.archived)
  }

  const suffix = query.toString()

  return sessionsRequest<PaginatedSessions>(`/api/sessions${suffix ? `?${suffix}` : ''}`, { profile: params.profile })
}

export interface UpdateSessionFlagsBody {
  archived?: boolean
  /** Empty string clears the title back to the server's own default. */
  hidden?: boolean
  pinned?: boolean
  title?: string
  unread?: boolean
}

export interface UpdateSessionFlagsResult {
  archived?: boolean
  hidden?: boolean
  ok: boolean
  pinned?: boolean
  title: string
  unread?: boolean
}

/** `PATCH /api/sessions/{id}` — title and/or flags (pinned exempts a session
 *  from the auto-archive sweep; `unread: false` marks it read). */
export async function updateSessionFlags(
  sessionId: string,
  body: UpdateSessionFlagsBody
): Promise<UpdateSessionFlagsResult> {
  return sessionsRequest<UpdateSessionFlagsResult>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    body,
    method: 'PATCH'
  })
}

/** `DELETE /api/sessions/{id}`. */
export async function deleteSession(sessionId: string): Promise<void> {
  await sessionsRequest<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}
