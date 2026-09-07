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
 * needs no override — the client's default `new WebSocket(url)` is enough.
 */
export function createGatewaySocketFactory(auth: DialAuth): ((url: string) => WebSocket) | undefined {
  if (auth.mode !== 'ticket') {
    return undefined
  }

  const { ticket } = auth

  return url => new WebSocket(url, ['hermes-gateway-v1', `hermes-gateway-ticket.${ticket}`])
}
