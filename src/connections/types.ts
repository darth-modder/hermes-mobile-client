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
  /** Set by the reauth ladder on a confirmed 401 that survived one refresh
   *  attempt — the UI should show the login screen for this connection. */
  needsLogin?: boolean
}
