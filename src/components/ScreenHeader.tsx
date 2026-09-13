import { IconMenu2 } from '@tabler/icons-react-native'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ChevronLeft, MoreVertical } from '../lib/icons'
import { OPEN_MENU_ACCESSIBILITY_LABEL, SCREEN_HEADER_MORE_ACCESSIBILITY_LABEL } from '../lib/strings.mobile'
import { openDrawer } from '../store/drawer'
import { useTheme } from '../theme/provider'
import { type } from '../theme/type'

import { Menu, type MenuItem } from './ui/Menu'

export interface ScreenHeaderAction {
  accessibilityLabel: string
  icon: ReactNode
  onPress: () => void
}

interface ScreenHeaderProps {
  title: string
  /** Back arrow instead of the drawer hamburger — for a stack-detail screen. */
  onBack?: () => void
  right?: ReactNode
  /** M14 "ScreenHeader 56 dp: back, title, up to two actions; overflow into
   *  a bottom-sheet menu" — the first two render inline, the rest collapse
   *  behind a single "More" button that opens a `Menu` sheet, same order. */
  actions?: readonly ScreenHeaderAction[]
}

const MAX_INLINE_ACTIONS = 2

/** Shared 56 dp header for every top-level and stack-detail screen: the
 *  drawer hamburger (or a back arrow) plus the screen title, matching
 *  `session-list.tsx`'s own header shape/colors so every screen the drawer
 *  reaches looks like one consistent set. `IconMenu2` isn't in
 *  `src/lib/icons.ts`'s alias table — the desktop has no hamburger (a
 *  persistent sidebar, not a drawer) — so it's imported directly from the
 *  Tabler package here. */
export function ScreenHeader({ actions = [], onBack, right, title }: ScreenHeaderProps) {
  const tokens = useTheme()
  const [overflowOpen, setOverflowOpen] = useState(false)
  const inlineActions = actions.slice(0, MAX_INLINE_ACTIONS)
  const overflowActions = actions.slice(MAX_INLINE_ACTIONS)

  const overflowItems: MenuItem[] = overflowActions.map((action, index) => ({
    icon: action.icon,
    key: `${index}-${action.accessibilityLabel}`,
    label: action.accessibilityLabel,
    onPress: action.onPress
  }))

  return (
    <View style={[styles.header, { backgroundColor: tokens.background }]}>
      <View style={styles.left}>
        <TouchableOpacity
          accessibilityLabel={onBack ? 'Back' : OPEN_MENU_ACCESSIBILITY_LABEL}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack ?? openDrawer}
          style={styles.iconButton}
        >
          {onBack ? (
            <ChevronLeft color={tokens.foreground} size={24} />
          ) : (
            <IconMenu2 color={tokens.mutedForeground} size={20} />
          )}
        </TouchableOpacity>
        <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
          {title}
        </Text>
      </View>
      <View style={styles.right}>
        {right}
        {inlineActions.map(action => (
          <TouchableOpacity
            accessibilityLabel={action.accessibilityLabel}
            accessibilityRole="button"
            hitSlop={12}
            key={action.accessibilityLabel}
            onPress={action.onPress}
            style={styles.iconButton}
          >
            {action.icon}
          </TouchableOpacity>
        ))}
        {overflowActions.length > 0 ? (
          <TouchableOpacity
            accessibilityLabel={SCREEN_HEADER_MORE_ACCESSIBILITY_LABEL}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => setOverflowOpen(true)}
            style={styles.iconButton}
          >
            <MoreVertical color={tokens.foreground} size={20} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Menu items={overflowItems} onClose={() => setOverflowOpen(false)} visible={overflowOpen} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 8
  },
  iconButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  left: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4
  },
  right: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  title: {
    ...type.title,
    flexShrink: 1,
    fontWeight: '700'
  }
})
