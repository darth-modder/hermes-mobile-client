// M14 primitive — "Popover, dropdown, context menu → bottom-sheet action
// list, same items in the same order" (M14 adaptation table); right-click
// becomes long-press. docs/mobile-prototypes/primitives.html "Sheet"
// section's `.sheet-item` (min 48 dp, `.is-active` primary text,
// `.is-danger` destructive text) is this list's row shape.
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'

import { Sheet } from './Sheet'

export interface MenuItem {
  active?: boolean
  danger?: boolean
  icon?: ReactNode
  key: string
  label: string
  onPress: () => void
  subtitle?: string
}

export interface MenuProps {
  items: readonly MenuItem[]
  onClose: () => void
  title?: string
  visible: boolean
}

export function Menu({ items, onClose, title, visible }: MenuProps) {
  const tokens = useTheme()

  return (
    <Sheet onClose={onClose} title={title} visible={visible}>
      {items.map(item => {
        const color = item.danger ? tokens.destructive : item.active ? tokens.primary : tokens.foreground

        return (
          <Pressable
            key={item.key}
            onPress={() => {
              onClose()
              item.onPress()
            }}
            style={({ pressed }) => [styles.item, pressed ? { backgroundColor: tokens.rowActive } : null]}
          >
            {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
            <View style={styles.labels}>
              <Text style={[styles.label, { color }]}>{item.label}</Text>
              {item.subtitle ? (
                <Text style={[styles.subtitle, { color: tokens.textTertiary }]}>{item.subtitle}</Text>
              ) : null}
            </View>
          </Pressable>
        )
      })}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    width: 20
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8
  },
  label: {
    ...type.body
  },
  labels: {
    flex: 1,
    gap: 2
  },
  subtitle: {
    ...type.caption
  }
})
