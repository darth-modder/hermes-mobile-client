// Hermes Cloud (`kind: 'cloud'`) agent discovery — task line: "ported from upstream
// apps/desktop/electron/connection-config.ts (resolveRemote)". Two things worth writing down
// about that port, because neither upstream location matches the task line literally:
//
// 1. There is no function literally named `resolveRemote` at the read HEAD (see
//    UPSTREAM.json.commit). The nearest matches are `resolveDesktopRemoteRoute`
//    (apps/desktop/electron/desktop-remote-route.ts) and `resolveRemoteBackend`
//    (apps/desktop/electron/main.ts) — both confirm the one fact this module actually needs:
//    `modeIsRemoteLike`'s own comment in connection-config.ts says a `kind: 'cloud'` connection
//    "carries a remote-shaped block and reuses the entire remote connect/probe/reconnect path
//    ... the only places that distinguish cloud from remote are the settings UI (which card to
//    show) and config persistence (remembering the provenance)". Concretely: once a cloud
//    connection's `baseUrl` is known, M08 needs nothing else from connection-config.ts — dialing
//    it is `src/net/auth/native-login.ts` + `src/gateway/dial.ts` unchanged, exactly like a
//    `kind: 'remote'` oauth connection. That fact isn't ported as code because there's no code
//    to port: `modeIsRemoteLike` (a one-line `mode === 'remote' || mode === 'cloud'`) has no
//    mobile equivalent to call — this app's `resolveAuth`/`ensureGatewayConnection`
//    (session-connection.ts) never branch on `connection.kind` at all, which already IS the
//    "reuse the remote path" behavior.
//
// 2. The actual *discovery* — listing the Hermes Cloud agents a signed-in user can see, so a
//    connection's `baseUrl` doesn't have to be typed in by hand — lives in
//    apps/desktop/electron/main.ts's "Hermes Cloud discovery" section (`discoverCloudAgents`,
//    `resolvePortalBaseUrl`, `trimCloudAgents`/`trimCloudOrg`), ported below. What's
//    deliberately NOT ported is that function's transport: desktop authenticates
//    `GET {portal}/api/agents` with a Privy session cookie living in a persistent Electron
//    `session.fromPartition`, refreshed silently by loading the portal in a hidden BrowserWindow
//    and re-reading its cookie jar. Neither a persistent, JS-readable cookie partition nor a
//    hidden webview exists in an Expo Custom Tabs flow — `expo-web-browser` hands the app
//    nothing back from the tab but a dismissal event, by design (RFC 8252 §8.12's whole point).
//    The portal (NAS) also has no RFC 8252 broker of its own (only each individual gateway's
//    `hermes_cli/dashboard_auth/routes.py` does) for this app's `native-login.ts` to mint a
//    portal-scoped bearer token against. So `discoverCloudAgents` here takes a bearer
//    `accessToken` as a parameter rather than reaching for a cookie jar, and is exported
//    unwired: nothing in M08 calls it. It's ready for whichever surface first has a
//    portal-scoped access token to hand it — M09 owns the connections UI that would call it, and
//    inherits this same gap rather than silently working around it with a mechanism upstream
//    doesn't provide.

import { HttpError, httpRequest } from '../http'

const DEFAULT_NOUS_PORTAL_URL = 'https://portal.nousresearch.com'

/** The canonical Nous Portal base URL, trimmed of a trailing slash. `override`
 *  lets a caller point at staging/dev, mirroring the desktop's env-var
 *  override (there is no process env on-device; a future settings surface
 *  would pass this through explicitly instead). */
export function resolvePortalBaseUrl(override?: string): string {
  const raw = (override ?? DEFAULT_NOUS_PORTAL_URL).trim()

  return raw.replace(/\/+$/, '')
}

export interface CloudAgent {
  dashboardGatewayState: string
  dashboardUrl: null | string
  id: string
  name: string
  status: string
}

export interface CloudOrg {
  id: string
  isPersonal: boolean
  name: string
  role: string
  slug: null | string
}

/** Project NAS's agent rows to the trimmed DTO this app persists — verbatim
 *  port of main.ts's `trimCloudAgents`. */
export function trimCloudAgents(body: unknown): CloudAgent[] {
  const agents = isRecord(body) && Array.isArray(body.agents) ? body.agents : []

  return agents
    .filter((agent): agent is Record<string, unknown> => isRecord(agent) && typeof agent.id === 'string')
    .map(agent => ({
      dashboardGatewayState: typeof agent.dashboardGatewayState === 'string' ? agent.dashboardGatewayState : 'unknown',
      dashboardUrl: typeof agent.dashboardUrl === 'string' ? agent.dashboardUrl : null,
      id: agent.id as string,
      name: typeof agent.name === 'string' ? agent.name : (agent.id as string),
      status: typeof agent.status === 'string' ? agent.status : 'unknown'
    }))
}

/** Verbatim port of main.ts's `trimCloudOrg` / the 409 body's `orgs` shape. */
function trimCloudOrgRecord(org: unknown): CloudOrg | null {
  if (!isRecord(org) || typeof org.id !== 'string') {
    return null
  }

  return {
    id: org.id,
    isPersonal: Boolean(org.isPersonal),
    name: typeof org.name === 'string' ? org.name : org.id,
    role: typeof org.role === 'string' ? org.role : 'MEMBER',
    slug: typeof org.slug === 'string' ? org.slug : null
  }
}

export function trimCloudOrg(org: unknown): CloudOrg | null {
  return trimCloudOrgRecord(org)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export type CloudDiscoveryResult =
  { agents: CloudAgent[]; org: CloudOrg | null } | { needsOrgSelection: true; orgs: CloudOrg[] }

export class CloudDiscoveryError extends Error {
  readonly cause: unknown
  readonly reason: 'session-expired' | 'unreachable'

  constructor(reason: CloudDiscoveryError['reason'], message: string, cause?: unknown) {
    super(message)
    this.name = 'CloudDiscoveryError'
    this.reason = reason
    this.cause = cause
  }
}

/**
 * `GET {portalBaseUrl}/api/agents[?org=]`, Bearer-authenticated (see this
 * module's header for why — not the cookie desktop uses). A 401 means the
 * access token is dead — `reason: 'session-expired'`, matching
 * AGENTS.md's "reauth only on a confirmed 401/403"; a 409
 * `org_selection_required` returns the org list instead of throwing, so a
 * caller can re-call with a chosen `org`; anything else network-shaped
 * (timeout, 5xx) becomes `reason: 'unreachable'` and must never be treated
 * as "sign in again".
 */
export async function discoverCloudAgents(
  portalBaseUrl: string,
  accessToken: string,
  org?: string
): Promise<CloudDiscoveryResult> {
  const suffix = org ? `?org=${encodeURIComponent(org)}` : ''

  try {
    const body = await httpRequest<unknown>(portalBaseUrl, `/api/agents${suffix}`, { token: accessToken })

    return { agents: trimCloudAgents(body), org: trimCloudOrgRecord(isRecord(body) ? body.org : undefined) }
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      throw new CloudDiscoveryError(
        'session-expired',
        'Your Hermes Cloud session has expired. Sign in to Hermes Cloud again.',
        error
      )
    }

    if (error instanceof HttpError && error.status === 409) {
      const orgs = parseOrgSelectionBody(error.body)

      if (orgs) {
        return { needsOrgSelection: true, orgs }
      }
    }

    throw new CloudDiscoveryError('unreachable', 'Could not reach Hermes Cloud right now.', error)
  }
}

/** The 409 body's `{ error: "org_selection_required", orgs: [...] }` shape —
 *  unlike desktop's `parseOrgSelectionError`, this reads a real parsed JSON
 *  body (`httpRequest` already parses it) rather than re-parsing it out of
 *  an error message string. */
function parseOrgSelectionBody(body: unknown): CloudOrg[] | null {
  if (!isRecord(body) || body.error !== 'org_selection_required' || !Array.isArray(body.orgs)) {
    return null
  }

  const orgs = body.orgs.map(trimCloudOrgRecord).filter((org): org is CloudOrg => org !== null)

  return orgs
}
