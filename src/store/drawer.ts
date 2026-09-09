/** Open/closed state for the app-wide navigation drawer (M10 task: "Drawer
 *  navigation in `app/(main)/_layout.tsx`"). A plain atom + a custom overlay
 *  component (`src/components/AppDrawer.tsx`) rather than
 *  `expo-router/drawer`/`@react-navigation/drawer`: that navigator turns
 *  every top-level route in the group into a drawer *screen*, which would
 *  mean re-homing `sessions/[id]` and `settings/**` under a nested stack —
 *  changing the route paths M09 already shipped and verified
 *  (`router.push('/(main)/settings/index')`, the
 *  `hermes-android://settings/<screen>` deep links) for a milestone that
 *  only needs a slide-out menu, not nested per-section history. `Stack`
 *  keeps owning real navigation; the drawer is just an overlay that calls
 *  the same `router.push` every screen already uses. */

import { atom } from 'nanostores'

export const $drawerOpen = atom(false)

export function openDrawer(): void {
  $drawerOpen.set(true)
}

export function closeDrawer(): void {
  $drawerOpen.set(false)
}
