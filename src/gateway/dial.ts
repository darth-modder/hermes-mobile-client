import { buildHermesWebSocketUrl } from '../upstream/shared/websocket-url'

export interface DialTarget {
  /** Host with optional port, e.g. "127.0.0.1:9119". Never inferred from a browser global. */
  host: string
  /** "http:" or "https:" — mapped to "ws:"/"wss:" by buildHermesWebSocketUrl. */
  protocol: 'http:' | 'https:'
  profile?: string
}

/**
 * Token mode (dev only, loopback-bound backends) appends `?token=` to the
 * WebSocket URL. Ticket mode (gated backends) carries a one-time ticket in
 * the WebSocket subprotocol instead — see createGatewaySocketFactory.
 */
export type DialAuth = { mode: 'token'; token: string } | { mode: 'ticket'; ticket: string }

/**
 * Builds the /api/ws URL with EXPLICIT host/protocol always supplied.
 * websocket-url.ts's buildHermesWebSocketUrl falls back to window.location
 * when host/protocol are omitted — React Native defines a global `window`
 * without `.location`, so omitting them here would throw on device.
 */
export function buildGatewayWsUrl(target: DialTarget, auth: DialAuth): string {
  return buildHermesWebSocketUrl({
    authParam: auth.mode === 'token' ? ['token', auth.token] : undefined,
    host: target.host,
    params: target.profile ? { profile: target.profile } : undefined,
    path: '/api/ws',
    protocol: target.protocol
  })
}

/**
 * Ticket mode never puts the ticket in the URL (never logged, never cached
 * by an intermediary): it rides the WebSocket handshake's Sec-WebSocket-Protocol
 * header instead, via the gateway client's `socketFactory` option. Token mode
 * needs no override unless extra proxy headers are configured — the client's
 * default `new WebSocket(url)` is enough otherwise.
 *
 * `extraHeaders` (a per-connection proxy header set — e.g. Cloudflare Access
 * — never a secret baked into the URL) rides React Native's WebSocket
 * constructor's third `{ headers }` argument, an RN-specific extension the
 * browser WebSocket spec doesn't have.
 */
export function createGatewaySocketFactory(
  auth: DialAuth,
  extraHeaders?: Record<string, string>
): ((url: string) => WebSocket) | undefined {
  const headers = extraHeaders && Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined

  if (auth.mode !== 'ticket' && !headers) {
    return undefined
  }

  const protocols = auth.mode === 'ticket' ? ['hermes-gateway-v1', `hermes-gateway-ticket.${auth.ticket}`] : undefined

  return url => (headers ? new RNWebSocket(url, protocols, { headers }) : new WebSocket(url, protocols))
}

/**
 * React Native's WebSocket constructor accepts a third `{ headers }` options
 * argument that the DOM `WebSocket` type (what this project's ambient types
 * resolve to) doesn't declare. This is that constructor's real shape, used
 * only for the extra-headers path above.
 */
interface RNWebSocketConstructor {
  new (url: string, protocols?: string[] | undefined, options?: { headers?: Record<string, string> }): WebSocket
}

const RNWebSocket = WebSocket as unknown as RNWebSocketConstructor
