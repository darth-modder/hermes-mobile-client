// M14 primitive — docs/mobile-prototypes/primitives.html "ListRow" section
// (`.list-row` min 56 dp, title/sub left, value+chevron right),
// docs/DESKTOP-DESIGN.md §8 pattern for settings/list rows. Rows own the
// 16 dp gutter; separators between rows are a single hairline, added by the
// caller (`hair` style below), matching "flat, not boxed" (§2).
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'

export interface ListRowProps {
  accessibilityLabel?: string
  disabled?: boolean
  onPress?: () => void
  /** A trailing node — a chevron, a Switch, a value label. Overrides `value`. */
  right?: ReactNode
  subtitle?: string
  title: string
  value?: string
}

export function ListRow({ accessibilityLabel, disabled, onPress, right, subtitle, title, value }: ListRowProps) {
  const tokens = useTheme()

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { backgroundColor: tokens.rowActive } : null,
        disabled ? { opacity: 0.5 } : null
      ]}
    >
      <View style={styles.titles}>
        <Text style={[styles.title, { color: tokens.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.textTertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (value ? <Text style={[styles.value, { color: tokens.textTertiary }]}>{value}</Text> : null)}
      {onPress && !right ? <Text style={[styles.chevron, { color: tokens.textQuaternary }]}>{'›'}</Text> : null}
    </Pressable>
  )
}

export function ListRowSeparator() {
  const tokens = useTheme()

  return <View style={[styles.hair, { backgroundColor: tokens.strokeTertiary }]} />
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 18,
    lineHeight: 18
  },
  hair: {
    height: StyleSheet.hairlineWidth
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  subtitle: {
    ...type.caption
  },
  title: {
    ...type.body
  },
  titles: {
    flex: 1,
    gap: 2
  },
  value: {
    ...type.bodySmall
  }
})
