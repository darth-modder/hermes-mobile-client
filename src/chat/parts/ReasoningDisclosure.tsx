import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'

export interface ReasoningDisclosureProps {
  text: string
}

/** Collapsed by default — reasoning is commentary, not the reply; matches
 *  the desktop's default-collapsed thinking block. */
export function ReasoningDisclosure({ text }: ReasoningDisclosureProps) {
  const tokens = useTheme()
  const [expanded, setExpanded] = useState(false)

  if (!text.trim()) {
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
          {expanded ? '▾ Reasoning' : '▸ Reasoning'}
        </Text>
      </TouchableOpacity>
      {expanded ? <Text style={[styles.body, { color: tokens.mutedForeground }]}>{text}</Text> : null}
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
    paddingVertical: 2
  },
  headerText: {
    ...type.caption,
    fontWeight: '600'
  }
})
