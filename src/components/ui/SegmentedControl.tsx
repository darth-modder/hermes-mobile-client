// M14 primitive — docs/mobile-prototypes/primitives.html "SegmentedControl"
// section (`.seg` track, `.seg__opt` option 40 dp), docs/DESKTOP-DESIGN.md
// §8 ("SegmentedControl: track bg-tertiary p-0.5 rounded-[5px] … active is
// background fill, foreground text, shadow-sm"). Three options maximum at
// 360 dp (prototype note) — this doesn't scroll or wrap.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export interface SegmentedOption<T extends string> {
  label: string
  value: T
}

export interface SegmentedControlProps<T extends string> {
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  value: T
}

export function SegmentedControl<T extends string>({ onChange, options, value }: SegmentedControlProps<T>) {
  const tokens = useTheme()

  return (
    <View style={[styles.track, { backgroundColor: tokens.bgTertiary, borderRadius: radius.control }]}>
      {options.map(option => {
        const active = option.value === value

        return (
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            hitSlop={{ bottom: 4, top: 4 }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, active ? { backgroundColor: tokens.background } : null]}
          >
            <Text style={[styles.label, { color: active ? tokens.foreground : tokens.textSecondary }]}>
              {option.label}
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
  option: {
    alignItems: 'center',
    borderRadius: radius.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14
  },
  track: {
    flexDirection: 'row',
    gap: 2,
    padding: 3
  }
})
