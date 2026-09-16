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

/**
 * The track-and-thumb picture on its own, with no `Pressable` and no
 * accessibility identity of its own — two plain `View`s, so it contributes
 * **no node at all** to the tree `uiautomator` walks.
 *
 * Split out in M15 round 13 for rows that are themselves the switch. React
 * Native's own `Switch` renders a native `android.widget.Switch`, and that
 * widget reports `clickable="true"` at its own ~46.5×27 dp regardless of what
 * the JS side asks for: round 12 tried `pointerEvents="none"` and
 * `importantForAccessibility` on the Switch, then both on a wrapping `View`
 * with `no-hide-descendants`, then `accessible={false}` + `focusable={false}`,
 * and the dump still carried
 * `[916,742][1038,813] class=android.widget.Switch clickable=true` inside the
 * non-clickable wrapper. None of those props reach a native widget that is not
 * a `ReactViewGroup`. Drawing the control instead is the only way the node
 * stops existing — see `CapabilitiesSheet.tsx`'s row.
 */
export function SwitchIndicator({ disabled, value }: { disabled?: boolean; value: boolean }) {
  const tokens = useTheme()

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: value ? tokens.primary : tokens.bgQuaternary,
          borderRadius: radius.full,
          opacity: disabled ? 0.5 : 1
        }
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
  )
}

export function Switch({ accessibilityLabel, disabled, onValueChange, value }: SwitchProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
    >
      <SwitchIndicator disabled={disabled} value={value} />
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
