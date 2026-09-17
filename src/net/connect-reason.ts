import { classifyFailure } from './auth/ladder'

/**
 * The user-facing cause of a failed gateway connection attempt — WS connect
 * (src/gateway/mobile-gateway.ts) and the pre-connect ws-ticket mint
 * (src/gateway/session-connection.ts's resolveAuth) both classify through
 * this, so the connect screen and the boot-failure screen (session-list.tsx)
 * name the real cause instead of one generic "could not connect" string.
 *
 * 'unauthorized'/'forbidden' reuse M04's reason ladder (src/net/auth/
 * ladder.ts's classifyFailure) — the same 401/403 rule that already governs
 * reauth decisions, so this never diverges from what AGENTS.md requires
 * there. 'dns'/'refused'/'timeout'/'tls' come from pattern-matching a raw
 * transport message: both RN's WebSocket 'error' event and RN's `fetch()`
 * on Android pass the underlying OkHttp exception's `.message` through
 * (confirmed for fetch by round 3's field notes, M15-bots-and-
 * mobile-ux.md task 3: "fetch failed: java.net.ConnectException: Failed to
 * connect to /127.0.0.1:9132"). 'unreachable' is the fallback when no
 * message is available at all — matching src/net/connection-test.ts's own
 * ConnectionTestReason.
 */
export type ConnectReason = 'dns' | 'forbidden' | 'refused' | 'timeout' | 'tls' | 'unauthorized' | 'unreachable'

export interface ConnectFailureSignal {
  httpStatus?: number
  /** Raw text from a WS 'error' event's `.message` (Android/OkHttp only — see module docstring). */
  rawMessage?: string
  wsCloseCode?: number
}

// Substrings from Android's OkHttp-backed exception messages, which RN's
// WebSocket module passes through on a native 'error' event untouched
// (ConnectException/SocketTimeoutException/UnknownHostException/
// SSLHandshakeException are the standard java.net/javax.net.ssl class
// names for these). See M15-bots-and-mobile-ux.md's round 4 verification
// log for which of these were reachable and confirmed against this
// project's throwaway gateway, and which are pattern-only / not reachable
// from it.
const REFUSED_PATTERN = /ECONNREFUSED|ConnectException|Failed to connect/i
const TIMEOUT_PATTERN = /ETIMEDOUT|SocketTimeoutException|timed? ?out/i
const DNS_PATTERN = /ENOTFOUND|UnknownHostException|no address associated/i
const TLS_PATTERN = /SSLException|SSLHandshakeException|CertPathValidatorException|certificate/i
const UNAUTHORIZED_HANDSHAKE_PATTERN = /\b401\b/

export function classifyConnectReason(signal: ConnectFailureSignal): ConnectReason {
  const authClass = classifyFailure({ httpStatus: signal.httpStatus, wsCloseCode: signal.wsCloseCode })

  if (authClass === 'unauthorized') {
    return 'unauthorized'
  }

  if (authClass === 'forbidden') {
    return 'forbidden'
  }

  const message = signal.rawMessage

  if (!message) {
    return 'unreachable'
  }

  // A password-mode WS handshake never carries a parsed HTTP status (the
  // upgrade response isn't surfaced as one by RN's WebSocket) — this reuses
  // classifyFailure's 401 rule via the httpStatus branch above whenever a
  // caller CAN parse a status; this substring match only covers the WS
  // handshake's raw rejection text ("Expected HTTP 101 response but was
  // '401 ...'") when no parsed status is available.
  if (UNAUTHORIZED_HANDSHAKE_PATTERN.test(message)) {
    return 'unauthorized'
  }

  if (TLS_PATTERN.test(message)) {
    return 'tls'
  }

  if (DNS_PATTERN.test(message)) {
    return 'dns'
  }

  if (TIMEOUT_PATTERN.test(message)) {
    return 'timeout'
  }

  if (REFUSED_PATTERN.test(message)) {
    return 'refused'
  }

  return 'unreachable'
}

const REASON_TEXT: Record<ConnectReason, string> = {
  dns: "Couldn't find that host — check the address.",
  forbidden: 'Not permitted.',
  refused: 'Connection refused — is the host running?',
  timeout: 'Connection timed out.',
  tls: 'TLS/certificate error connecting to the host.',
  unauthorized: 'Authentication failed — check the password.',
  unreachable: 'Could not reach the host.'
}

export function describeConnectReason(reason: ConnectReason): string {
  return REASON_TEXT[reason]
}
