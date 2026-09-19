// D24 part 1.3: Add connection must not create a duplicate for a URL that
// normalises equal to an existing connection's. Opus saw on device that
// re-adding the same URL leaves the old entry orphaned beside a new one —
// what a locked-out person does first. Pure and tested; app/connect/index.tsx
// uses this to resolve the id it dials/persists with instead of always
// minting a fresh one.

import type { MobileConnection } from './types'

const DEFAULT_PORT_BY_SCHEME: Record<string, string> = { 'http:': '80', 'https:': '443' }

/** Fable's D27 rule, verbatim: scheme and host lower-cased, the scheme's
 *  default port dropped, trailing slash dropped, path otherwise kept (case
 *  preserved — a path can be case-sensitive on the server, unlike scheme and
 *  host). Falls back to the old trim-and-lowercase behaviour if `url` isn't a
 *  parseable URL at all, so a still-being-typed address never throws. */
export function normalizeGatewayUrl(url: string): string {
  const trimmed = url.trim()

  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed.replace(/\/+$/, '').toLowerCase()
  }

  const scheme = parsed.protocol.toLowerCase()
  const host = parsed.hostname.toLowerCase()
  const isDefaultPort = !parsed.port || parsed.port === DEFAULT_PORT_BY_SCHEME[scheme]
  const port = isDefaultPort ? '' : `:${parsed.port}`
  const path = parsed.pathname.replace(/\/+$/, '')

  return `${scheme}//${host}${port}${path}${parsed.search}`
}

export function findConnectionByUrl(url: string, connections: readonly MobileConnection[]): MobileConnection | null {
  const target = normalizeGatewayUrl(url)

  return connections.find(c => normalizeGatewayUrl(c.baseUrl) === target) ?? null
}
