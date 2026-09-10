import { useStore } from '@nanostores/react'
import { type Href, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { $drawerOpen, closeDrawer } from '../store/drawer'
import { useTheme } from '../theme/provider'

const DRAWER_WIDTH = 260

interface DrawerRow {
  route: Href
  title: string
  icon: string
}

// M10 task: "Drawer navigation in app/(main)/_layout.tsx: Sessions,
// Projects, Cron, Webhooks, Artifacts, Channels, Settings." Routes use the
// bare folder+index alias (`/(main)/projects`, not `/(main)/projects/index`)
// — the form that typechecks against THIS worktree's freshly regenerated
// `.expo/types/router.d.ts` (`npx expo start`, once, to produce it; `expo
// export` alone does not). M09 hit the opposite mismatch after merging to
// `main` (`/(main)/settings/index` typechecked in its own worktree but not
// against main's regenerated types, fixed to the bare alias post-merge) —
// AGENTS.md/D12 name this as a known, environment-sensitive flake and say
// explicitly not to assume either form survives a merge. Flagged again here
// in M10-management-screens.md's Deviations for Opus's re-verification pass.
const ROWS: DrawerRow[] = [
  { icon: '💬', route: '/(main)/session-list', title: 'Sessions' },
  { icon: '📁', route: '/(main)/projects', title: 'Projects' },
  { icon: '⏱', route: '/(main)/cron', title: 'Cron' },
  { icon: '🔗', route: '/(main)/webhooks', title: 'Webhooks' },
  { icon: '🖼', route: '/(main)/artifacts', title: 'Artifacts' },
  { icon: '📡', route: '/(main)/channels', title: 'Channels' },
  { icon: '⚙', route: '/(main)/settings', title: 'Settings' }
]

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

  const navigate = (route: Href) => {
    closeDrawer()
    router.push(route)
  }

  return (
    <View pointerEvents={open ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable onPress={closeDrawer} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: tokens.sidebar,
            borderRightColor: tokens.sidebarBorder,
            paddingTop: insets.top + 12,
            transform: [{ translateX }]
          }
        ]}
      >
        <Text style={[styles.heading, { color: tokens.mutedForeground }]}>Hermes</Text>
        {ROWS.map(row => (
          <TouchableOpacity key={row.title} onPress={() => navigate(row.route)} style={styles.row}>
            <Text style={styles.rowIcon}>{row.icon}</Text>
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{row.title}</Text>
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
    fontSize: 12,
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
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  rowIcon: {
    fontSize: 18,
    width: 22
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600'
  }
})
