import { StyleSheet, Text, View } from 'react-native'

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
  if (!usage || usage.total <= 0) {
    return null
  }

  const contextPercent = usage.context_percent

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{formatTokens(usage.total)} tok</Text>
      {typeof contextPercent === 'number' ? (
        <Text style={styles.text}> · {Math.round(contextPercent)}% ctx</Text>
      ) : null}
      {typeof usage.cost_usd === 'number' && usage.cost_usd > 0 ? (
        <Text style={styles.text}> · ${usage.cost_usd.toFixed(3)}</Text>
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
    color: '#6a737d',
    fontSize: 11
  }
})
