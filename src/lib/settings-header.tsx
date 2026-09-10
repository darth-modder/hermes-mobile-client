// Shared native-header look for every screen under app/(main)/settings/**.
// The (main) stack hides headers by default (app/(main)/_layout.tsx:
// `screenOptions={{ headerShown: false }}`) — a settings sub-screen needs its
// own header restored explicitly (`headerShown: true`) to get a visible
// title and back affordance, styled from the active theme rather than a
// fixed dark palette.
//
// A function, not a constant: `Stack.Screen options` is plain data (no
// hooks allowed inside it), so the caller's own `useTheme()` result is
// passed in rather than read here.

import type { MobileTokens } from '../theme/resolve'

export function settingsHeaderOptions(tokens: MobileTokens) {
  return {
    headerShown: true,
    headerStyle: { backgroundColor: tokens.background },
    headerTintColor: tokens.foreground
  } as const
}
