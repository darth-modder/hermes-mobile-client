import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useTheme } from '../theme/provider'
import { type } from '../theme/type'

export interface CompletionRow {
  display: string
  meta: string
  text: string
}

export interface CompletionListProps {
  rows: readonly CompletionRow[]
  onSelect: (text: string) => void
}

/** Shared presentation for the `/`-command palette (SlashPalette.tsx) and
 *  `@`-file/folder reference completion (Composer.tsx) — both ride the same
 *  `{display, meta, text}` item shape off the wire (`complete.slash` /
 *  `complete.path`, `tui_gateway/methods_complete.py`'s shared `_item()`). */
export function CompletionList({ rows, onSelect }: CompletionListProps) {
  const tokens = useTheme()

  if (rows.length === 0) {
    return null
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.popover, borderColor: tokens.border }]}>
      {rows.slice(0, 8).map(row => (
        <TouchableOpacity
          key={row.text}
          onPress={() => onSelect(row.text)}
          style={[styles.row, { borderBottomColor: tokens.border }]}
        >
          <Text style={[styles.command, { color: tokens.popoverForeground }]}>{row.display || row.text}</Text>
          {row.meta ? (
            <Text numberOfLines={1} style={[styles.meta, { color: tokens.mutedForeground }]}>
              {row.meta}
            </Text>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  command: {
    ...type.mono,
    fontWeight: '600'
  },
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    maxHeight: 220,
    overflow: 'hidden'
  },
  meta: {
    ...type.caption,
    flexShrink: 1,
    marginLeft: 8
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  }
})
