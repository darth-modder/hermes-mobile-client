// M14 primitive — docs/mobile-prototypes/primitives.html "Input" section,
// docs/DESKTOP-DESIGN.md §8 ("Controls"). Wraps a label + control + hint/
// error the way the desktop's `.field` groups them; the label is the
// desktop's 11px uppercase field label, hint/error are caption-role text.
// Focus shows as the border colour (`.input.is-focused`) — no focus ring,
// same as the desktop (§8 "Focus").
import { useState } from 'react'
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export interface InputProps extends TextInputProps {
  error?: string
  hint?: string
  label?: string
}

export function Input({ error, hint, label, style, ...inputProps }: InputProps) {
  const tokens = useTheme()
  const [focused, setFocused] = useState(false)
  const borderColor = error ? tokens.destructive : focused ? tokens.composerRing : tokens.border

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: tokens.textTertiary }]}>{label}</Text> : null}
      <TextInput
        onBlur={event => {
          setFocused(false)
          inputProps.onBlur?.(event)
        }}
        onFocus={event => {
          setFocused(true)
          inputProps.onFocus?.(event)
        }}
        placeholderTextColor={tokens.textQuaternary}
        style={[
          styles.input,
          { backgroundColor: tokens.card, borderColor, color: tokens.foreground, borderRadius: radius.control },
          style
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: tokens.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  error: {
    ...type.caption
  },
  field: {
    gap: 6
  },
  hint: {
    ...type.caption
  },
  input: {
    ...type.body,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  }
})
