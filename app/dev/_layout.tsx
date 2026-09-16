// Gate for every `app/dev/*` route (M15 round 10, task 1).
//
// `app/dev/primitives.tsx` (M14's component story) and
// `app/dev/dictation-seam.tsx` (M15 round 9's transcript seam) were dev-only
// by convention only: expo-router registers every file under `app/`, so both
// were reachable by deep link in any build —
// `hermes-android://dev/primitives`, `hermes-android://dev/dictation-seam`.
// The seam's own override is already inert outside `__DEV__` (its guard lives
// in `src/voice/dev-transcript-seam.ts`, not at its caller, precisely so a
// route could not switch it on), so this layout is the second lock rather
// than the only one — but a shipped app should not render a debug screen at
// all, however harmless its contents.
//
// `_layout.tsx` is not itself a route, so this adds no screen: expo-router
// renders it around the routes in this directory, and `route-replicates.test
// .ts` skips it twice over (once for the `_layout.tsx` filename, once for the
// `dev/` prefix).
import { Redirect, Stack } from 'expo-router'

import { devRoutesEnabled } from '../../src/lib/dev-build'

export default function DevLayout() {
  // Redirect rather than render-nothing: an unresolved route leaves a blank
  // screen with no way back, and `/` is this app's own entry shim
  // (`app/index.tsx`), which forwards to the session list or /connect
  // depending on whether a connection is registered.
  if (!devRoutesEnabled()) {
    return <Redirect href="/" />
  }

  return <Stack />
}
