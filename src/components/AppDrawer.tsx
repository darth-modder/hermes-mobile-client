import { useStore } from '@nanostores/react'
import { IconHierarchy2, IconMessages, IconPuzzle, IconRobot } from '@tabler/icons-react-native'
import { type Href, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getAudience } from '../lib/audience'
import {
  Clock,
  FileImage,
  FolderOpen,
  type IconComponent,
  LayoutDashboard,
  Link,
  MessageCircle,
  Settings,
  Users
} from '../lib/icons'
import { $drawerOpen, closeDrawer } from '../store/drawer'
import { useTheme } from '../theme/provider'
import { type } from '../theme/type'

import { drawerRowsForAudience } from './drawer-rows'

const DRAWER_WIDTH = 300

interface DrawerRow {
  // `string`, not `Href` — see drawer-rows.ts's DrawerRowMeta for why; cast
  // back to `Href` at the one call site that actually navigates with it.
  route: string
  title: string
  value?: string
  Icon: IconComponent
}

/**
 * D16/M15A note: `IconPuzzle`/`IconMessages`/`IconHierarchy2`/`IconRobot` aren't in
 * `src/lib/icons.ts`'s generated alias table — like `ScreenHeader`'s
 * `IconMenu2`, the desktop's own icon module has no alias for a concept it
 * doesn't need (a persistent sidebar has no drawer to iconify), so these are
 * imported straight from the Tabler package rather than hand-edited into a
 * generated file.
 *
 * The order/route/title triples live in `./drawer-rows.ts` (pure, no
 * react-native import — see that file's header for why the split exists:
 * drawer-rows.test.ts needs to import the order without dragging in
 * react-native's own Flow-typed entry point, which vitest's transform can't
 * parse). Icons stay here since they DO need react-native/Tabler.
 */
const DRAWER_ICONS: Record<string, IconComponent> = {
  '/(main)/agents': IconHierarchy2,
  '/(main)/artifacts': FileImage,
  '/(main)/bots': IconRobot,
  '/(main)/channels': MessageCircle,
  '/(main)/command-center': LayoutDashboard,
  '/(main)/tasks': Clock,
  '/(main)/projects': FolderOpen,
  '/(main)/session-list': IconMessages,
  '/(main)/settings': Settings,
  '/(main)/settings/profiles': Users,
  '/(main)/settings/skills': IconPuzzle,
  '/(main)/webhooks': Link
}

export const DRAWER_ROWS: DrawerRow[] = drawerRowsForAudience(getAudience()).map(row => ({
  ...row,
  Icon: DRAWER_ICONS[row.route]
}))

/** Slide-out navigation overlay, mounted once in `app/(main)/_layout.tsx`
 *  alongside the `Stack` (see `src/store/drawer.ts` for why this isn't
 *  `expo-router/drawer`). Renders nothing (not even an inert View) once
 *  closed and settled, so it never eats touches meant for the screen under
 *  it. */
export function AppDrawer() {
  const tokens = useTheme()
  const open = useStore($drawerOpen)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const mounted = useRef(false)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { duration: 220, toValue: open ? 0 : -DRAWER_WIDTH, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { duration: 220, toValue: open ? 1 : 0, useNativeDriver: true })
    ]).start()
  }, [backdropOpacity, open, translateX])

  if (!open && !mounted.current) {
    return null
  }

  mounted.current = open

  const navigate = (route: string) => {
    closeDrawer()
    router.push(route as Href)
  }

  return (
    <View pointerEvents={open ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      {/* Round 11's zero-height backdrop: this View had only `backgroundColor`
          — no explicit size — and its one child was `position: 'absolute'`,
          which is removed from layout and can't establish a parent size on
          its own. The View collapsed to 0×0, so the scrim never painted and
          the tap-outside-to-close target didn't exist. `StyleSheet.
          absoluteFill` on this View itself (matching its sibling `panel`'s
          parent) is what was missing. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable onPress={closeDrawer} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: tokens.sidebar,
            borderRightColor: tokens.sidebarBorder,
            paddingBottom: insets.bottom,
            paddingTop: insets.top + 12,
            transform: [{ translateX }]
          }
        ]}
      >
        <Text style={[styles.heading, { color: tokens.mutedForeground }]}>Hermes</Text>
        {DRAWER_ROWS.map(row => (
          <TouchableOpacity
            accessibilityLabel={row.title}
            accessibilityRole="button"
            key={row.title}
            onPress={() => navigate(row.route)}
            style={styles.row}
          >
            <View style={styles.rowIcon}>
              <row.Icon color={tokens.mutedForeground} size={20} />
            </View>
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{row.title}</Text>
            {row.value ? <Text style={[styles.rowValue, { color: tokens.textTertiary }]}>{row.value}</Text> : null}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  // A modal scrim dims the whole screen uniformly regardless of the active
  // skin — every platform's own scrim convention (Material Design's included)
  // is a fixed black at a set opacity, not a theme colour, so this is
  // intentionally not a token.
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.667)'
  },
  heading: {
    ...type.caption,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 20,
    textTransform: 'uppercase'
  },
  panel: {
    borderRightWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: DRAWER_WIDTH
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 2,
    minHeight: 48,
    paddingHorizontal: 20
  },
  rowIcon: {
    alignItems: 'center',
    width: 22
  },
  rowTitle: {
    ...type.body,
    flex: 1,
    fontWeight: '600'
  },
  rowValue: {
    ...type.caption
  }
})
