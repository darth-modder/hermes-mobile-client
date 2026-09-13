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
//
// M13 Step 8 (task D, navigation): the native back arrow only ever returns
// one screen up the stack, so a settings screen reached by drilling in from
// elsewhere doesn't get you to the session list in one tap — headerRight
// adds the same drawer hamburger every other top-level screen has
// (AppDrawer, mounted once in app/(main)/_layout.tsx, so `openDrawer()`
// always reaches the same overlay), so "Sessions" is always the drawer tap
// away, regardless of how deep the back-stack is.

import { IconMenu2 } from '@tabler/icons-react-native'
import { TouchableOpacity } from 'react-native'

import { openDrawer } from '../store/drawer'
import type { MobileTokens } from '../theme/resolve'

import { OPEN_MENU_ACCESSIBILITY_LABEL } from './strings.mobile'

export function settingsHeaderOptions(tokens: MobileTokens) {
  return {
    headerRight: () => (
      <TouchableOpacity
        accessibilityLabel={OPEN_MENU_ACCESSIBILITY_LABEL}
        accessibilityRole="button"
        hitSlop={12}
        onPress={openDrawer}
        style={{ alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 }}
      >
        <IconMenu2 color={tokens.foreground} size={20} />
      </TouchableOpacity>
    ),
    headerShown: true,
    headerStyle: { backgroundColor: tokens.background },
    headerTintColor: tokens.foreground
  } as const
}
