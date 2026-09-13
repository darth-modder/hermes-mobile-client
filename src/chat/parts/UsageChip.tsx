import { StyleSheet, Text, View } from 'react-native'

import { USAGE_CHIP_CONTEXT_SUFFIX } from '../../lib/strings.mobile'
import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'
import type { UsageStats } from '../../upstream/types/hermes'

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`
  }

  return String(n)
}

export interface UsageChipProps {
  usage: null | UsageStats
}

/** Token usage + context-window pressure for the session (`session.usage`). */
export function UsageChip({ usage }: UsageChipProps) {
  const tokens = useTheme()

  if (!usage || usage.total <= 0) {
    return null
  }

  const contextPercent = usage.context_percent

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: tokens.mutedForeground }]}>{formatTokens(usage.total)} tok</Text>
      {typeof contextPercent === 'number' ? (
        <Text style={[styles.text, { color: tokens.mutedForeground }]}>
          {' '}
          · {Math.round(contextPercent)}
          {USAGE_CHIP_CONTEXT_SUFFIX}
        </Text>
      ) : null}
      {typeof usage.cost_usd === 'number' && usage.cost_usd > 0 ? (
        <Text style={[styles.text, { color: tokens.mutedForeground }]}> · ${usage.cost_usd.toFixed(3)}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  text: {
    ...type.caption
  }
})
