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
// spec, `clearCookies: (callback: (result: boolean) => void) => void`), kept
// reachable through the PUBLIC `NativeModules` export rather than a deep
// `react-native/Libraries/...` import: Opus's round-2 review flagged that a
// deep import is deprecated in recent RN and may resolve differently (or
// not at all) in a release bundle, where `NativeModules.Networking` is the
// same module the RN-internal RCTNetworking wrapper itself ultimately calls
// through the legacy bridge interop.
//
// UNVERIFIED either way: whether this actually empties OkHttp's cookie jar
// on this RN version. That needs a device check (a ws-ticket POST after
// sign-out shown returning 401) this session could not run (the user could
// not interact with the emulator). Because the clear is global, not
// per-host, signOutConnection (logout.ts) marks every OTHER password-mode
// connection needsLogin in the same action, so what the app shows stays
// true even before that device check lands.

import { NativeModules } from 'react-native'

interface NetworkingNativeModule {
  clearCookies: (callback: (result: boolean) => void) => void
}

function resolveNetworkingModule(): NetworkingNativeModule | null {
  const candidate = (NativeModules as { Networking?: Partial<NetworkingNativeModule> }).Networking

  return typeof candidate?.clearCookies === 'function' ? (candidate as NetworkingNativeModule) : null
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
  const networking = resolveNetworkingModule()

  if (!networking) {
    console.log('[cookie-clear] no reachable Networking native module — skipped')

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
      ? '[cookie-clear] clearCookies completed'
      : `[cookie-clear] clearCookies timed out after ${CLEAR_COOKIES_TIMEOUT_MS}ms — the native callback never fired`
  )
}
