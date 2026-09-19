// Opus's review of D24's fix round: app/connect/[id]/login.tsx used to build
// a bare MobileConnection from scratch on every successful sign-in, and
// registerConnection (registry.ts) only ever carries `primary` over from an
// old entry on its own. Re-signing in to an EXISTING connection (the
// gateway-card "Sign in" action, needsLogin: true) therefore silently
// dropped headerNames (proxy-header connections) and anything else not
// rebuilt here. Pure and tested so the merge itself can be asserted without
// a component-rendering test harness, which this project doesn't have.

import type { MobileConnection } from './types'

export interface PasswordSignInResult {
  id: string
  baseUrl: string
  label: string
  provider: string
}

/** Merge a successful password sign-in onto `existing` (null for a fresh Add
 *  — there's nothing to preserve then). Every field passed in `result` wins;
 *  everything else — headerNames, installId, org, primary — carries over
 *  from `existing` untouched. `needsLogin` always resolves to `false`: a
 *  sign-in that reached this point already succeeded. */
export function mergeSignedInConnection(
  existing: MobileConnection | null,
  result: PasswordSignInResult
): MobileConnection {
  return {
    ...existing,
    id: result.id,
    kind: 'remote',
    label: result.label || existing?.label || result.baseUrl,
    baseUrl: result.baseUrl,
    authMode: 'password',
    provider: result.provider,
    needsLogin: false,
    lastUsedAt: Date.now()
  }
}
