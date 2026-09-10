import { IconMenu2 } from '@tabler/icons-react-native'
import type { ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { openDrawer } from '../store/drawer'
import { useTheme } from '../theme/provider'
import { type } from '../theme/type'

interface ScreenHeaderProps {
  title: string
  right?: ReactNode
}

/** Shared header for the M10 drawer-level screens (Projects, Cron, Webhooks,
 *  Artifacts, Channels) — a hamburger that opens `AppDrawer` plus the screen
 *  title, matching `session-list.tsx`'s own header shape/colors so the
 *  drawer's destinations look like one consistent set of top-level screens.
 *  `IconMenu2` isn't in src/lib/icons.ts's alias table — the desktop has no
 *  hamburger (a persistent sidebar, not a drawer) — so it's imported
 *  directly from the Tabler package here. */
export function ScreenHeader({ right, title }: ScreenHeaderProps) {
  const tokens = useTheme()

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <TouchableOpacity
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          hitSlop={12}
          onPress={openDrawer}
          style={styles.iconButton}
        >
          <IconMenu2 color={tokens.mutedForeground} size={20} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: tokens.foreground }]}>{title}</Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  iconButton: {
    minHeight: 44,
    minWidth: 44,
    padding: 4
  },
  left: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  right: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  title: {
    ...type.title,
    fontWeight: '700'
  }
})
