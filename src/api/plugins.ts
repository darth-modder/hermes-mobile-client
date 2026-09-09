/**
 * `/api/plugins/<id>/*` generic REST door — ported from
 * `apps/desktop/src/api/plugins.ts` onto `src/net/http.ts` (see `rest.ts`).
 * Desktop's version resolves ANY registered gateway via Electron IPC
 * (`activeConnection`, `pluginRest`, `pluginSocket`); this app dials exactly
 * one backend, so the whole connection-resolution half of that file has no
 * equivalent — `pluginRest` below is `restRequest` plus the namespace guard.
 * `pluginSocket` (the WS twin, with its own reconnect-backoff loop) is not
 * ported: no exit criterion needs a live plugin event stream, and
 * `src/push/api.ts` (M11) shows the one plugin this app talks to today calls
 * REST only. A future consumer can port it the same way once something
 * actually needs it.
 *
 * Backs the "plugins" settings screen: `listInstalledPlugins` is
 * `GET /api/dashboard/plugins` (`hermes_cli/web_routers/dashboard_ui.py`,
 * backed by `_discover_dashboard_plugins`'s manifest.json scan) — the same
 * discovery desktop's plugin hub uses, minus its live per-plugin dashboard
 * (an embedded web view of the plugin's own UI): there is no mobile
 * equivalent of "run an arbitrary plugin's web page inline", so the mobile
 * screen is list-only. `pluginRest` is the generic call surface a *specific*
 * plugin integration (e.g. hermes-push's device list, `src/push/api.ts`)
 * would use, scoped by construction to `/api/plugins/<pluginId>` so one
 * plugin can never address another's namespace or a core route through it.
 */

import { restRequest } from './rest'

/** One row from `GET /api/dashboard/plugins` — shape is the plugin's own
 *  `dashboard/manifest.json` (author-defined fields) plus `source`; only the
 *  fields every manifest is expected to carry are typed here. */
export interface InstalledPlugin {
  description?: string
  label?: string
  name: string
  source?: string
  version?: string
}

export function listInstalledPlugins(): Promise<InstalledPlugin[]> {
  return restRequest<InstalledPlugin[]>('/api/dashboard/plugins')
}

// Normalize `path` to a leading-slash suffix relative to `/api/plugins/<id>`.
// The namespace is the boundary — reject `..` so a relative segment can't
// normalize out into another plugin's API or a core route. Check the path
// portion only (before any query/hash).
function pluginPathSuffix(caller: string, path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`

  if (suffix.split(/[#?]/, 1)[0].split('/').includes('..')) {
    throw new Error(`${caller}: illegal path traversal in "${path}"`)
  }

  return suffix
}

export interface PluginRestOptions {
  body?: unknown
  method?: string
  timeoutMs?: number
}

/** The plugin REST door. Every call is scoped by construction to the
 *  plugin's own backend namespace — `path` is relative to
 *  `/api/plugins/<pluginId>` (`/devices` → `/api/plugins/hermes-push/devices`). */
export function pluginRest<T>(pluginId: string, path: string, opts: PluginRestOptions = {}): Promise<T> {
  const suffix = pluginPathSuffix('pluginRest', path)

  return restRequest<T>(`/api/plugins/${encodeURIComponent(pluginId)}${suffix}`, {
    body: opts.body,
    method: opts.method,
    timeoutMs: opts.timeoutMs
  })
}
