// Mirrors apps/desktop/src/components/ui/codicon.tsx: the desktop renders a
// codicon as a `<i class="codicon codicon-<name>">` glyph from the codicon
// web font; this renders the same glyph from the same font file (bundled
// under assets/fonts/codicon.ttf, loaded via expo-font — see
// src/lib/fonts.ts) as plain Text, since React Native has no CSS ::before
// content. `CODICON_GLYPHS` (src/components/codicon-map.ts) is generated
// from @vscode/codicons' own name -> codepoint table, so a name ports 1:1
// between the two surfaces.

import { StyleSheet, Text, type TextStyle } from 'react-native'

import { CODICON_GLYPHS, type CodiconName } from './codicon-map'

export interface CodiconProps {
  name: CodiconName
  size?: number
  color?: string
  /** Required when the icon is the only content of a tappable control (no
   *  adjacent label text) — TalkBack has nothing else to read. Omit for a
   *  purely decorative icon sitting next to its own text label. */
  accessibilityLabel?: string
  style?: TextStyle
}

export function Codicon({ accessibilityLabel, color, name, size = 16, style }: CodiconProps) {
  const glyph = CODICON_GLYPHS[name]

  if (!glyph) {
    throw new Error(`Codicon: unknown icon name "${name}" — check src/components/codicon-map.ts`)
  }

  return (
    <Text
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[styles.glyph, { color, fontSize: size }, style]}
    >
      {glyph}
    </Text>
  )
}

const styles = StyleSheet.create({
  glyph: {
    fontFamily: 'codicon'
  }
})
