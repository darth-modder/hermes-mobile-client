// D27 point 3 (Fable's ruling via Opus): password mode's session lives in a
// cookie in RN's native cookie jar (OkHttp on Android) — upstream tokens are
// stateless, and nothing else in src/ or app/ ever clears cookies (checked:
// every other git grep hit for "cookie" is a comment). If POST /auth/logout
// fails (offline, host down), that cookie survives untouched, and the next
// redial mints a fresh ws-ticket over it while the UI says "needs sign-in".
//
// Per-host clearing needs a native module this app doesn't have. The only
// option without adding one is RN's own global clear, confirmed to exist at
// this exact path — RCTNetworking.android.js:100, `clearCookies(callback)`
// -> `NativeNetworkingAndroid.clearCookies` — but UNVERIFIED whether it
// actually empties OkHttp's jar on this RN version; that needs a device
// check (a ws-ticket POST after sign-out shown returning 401) this session
// could not run (the user could not interact with the emulator). Because
// the clear is global, not per-host, signOutConnection (logout.ts) marks
// every OTHER password-mode connection needsLogin in the same action, so
// what the app shows stays true even before that device check lands.

import RCTNetworking from 'react-native/Libraries/Network/RCTNetworking'

/** Best-effort: never throws or rejects. A failure here is not
 *  distinguishable from "this RN version's native module doesn't support
 *  it" — either way part 2's needsLogin gate still holds outbound traffic,
 *  and callers mark every other password-mode connection needsLogin
 *  regardless of whether this actually cleared anything. */
export async function clearAllCookies(): Promise<void> {
  try {
    await new Promise<void>(resolve => {
      RCTNetworking.clearCookies(() => resolve())
    })
  } catch {
    // best-effort — see header.
  }
}
