// M14 primitive — docs/mobile-prototypes/primitives.html "Button" section,
// docs/DESKTOP-DESIGN.md §8 ("Button"). Desktop variants survive; desktop
// sizes do not — every target here is the 48 dp minimum (M13 criterion 6),
// not the desktop's padding-only height. Only one size exists (no xs/sm/lg/
// icon-sm/icon-lg/icon-titlebar/inline/micro ladder): a phone form uses one
// full-width button shape, so those distinctions have nothing to attach to.
import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native'

import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export type ButtonVariant = 'danger' | 'ghost' | 'outline' | 'primary' | 'secondary'

export interface ButtonProps {
  accessibilityLabel?: string
  children?: ReactNode
  /** Full width — the only shape a phone form uses (`.btn--block`). */
  block?: boolean
  disabled?: boolean
  /** Renders as a bare 48×48 icon well (`.btn--icon`) instead of a labelled pill. */
  icon?: ReactNode
  loading?: boolean
  onPress?: () => void
  style?: ViewStyle
  variant?: ButtonVariant
}

export function Button({
  accessibilityLabel,
  block,
  children,
  disabled,
  icon,
  loading,
  onPress,
  style,
  variant = 'primary'
}: ButtonProps) {
  const tokens = useTheme()
  const isDisabled = disabled || loading

  const fill: Record<ButtonVariant, { background: string; foreground: string; ring?: string }> = {
    danger: { background: tokens.destructive, foreground: tokens.destructiveForeground },
    ghost: { background: 'transparent', foreground: tokens.textSecondary },
    outline: { background: 'transparent', foreground: tokens.textPrimary, ring: tokens.strokeSecondary },
    primary: { background: tokens.primary, foreground: tokens.primaryForeground },
    secondary: { background: tokens.bgQuaternary, foreground: tokens.textPrimary }
  }

  const { background, foreground, ring } = fill[variant]

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        icon ? styles.icon : styles.base,
        block ? styles.block : null,
        {
          backgroundColor: background,
          borderColor: ring,
          borderWidth: ring ? 1 : 0,
          borderRadius: icon ? radius.icon : radius.control,
          opacity: isDisabled ? 0.5 : 1
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : icon ? (
        icon
      ) : (
        <Text style={[styles.label, { color: foreground }]}>{children}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20
  },
  block: {
    width: '100%'
  },
  icon: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  label: {
    ...type.bodySmall,
    fontWeight: '500'
  }
})
