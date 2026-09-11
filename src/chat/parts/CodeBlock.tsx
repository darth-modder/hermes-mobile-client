import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { type MobileTokens, useTheme } from '../../theme/provider'
import { MONO_BOLD_FONT_FAMILY, radius, type as typeRoles } from '../../theme/type'

import { highlightCode } from './highlight'

// hljs class name -> semantic token. M13 (D14): no private syntax palette —
// every colour comes from tokens.semantic.* (Appendix A.5), grouped the same
// way the desktop's atom-one-dark-ish mapping grouped them (keyword/purple,
// string/green, number/orange, ...). Checked most-specific-first (a token can
// carry several ancestor classes at once — e.g. a function name nested inside
// `hljs-title.function_`), so the lookup below scans the run's class list in
// reverse.
function classStyles(tokens: MobileTokens): Record<string, { color?: string; italic?: boolean; bold?: boolean }> {
  return {
    'hljs-comment': { color: tokens.mutedForeground, italic: true },
    'hljs-quote': { color: tokens.mutedForeground, italic: true },
    'hljs-meta': { color: tokens.mutedForeground },
    'hljs-keyword': { color: tokens.semantic.purple },
    'hljs-selector-tag': { color: tokens.semantic.purple },
    'hljs-subst': { color: tokens.semantic.purple },
    'hljs-literal': { color: tokens.semantic.orange },
    'hljs-number': { color: tokens.semantic.orange },
    'hljs-variable': { color: tokens.semantic.orange },
    'hljs-template-variable': { color: tokens.semantic.orange },
    'hljs-attribute': { color: tokens.semantic.orange },
    'hljs-tag': { color: tokens.semantic.red },
    'hljs-name': { color: tokens.semantic.red },
    'hljs-symbol': { color: tokens.semantic.red },
    'hljs-bullet': { color: tokens.semantic.red },
    'hljs-deletion': { color: tokens.semantic.red },
    'hljs-string': { color: tokens.semantic.green },
    'hljs-doctag': { color: tokens.semantic.green },
    'hljs-addition': { color: tokens.semantic.green },
    'hljs-title': { color: tokens.semantic.blue, bold: true },
    'hljs-section': { color: tokens.semantic.blue, bold: true },
    'hljs-selector-id': { color: tokens.semantic.blue },
    'hljs-type': { color: tokens.semantic.yellow },
    'hljs-class': { color: tokens.semantic.yellow },
    'hljs-built_in': { color: tokens.semantic.cyan },
    'hljs-builtin-name': { color: tokens.semantic.cyan },
    'hljs-regexp': { color: tokens.semantic.cyan },
    'hljs-link': { color: tokens.semantic.cyan },
    'hljs-emphasis': { italic: true },
    'hljs-strong': { bold: true }
  }
}

function styleForClasses(
  classColors: Record<string, { color?: string; italic?: boolean; bold?: boolean }>,
  classNames: string[]
): { color?: string; fontStyle?: 'italic'; fontFamily?: string } | undefined {
  for (let i = classNames.length - 1; i >= 0; i--) {
    const match = classColors[classNames[i]]

    if (match) {
      return {
        color: match.color,
        ...(match.italic ? { fontStyle: 'italic' as const } : {}),
        // Bold tokens (hljs-title/hljs-section/hljs-strong) need the bundled
        // bold monospace face by name, not `fontWeight: 'bold'` — RN doesn't
        // synthesise bold for a custom font, and every run in this component
        // is already monospace (styles.text), so this is a clean 1:1 swap.
        ...(match.bold ? { fontFamily: MONO_BOLD_FONT_FAMILY } : {})
      }
    }
  }

  return undefined
}

export interface CodeBlockProps {
  code: string
  language?: string
}

/** Syntax-highlighted, horizontally scrollable code block. lowlight-backed —
 *  no shiki/WebAssembly (Hermes has neither, M02). */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const tokens = useTheme()
  const parsed = highlightCode(code, language)
  const classColors = useMemo(() => classStyles(tokens), [tokens])

  return (
    <View style={[styles.container, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={[styles.text, { color: tokens.cardForeground }]}>
          {parsed.map((token, index) => (
            <Text key={index} style={styleForClasses(classColors, token.className)}>
              {token.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginVertical: 4,
    padding: 10
  },
  text: {
    ...typeRoles.mono
  }
})
