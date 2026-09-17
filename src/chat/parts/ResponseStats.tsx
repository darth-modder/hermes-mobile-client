import { StyleSheet, Text } from 'react-native'

import { compactNumber } from '../../lib/format'
import { responseStatsLine } from '../../lib/strings.mobile'
import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'
import type { ChatMessageWithExtras } from '../message-extras'

/**
 * Per-message stats line (M15 B, task 2): model · Σ tokens · tok/s, under a
 * settled assistant message — docs/mobile-prototypes/chat.html:112-113's
 * `.msg-stats`. Shown only when THIS message carries its own `usage`
 * (message-stream.ts's `completeAssistantMessage` stamps it from
 * `message.complete`'s own `usage` field) — a message hydrated from history
 * never has one (the backend doesn't persist it onto a stored row), so it
 * renders nothing, matching the exit criterion's "a transcript row from
 * before the feature shows none."
 *
 * `avg_tps` (not a client-side tokens/durationS division) is the same field
 * the desktop's own tokensPerSecondLabel reads
 * (apps/desktop/src/lib/statusbar.tsx:72-76: "the rolling throughput") —
 * the backend already computes it server-side
 * (tui_gateway `_get_usage`, per that field's own doc comment on
 * UsageStats.avg_tps, src/upstream/types/hermes.ts:738-739).
 */
export function ResponseStats({ message }: { message: ChatMessageWithExtras }) {
  const tokens = useTheme()
  const usage = message.usage

  if (!usage || !(usage.total && usage.total > 0)) {
    return null
  }

  const tokPerSecond =
    typeof usage.avg_tps === 'number' && Number.isFinite(usage.avg_tps) && usage.avg_tps > 0
      ? usage.avg_tps.toFixed(1)
      : null

  return (
    <Text style={[styles.text, { color: tokens.mutedForeground }]}>
      {responseStatsLine(message.model || null, compactNumber(usage.total), tokPerSecond)}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: {
    ...type.caption,
    marginTop: 2,
    paddingHorizontal: 2
  }
})
