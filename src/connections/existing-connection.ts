// D24 part 1.3: Add connection must not create a duplicate for a URL that
// normalises equal to an existing connection's. Opus saw on device that
// re-adding the same URL leaves the old entry orphaned beside a new one —
// what a locked-out person does first. Pure and tested; app/connect/index.tsx
// uses this to resolve the id it dials/persists with instead of always
// minting a fresh one.

import type { MobileConnection } from './types'

/** Base URLs carry no path in this app, so a case-insensitive compare plus a
 *  trailing-slash strip is enough to catch the re-typed-URL case without
 *  false positives (unlike a generic URL normalizer, this never touches
 *  query strings or auth — gateway URLs have none). */
export function normalizeGatewayUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

export function findConnectionByUrl(url: string, connections: readonly MobileConnection[]): MobileConnection | null {
  const target = normalizeGatewayUrl(url)

  return connections.find(c => normalizeGatewayUrl(c.baseUrl) === target) ?? null
}
