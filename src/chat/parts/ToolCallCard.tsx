import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ChevronDown, ChevronRight } from '../../lib/icons'
import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

import { CodeBlock } from './CodeBlock'

export interface ToolCallPart {
  toolCallId?: string
  toolName: string
  args?: Record<string, unknown>
  result?: unknown
  isError?: boolean
  completedAt?: number
}

function stringField(record: unknown, key: string): string | undefined {
  if (!record || typeof record !== 'object') {
    return undefined
  }

  const value = (record as Record<string, unknown>)[key]

  return typeof value === 'string' && value ? value : undefined
}

/**
 * Collapsible tool-call card: name + running/complete/error state, an
 * optional preview/summary line, and an expandable body with the raw args
 * and (once complete) the inline diff or result. Running is inferred the
 * same way the reducer's own tool-parts.ts does — no result yet means still
 * running (see tool-parts.ts's upsertToolPart: "complete" is only ever
 * stamped alongside a result/completedAt/isError, never on its own).
 */
export function ToolCallCard({ part }: { part: ToolCallPart }) {
  const tokens = useTheme()
  const [expanded, setExpanded] = useState(false)
  const running = part.completedAt === undefined
  const preview = stringField(part.args, 'preview') ?? stringField(part.args, 'context')
  const summary = stringField(part.result, 'summary') ?? stringField(part.result, 'message')
  const inlineDiff = stringField(part.result, 'inline_diff')

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.widgetSurface,
          borderColor: part.isError ? tokens.destructive : tokens.border
        }
      ]}
    >
      <TouchableOpacity
        accessibilityLabel={`${part.toolName} tool call`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={{ bottom: 14, top: 14 }}
        onPress={() => setExpanded(current => !current)}
        style={styles.header}
      >
        {running ? <ActivityIndicator color={tokens.mutedForeground} size="small" style={styles.spinner} /> : null}
        <Text style={[styles.name, { color: tokens.foreground }]}>{part.toolName}</Text>
        {part.isError ? (
          <Text
            style={[styles.errorBadge, { backgroundColor: tokens.destructive, color: tokens.destructiveForeground }]}
          >
            error
          </Text>
        ) : null}
        {expanded ? (
          <ChevronDown color={tokens.textTertiary} size={14} />
        ) : (
          <ChevronRight color={tokens.textTertiary} size={14} />
        )}
      </TouchableOpacity>
      {preview ? (
        <Text numberOfLines={expanded ? undefined : 2} style={[styles.preview, { color: tokens.mutedForeground }]}>
          {preview}
        </Text>
      ) : null}
      {summary ? <Text style={[styles.summary, { color: tokens.mutedForeground }]}>{summary}</Text> : null}
      {expanded ? (
        <View style={styles.body}>
          {part.args ? <CodeBlock code={JSON.stringify(part.args, null, 2)} language="json" /> : null}
          {inlineDiff ? <CodeBlock code={inlineDiff} language="diff" /> : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    marginTop: 6
  },
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginVertical: 4,
    padding: 10
  },
  errorBadge: {
    ...type.caption,
    borderRadius: radius.icon,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48
  },
  name: {
    ...type.mono,
    flex: 1,
    fontWeight: '600'
  },
  preview: {
    ...type.caption,
    marginTop: 4
  },
  spinner: {
    marginRight: 2
  },
  summary: {
    ...type.caption,
    marginTop: 4
  }
})
