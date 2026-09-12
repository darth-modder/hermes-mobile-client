// M14 primitive — docs/mobile-prototypes/primitives.html "Badge" section,
// docs/DESKTOP-DESIGN.md §8 ("Badge: 3px radius … Variants: default, muted,
// success (emerald), warn (amber), destructive"). `outline`/`solid` (desktop)
// and the `overlay` dot/count size have no mobile screen using them yet, so
// they're not built ahead of a caller.
import { StyleSheet, Text, type TextStyle } from 'react-native'

import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export type BadgeVariant = 'danger' | 'default' | 'good' | 'muted' | 'warn'

export interface BadgeProps {
  children: string
  style?: TextStyle
  variant?: BadgeVariant
}

export function Badge({ children, style, variant = 'default' }: BadgeProps) {
  const tokens = useTheme()

  // 14% alpha as a hex suffix (0.14 * 255 ≈ 24 in hex) — the semantic colours
  // are plain `#rrggbb` tokens with no pre-mixed "at N%" variant of their own.
  const fill: Record<BadgeVariant, { background: string; foreground: string }> = {
    danger: { background: tokens.diffRemoveBackground, foreground: tokens.destructive },
    default: { background: tokens.bgPrimary, foreground: tokens.primary },
    good: { background: tokens.diffAddBackground, foreground: tokens.semantic.green },
    muted: { background: tokens.bgTertiary, foreground: tokens.textSecondary },
    warn: { background: `${tokens.semantic.yellow}24`, foreground: tokens.semantic.yellow }
  }

  const { background, foreground } = fill[variant]

  return (
    <Text
      style={[styles.badge, { backgroundColor: background, borderRadius: radius.control, color: foreground }, style]}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  badge: {
    ...type.caption,
    fontWeight: '500',
    lineHeight: 16,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2
  }
})
