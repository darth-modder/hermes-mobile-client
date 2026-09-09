/**
 * `/api/plugins/hermes-push/*` REST calls — the client half of `server-plugin/hermes-push`
 * (M11). Same auth-branch pattern as `src/api/sessions.ts` (token / oauth / cookie jar per the
 * active connection's `authMode`).
 *
 * Graceful degradation: most backends won't have the plugin installed at all, so every call
 * here treats a 404 as "plugin absent" and resolves to `null`/void instead of throwing — a
 * missing plugin must never break login, backgrounding, or anything else in the app.
 */

import { getActiveConnection } from '../connections/registry'
import { getConnectionOAuth, getConnectionToken } from '../connections/secure'
import { HttpError, httpRequest, type HttpRequestOptions } from '../net/http'

const PLUGIN_PATH = '/api/plugins/hermes-push'

export interface PushDevice {
  id: string
  label: string
  platform: string
  presence: 'background' | 'foreground'
  registered_at: number
  updated_at: number
}

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

  return { credentials: 'include' }
}

/** Returns null on a 404 (plugin not installed on this backend) instead of throwing —
 *  every caller in this module treats that the same as "nothing to do here". */
async function pluginRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<null | T> {
  const connection = getActiveConnection()

  if (!connection) {
    return null
  }

  try {
    const auth = await restAuth()

    return await httpRequest<T>(connection.baseUrl, `${PLUGIN_PATH}${path}`, { ...options, ...auth })
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null
    }

    throw error
  }
}

/** `POST /devices` — upsert this device's Expo push token. Idempotent server-side (the
 *  device id is derived from the token), so calling this again on every login/rotation is
 *  the intended usage, not a special "only if changed" path. */
export async function registerPushDevice(token: string, platform: string, label: string): Promise<null | PushDevice> {
  const result = await pluginRequest<{ device: PushDevice; ok: boolean }>('/devices', {
    body: { label, platform, token },
    method: 'POST'
  })

  return result?.device ?? null
}

/** `DELETE /devices/{id}`. Best-effort — a failed unregister (backend unreachable, plugin
 *  absent) is not worth surfacing; the device row is harmless dead weight at worst. */
export async function unregisterPushDevice(deviceId: string): Promise<void> {
  await pluginRequest<unknown>(`/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }).catch(() => undefined)
}

/** `POST /devices/{id}/presence` — the only signal that gates push delivery server-side
 *  (D10: never socket/connection state). Best-effort for the same reason as unregister. */
export async function reportPushPresence(deviceId: string, foreground: boolean): Promise<void> {
  await pluginRequest<unknown>(`/devices/${encodeURIComponent(deviceId)}/presence`, {
    body: { foreground },
    method: 'POST'
  }).catch(() => undefined)
}
