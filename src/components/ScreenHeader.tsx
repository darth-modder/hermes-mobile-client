import type { ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { openDrawer } from '../store/drawer'
import { useTheme } from '../theme/provider'

interface ScreenHeaderProps {
  title: string
  right?: ReactNode
}

/** Shared header for the M10 drawer-level screens (Projects, Cron, Webhooks,
 *  Artifacts, Channels) — a hamburger that opens `AppDrawer` plus the screen
 *  title, matching `session-list.tsx`'s own header shape/colors so the
 *  drawer's destinations look like one consistent set of top-level screens. */
export function ScreenHeader({ right, title }: ScreenHeaderProps) {
  const tokens = useTheme()

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <TouchableOpacity hitSlop={12} onPress={openDrawer} style={styles.iconButton}>
          <Text style={[styles.icon, { color: tokens.mutedForeground }]}>☰</Text>
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
  icon: {
    fontSize: 20
  },
  iconButton: {
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
    fontSize: 20,
    fontWeight: '700'
  }
})
