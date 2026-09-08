import { StyleSheet, Text, View } from 'react-native'

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
  if (todos.length === 0) {
    return null
  }

  return (
    <View style={styles.container}>
      {todos.map(todo => (
        <Text
          key={todo.id}
          numberOfLines={2}
          style={[
            styles.item,
            todo.parent ? styles.nested : null,
            todo.status === 'completed' || todo.status === 'cancelled' ? styles.completed : null
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
    color: '#6a737d',
    textDecorationLine: 'line-through'
  },
  container: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    padding: 10
  },
  item: {
    color: '#f2f2f5',
    fontSize: 13,
    paddingVertical: 2
  },
  nested: {
    paddingLeft: 16
  }
})
