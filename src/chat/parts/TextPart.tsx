import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Markdown, { type ASTNode, type RenderRules } from 'react-native-markdown-display'

import { type MobileTokens, useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

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
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  body: {
    ...type.body
  },
  code_inline: {
    borderRadius: radius.icon,
    ...type.mono
  }
})

function buildMarkdownStyles(tokens: MobileTokens) {
  return {
    blockquote: {
      ...markdownStyles.blockquote,
      backgroundColor: tokens.muted,
      borderLeftColor: tokens.border
    },
    body: {
      ...markdownStyles.body,
      color: tokens.foreground
    },
    code_inline: {
      ...markdownStyles.code_inline,
      backgroundColor: tokens.inlineCodeBackground,
      color: tokens.inlineCodeForeground
    },
    link: {
      color: tokens.primary
    }
  }
}

const MarkdownBlock = memo(
  function MarkdownBlock({
    text,
    themedStyles
  }: {
    text: string
    themedStyles: ReturnType<typeof buildMarkdownStyles>
  }) {
    return (
      <Markdown rules={renderRules} style={themedStyles}>
        {text}
      </Markdown>
    )
  },
  (prev, next) => prev.text === next.text && prev.themedStyles === next.themedStyles
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
  const tokens = useTheme()
  const blocks = useMemo(() => splitMarkdownBlocks(text), [text])
  const themedStyles = useMemo(() => buildMarkdownStyles(tokens), [tokens])

  return (
    <View>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} text={block} themedStyles={themedStyles} />
      ))}
    </View>
  )
}
