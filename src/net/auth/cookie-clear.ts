// D27 point 3 (Fable's ruling via Opus): password mode's session lives in a
// cookie in RN's native cookie jar (OkHttp on Android) — upstream tokens are
// stateless, and nothing else in src/ or app/ ever clears cookies (checked:
// every other git grep hit for "cookie" is a comment). If POST /auth/logout
// fails (offline, host down), that cookie survives untouched, and the next
// redial mints a fresh ws-ticket over it while the UI says "needs sign-in".
//
// Per-host clearing needs a native module this app doesn't have. The only
// option without adding one is RN's own global clear — the underlying
// TurboModule is `Networking` (react-native's own NativeNetworkingAndroid
// spec, `clearCookies: (callback: (result: boolean) => void) => void`).
//
// Opus's round-2 review: a deep `react-native/Libraries/...` import is
// deprecated in recent RN and may resolve differently (or not at all) in a
// release bundle — dropped in favor of the public API. Opus's round-3
// review: on the New Architecture / bridgeless mode (RN 0.86+),
// `NativeModules.Networking` (the legacy bridge proxy) is not guaranteed to
// have the module even when it's genuinely registered — TurboModules there
// are only reliably reachable through `TurboModuleRegistry`, which itself
// checks the bridgeless proxy first and falls back to the legacy
// `NativeModules` lookup internally (see node_modules/react-native/
// Libraries/TurboModule/TurboModuleRegistry.js's `requireModule`). Resolved
// here in that same order — `TurboModuleRegistry.get('Networking')` first,
// `NativeModules.Networking` as an explicit second attempt in case some RN
// version's TurboModuleRegistry doesn't itself do that fallback — and the
// source that actually worked (or "none") is logged alongside the race
// outcome below, so a device run shows directly which path resolved it
// instead of only inferring it from whether cookies actually cleared.
//
// UNVERIFIED either way: whether this actually empties OkHttp's cookie jar
// on this RN version. That needs a device check (a ws-ticket POST after
// sign-out shown returning 401) this session could not run (the user could
// not interact with the emulator). Because the clear is global, not
// per-host, signOutConnection (logout.ts) marks every OTHER password-mode
// connection needsLogin in the same action, so what the app shows stays
// true even before that device check lands.

import { NativeModules, TurboModuleRegistry } from 'react-native'

interface NetworkingNativeModule {
  clearCookies: (callback: (result: boolean) => void) => void
}

function isNetworkingModule(candidate: unknown): candidate is NetworkingNativeModule {
  return typeof (candidate as Partial<NetworkingNativeModule> | null)?.clearCookies === 'function'
}

type NetworkingSource = 'NativeModules' | 'TurboModuleRegistry' | 'none'

/** Never throws — a lookup that fails or throws is treated the same as one
 *  that simply found nothing, so a defensive wrapper here doesn't have to
 *  live at every call site. */
function tryResolve(lookup: () => unknown): NetworkingNativeModule | null {
  try {
    const candidate = lookup()

    return isNetworkingModule(candidate) ? candidate : null
  } catch {
    return null
  }
}

function resolveNetworkingModule(): { module: NetworkingNativeModule | null; source: NetworkingSource } {
  const viaTurboModules = tryResolve(() =>
    (TurboModuleRegistry as { get?: (name: string) => unknown }).get?.('Networking')
  )

  if (viaTurboModules) {
    return { module: viaTurboModules, source: 'TurboModuleRegistry' }
  }

  const viaNativeModules = tryResolve(() => (NativeModules as { Networking?: unknown }).Networking)

  if (viaNativeModules) {
    return { module: viaNativeModules, source: 'NativeModules' }
  }

  return { module: null, source: 'none' }
}

/** Opus's round-2 review: the native callback might never fire (an
 *  unresponsive bridge, a native module that silently no-ops) — without a
 *  bound, sign-out would hang forever waiting for it. Not a device-measured
 *  number, just generous enough that a real device never hits it under
 *  normal conditions. */
const CLEAR_COOKIES_TIMEOUT_MS = 3_000

/** Best-effort: never throws or rejects, and never waits longer than
 *  `CLEAR_COOKIES_TIMEOUT_MS`. A failure or a timeout is not
 *  distinguishable from "this call didn't actually clear anything" —
 *  either way part 2's needsLogin gate still holds outbound traffic, and
 *  callers mark every other password-mode connection needsLogin
 *  regardless of whether this actually cleared anything. */
export async function clearAllCookies(): Promise<void> {
  const { module: networking, source } = resolveNetworkingModule()

  if (!networking) {
    console.log(`[cookie-clear] source=${source} — no reachable Networking module, skipped`)

    return
  }

  const cleared = new Promise<'cleared'>(resolve => {
    try {
      networking.clearCookies(() => resolve('cleared'))
    } catch {
      resolve('cleared')
    }
  })

  const timedOut = new Promise<'timed-out'>(resolve => {
    setTimeout(() => resolve('timed-out'), CLEAR_COOKIES_TIMEOUT_MS)
  })

  const outcome = await Promise.race([cleared, timedOut])

  console.log(
    outcome === 'cleared'
      ? `[cookie-clear] source=${source} — clearCookies completed`
      : `[cookie-clear] source=${source} — clearCookies timed out after ${CLEAR_COOKIES_TIMEOUT_MS}ms, the native callback never fired`
  )
}
