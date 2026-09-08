import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { highlightCode } from './highlight'

// A compact atom-one-dark-style palette keyed by hljs class name. Checked
// most-specific-first (a token can carry several ancestor classes at once —
// e.g. a function name nested inside `hljs-title.function_`), so the lookup
// below scans the run's class list in reverse.
const CLASS_COLORS: Record<string, { color?: string; italic?: boolean; bold?: boolean }> = {
  'hljs-comment': { color: '#6a737d', italic: true },
  'hljs-quote': { color: '#6a737d', italic: true },
  'hljs-keyword': { color: '#c678dd' },
  'hljs-selector-tag': { color: '#c678dd' },
  'hljs-subst': { color: '#c678dd' },
  'hljs-literal': { color: '#d19a66' },
  'hljs-number': { color: '#d19a66' },
  'hljs-variable': { color: '#d19a66' },
  'hljs-template-variable': { color: '#d19a66' },
  'hljs-tag': { color: '#e06c75' },
  'hljs-name': { color: '#e06c75' },
  'hljs-attribute': { color: '#d19a66' },
  'hljs-string': { color: '#98c379' },
  'hljs-doctag': { color: '#98c379' },
  'hljs-title': { color: '#61afef', bold: true },
  'hljs-section': { color: '#61afef', bold: true },
  'hljs-selector-id': { color: '#61afef' },
  'hljs-type': { color: '#e5c07b' },
  'hljs-class': { color: '#e5c07b' },
  'hljs-built_in': { color: '#56b6c2' },
  'hljs-builtin-name': { color: '#56b6c2' },
  'hljs-regexp': { color: '#56b6c2' },
  'hljs-link': { color: '#56b6c2' },
  'hljs-symbol': { color: '#e06c75' },
  'hljs-bullet': { color: '#e06c75' },
  'hljs-meta': { color: '#6a737d' },
  'hljs-deletion': { color: '#e06c75' },
  'hljs-addition': { color: '#98c379' },
  'hljs-emphasis': { italic: true },
  'hljs-strong': { bold: true }
}

function styleForClasses(classNames: string[]): { color?: string; fontStyle?: 'italic'; fontWeight?: 'bold' } | undefined {
  for (let i = classNames.length - 1; i >= 0; i--) {
    const match = CLASS_COLORS[classNames[i]]

    if (match) {
      return {
        color: match.color,
        ...(match.italic ? { fontStyle: 'italic' as const } : {}),
        ...(match.bold ? { fontWeight: 'bold' as const } : {})
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
  const tokens = highlightCode(code, language)

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={styles.text}>
          {tokens.map((token, index) => (
            <Text key={index} style={styleForClasses(token.className)}>
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
    backgroundColor: '#161b22',
    borderColor: '#2a2a33',
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: 4,
    padding: 10
  },
  text: {
    color: '#c9d1d9',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18
  }
})
