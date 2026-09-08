import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

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
  if (rows.length === 0) {
    return null
  }

  return (
    <View style={styles.container}>
      {rows.slice(0, 8).map(row => (
        <TouchableOpacity key={row.text} onPress={() => onSelect(row.text)} style={styles.row}>
          <Text style={styles.command}>{row.display || row.text}</Text>
          {row.meta ? (
            <Text numberOfLines={1} style={styles.meta}>
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
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600'
  },
  container: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    maxHeight: 220,
    overflow: 'hidden'
  },
  meta: {
    color: '#8a8a99',
    flexShrink: 1,
    fontSize: 12,
    marginLeft: 8
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#2a2a33',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8
  }
})
