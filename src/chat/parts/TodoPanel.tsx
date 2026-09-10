import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../theme/provider'
import type { TodoItem } from '../../upstream/lib/todos'

const STATUS_GLYPH: Record<TodoItem['status'], string> = {
  pending: '☐',
  in_progress: '◐',
  completed: '☑',
  cancelled: '✗'
}

export interface TodoPanelProps {
  todos: TodoItem[]
}

/** The live todo list from the `todo` tool (`todo.updated` / `tool.*`). */
export function TodoPanel({ todos }: TodoPanelProps) {
  const tokens = useTheme()

  if (todos.length === 0) {
    return null
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
      {todos.map(todo => (
        <Text
          key={todo.id}
          numberOfLines={2}
          style={[
            styles.item,
            { color: tokens.cardForeground },
            todo.parent ? styles.nested : null,
            todo.status === 'completed' || todo.status === 'cancelled'
              ? [styles.completed, { color: tokens.mutedForeground }]
              : null
          ]}
        >
          {STATUS_GLYPH[todo.status] ?? '☐'} {todo.content}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  completed: {
    textDecorationLine: 'line-through'
  },
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    padding: 10
  },
  item: {
    fontSize: 13,
    paddingVertical: 2
  },
  nested: {
    paddingLeft: 16
  }
})
