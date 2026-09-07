// Per-session live todo list, derived from the reducer's SessionState.todos
// (src/gateway/session-stream/tool-upsert.ts, tools.ts) rather than tracked
// independently — the reducer is the source of truth, this is a convenience
// projection for a todos-only subscriber (a composer status row) that
// shouldn't have to depend on the whole session-states atom.

import { atom } from 'nanostores'

import type { ReducerState } from '../gateway/session-stream-reducer'
import type { TodoItem } from '../upstream/lib/todos'

export const $todosBySession = atom<Record<string, TodoItem[]>>({})

export function publishTodosFromReducerState(state: ReducerState): void {
  const next: Record<string, TodoItem[]> = {}

  for (const [id, session] of state.sessions) {
    if (session.todos.length > 0) {
      next[id] = session.todos
    }
  }

  $todosBySession.set(next)
}
