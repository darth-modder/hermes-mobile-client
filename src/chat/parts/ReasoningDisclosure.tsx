import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'
import { thoughtLabel, useMeasuredDuration } from '../reasoning-timer'

export interface ReasoningDisclosureProps {
  /** Whether the message this block belongs to is still streaming — the
   *  message-level flag, not just "this part has no completedAt yet", since a
   *  part left open by a dropped connection is a stale part, not a live one. */
  messagePending: boolean
  part: { completedAt?: number; text: string; timestamp?: number }
  /** Stable per-block key (`reasoning:${message.id}:${index}`) — the block's
   *  measured duration is remembered against this key (see reasoning-timer.ts),
   *  so a component that mounts after the block finished can still report it. */
  timerKey: string
}

/** Collapsed by default — reasoning is commentary, not the reply; matches
 *  the desktop's default-collapsed thinking block. The header label itself
 *  (Thinking/Thought/Thought briefly/Thought for {duration}) matches the
 *  desktop's own four-state `ThinkingDisclosure` (M14 close-out round 3, task
 *  1) — see reasoning-timer.ts for the state logic and its device-tested
 *  history. */
export function ReasoningDisclosure({ messagePending, part, timerKey }: ReasoningDisclosureProps) {
  const tokens = useTheme()
  const [expanded, setExpanded] = useState(false)

  // A part left open (no completedAt) by something other than this message
  // still streaming — a dropped connection, an interrupted turn — is stale,
  // not live: gating on messagePending too means it can never get stuck
  // reading "Thinking" forever. Matches the desktop's own `pending` (message
  // running AND the part itself not yet complete), message-parts.tsx:267-274.
  const pending = messagePending && part.completedAt === undefined
  const thoughtFor = useMeasuredDuration(pending, timerKey)

  if (!part.text.trim()) {
    return null
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={{ bottom: 14, top: 14 }}
        onPress={() => setExpanded(current => !current)}
        style={styles.header}
      >
        <Text style={[styles.headerText, { color: tokens.scaffoldText }]}>
          {expanded ? '▾' : '▸'} {thoughtLabel(pending, thoughtFor)}
        </Text>
      </TouchableOpacity>
      {expanded ? <Text style={[styles.body, { color: tokens.mutedForeground }]}>{part.text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    ...type.label,
    fontStyle: 'italic',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  container: {
    marginVertical: 2
  },
  header: {
    justifyContent: 'center',
    minHeight: 48
  },
  headerText: {
    ...type.caption,
    fontWeight: '600'
  }
})
