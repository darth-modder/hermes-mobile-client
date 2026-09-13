// M14 primitive — docs/mobile-prototypes/primitives.html "Switch" section
// (`.switch` 44×26, thumb 20), docs/DESKTOP-DESIGN.md §8 ("Switch: fully
// round … track background 58% into input, primary fill when on"). Always
// meant to sit inside a 56 dp ListRow — the row is the tap target, not the
// switch itself, so this has no hitSlop of its own.
import { Pressable, StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { radius } from '../../theme/type'

export interface SwitchProps {
  accessibilityLabel?: string
  disabled?: boolean
  onValueChange: (value: boolean) => void
  value: boolean
}

export function Switch({ accessibilityLabel, disabled, onValueChange, value }: SwitchProps) {
  const tokens = useTheme()

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={[
          styles.track,
          { backgroundColor: value ? tokens.primary : tokens.bgQuaternary, borderRadius: radius.full }
        ]}
      >
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: tokens.background,
              borderRadius: radius.full,
              transform: [{ translateX: value ? 18 : 0 }]
            }
          ]}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  thumb: {
    height: 20,
    left: 3,
    position: 'absolute',
    top: 3,
    width: 20
  },
  track: {
    height: 26,
    width: 44
  }
})
