export type ConnectionAuthMode = 'token' | 'password' | 'oauth'

/**
 * A backend this app knows how to dial. Secrets (session token, OAuth
 * tokens, proxy header values) never live here — see secure.ts. This is
 * connection metadata only, persisted in MMKV (registry.ts).
 */
export interface MobileConnection {
  id: string
  kind: 'remote' | 'cloud'
  label: string
  /** e.g. "http://127.0.0.1:9119" or "https://hermes.example.com" — never a
   *  URL with `?token=` baked in; the token lives in expo-secure-store. */
  baseUrl: string
  authMode: ConnectionAuthMode
  provider?: string
  /** Names of extra proxy headers this connection sends (e.g. Cloudflare
   *  Access) — the values live in secure.ts under `conn.<id>.header.<name>`. */
  headerNames?: string[]
  installId?: string
  lastUsedAt?: number
  /** `kind: 'cloud'` only — the Hermes Cloud org slug/id this connection was
   *  discovered under (cloud-discovery.ts). Provenance only; dialing a cloud
   *  connection is identical to a remote one (see cloud-discovery.ts's
   *  header) and never branches on this field. */
  org?: string
  /** Set by the reauth ladder on a confirmed 401 that survived one refresh
   *  attempt — the UI should show the login screen for this connection. */
  needsLogin?: boolean
  /** At most one connection in the registry (registry.ts's `listConnections`)
   *  is primary — the one the connections screen defaults new sessions to.
   *  Independent of which connection is *active* right now (M09). */
  primary?: boolean
}
