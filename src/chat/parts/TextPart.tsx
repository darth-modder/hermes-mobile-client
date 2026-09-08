import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Markdown, { type ASTNode, type RenderRules } from 'react-native-markdown-display'

import { CodeBlock } from './CodeBlock'
import { splitMarkdownBlocks } from './markdown-blocks'

// Math/mermaid render as plain code fences in v1 (M06 task line) — no KaTeX
// or mermaid renderer wired up, so a ```math``` or ```mermaid``` block just
// falls through to the same highlighted (language-less) code block as any
// other fence.
const renderRules: RenderRules = {
  fence: (node, _children, _parent, _styles, inheritedStyles = {}) => {
    const language = (node as unknown as { info?: string }).info?.trim().split(/\s+/)[0]
    const content = node.content.endsWith('\n') ? node.content.slice(0, -1) : node.content

    return <CodeBlock code={content} key={node.key} language={language} />
  },
  code_block: (node: ASTNode) => {
    const content = node.content.endsWith('\n') ? node.content.slice(0, -1) : node.content

    return <CodeBlock code={content} key={node.key} />
  }
}

const markdownStyles = StyleSheet.create({
  blockquote: {
    backgroundColor: '#17171d',
    borderLeftColor: '#2a2a33',
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  body: {
    color: '#f2f2f5',
    fontSize: 15
  },
  code_inline: {
    backgroundColor: '#161b22',
    borderRadius: 4,
    color: '#e5c07b',
    fontFamily: 'monospace'
  },
  link: {
    color: '#58a6ff'
  }
})

const MarkdownBlock = memo(
  function MarkdownBlock({ text }: { text: string }) {
    return (
      <Markdown rules={renderRules} style={markdownStyles}>
        {text}
      </Markdown>
    )
  },
  (prev, next) => prev.text === next.text
)

export interface TextPartProps {
  text: string
}

/**
 * Renders assistant/user markdown text, split into top-level blocks
 * (markdown-blocks.ts) so a streaming reply's per-delta update only
 * re-parses the still-open tail block — every earlier, already-closed block
 * keeps its previously rendered output (M06 task line: "only the streaming
 * tail re-parses").
 */
export function TextPart({ text }: TextPartProps) {
  const blocks = useMemo(() => splitMarkdownBlocks(text), [text])

  return (
    <View>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} text={block} />
      ))}
    </View>
  )
}
