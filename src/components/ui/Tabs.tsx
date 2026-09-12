// M14 primitive — not drawn in docs/mobile-prototypes/primitives.html (no
// M14 screen consumes it yet: Capabilities' desktop tabs become three
// settings rows instead, per the screen mapping), built from
// docs/DESKTOP-DESIGN.md §8 ("Tabs: list 36px, muted, p-1; trigger 28px …
// active background plus shadow-xs") scaled the same way SegmentedControl
// is — the desktop's variant survives, hitSlop brings the 40 dp trigger to
// the 48 dp minimum (M13 criterion 6).
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export interface TabItem<T extends string> {
  label: string
  value: T
}

export interface TabsProps<T extends string> {
  onChange: (value: T) => void
  tabs: readonly TabItem<T>[]
  value: T
}

export function Tabs<T extends string>({ onChange, tabs, value }: TabsProps<T>) {
  const tokens = useTheme()

  return (
    <View style={[styles.list, { backgroundColor: tokens.bgTertiary, borderRadius: radius.control }]}>
      {tabs.map(tab => {
        const active = tab.value === value

        return (
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ bottom: 4, top: 4 }}
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[
              styles.trigger,
              active ? { backgroundColor: tokens.background, elevation: 1, shadowOpacity: 0.15 } : null
            ]}
          >
            <Text style={[styles.label, { color: active ? tokens.foreground : tokens.textSecondary }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    ...type.bodySmall,
    fontWeight: '500'
  },
  list: {
    flexDirection: 'row',
    gap: 2,
    padding: 4
  },
  trigger: {
    alignItems: 'center',
    borderRadius: radius.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40
  }
})
