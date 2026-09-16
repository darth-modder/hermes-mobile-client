// Pure gesture-math half of TabStrip.tsx — no react-native/react-native-gesture-handler import,
// so the edge-band and one-step-clamp tests (TabStrip.test.ts) can import it directly. Importing
// TabStrip.tsx itself into a vitest `.test.ts` doesn't work in this project: react-native's own
// package entry point is Flow-typed and vitest's Node/esbuild transform chokes on it the moment
// anything pulls in the real package rather than the test stub (vitest.config.ts's alias only
// catches bare `from 'react-native'` imports, not what expo-router/react-native-gesture-handler
// reach for transitively) — the same reason `drawer-rows.ts` exists as its own file
// (`drawer-rows.ts`'s own header) and this codebase has no other `.tsx` component tests.
//
// M15 round 16, group E task 1: the tab-strip edge race. Round 15's `onEnd`-only guard let a
// single injected swipe advance the active tab by two instead of the one step `SWIPE_THRESHOLD_PX`
// crossed once should produce. `isInEdgeBand` and `stepFor` are the whole decision now — the
// former also enforced structurally by `TabStrip.tsx`'s `hitSlop({ left: -EDGE_GUARD_PX })`, so a
// touch starting in the band is never offered to the gesture at all, not merely refused after
// activating — so a unit test on these two functions is a unit test on the fix itself.

export const SWIPE_THRESHOLD_PX = 60
export const EDGE_GUARD_PX = 40

/** A touch starting this close to the left edge is left for the system/`react-native-screens`
 *  back gesture, not claimed here. */
export function isInEdgeBand(startX: number): boolean {
  return startX < EDGE_GUARD_PX
}

/** At most one tab per gesture, regardless of how large `translationX` is — a swipe of 600px moves
 *  one tab, the same as a swipe of 61px. */
export function stepFor(translationX: number): -1 | 0 | 1 {
  if (translationX < -SWIPE_THRESHOLD_PX) {
    return 1
  }

  if (translationX > SWIPE_THRESHOLD_PX) {
    return -1
  }

  return 0
}
