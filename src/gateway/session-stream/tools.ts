// Pure port of apps/desktop's gateway-event/tools.ts: tool.generating /
// tool.start / tool.progress / tool.complete / todo.updated / subagent.*.
//
// Dropped relative to the desktop handler — all desktop-only surfaces this
// client doesn't have (see tool-upsert.ts's header for the full list), plus:
//   - `tool.generating`'s transient "drafting a tool call" status line
//     (setSessionDraftingTool) — a nice-to-have typing indicator with no
//     state slot in this milestone's SessionState; left for M06 if wanted.
//   - subagent/delegate panel tracking (upsertSubagent) — desktop's
//     `@/store/subagents` UI. `subagent.*`/`delegate.*` are still consumed
//     here (marked handled) so they don't fall through as unrouted.

import { parseTodoRevision, parseTodos } from '../../upstream/lib/todos'

import { type FamilyHandler, handled, notHandled } from './context'
import { flushSessionDeltas } from './delta-queue'
import { updateSession } from './session-keys'
import { upsertToolCall } from './tool-upsert'

const SUBAGENT_EVENT_TYPES = new Set([
  'subagent.spawn_requested',
  'subagent.start',
  'subagent.thinking',
  'subagent.tool',
  'subagent.progress',
  'subagent.complete'
])

const DELEGATE_EVENT_TYPES = new Set(['delegate.running', 'delegate.complete'])

export const handleToolEvent: FamilyHandler = (state, ctx) => {
  const { event, payload, storedSessionId, occurredAt } = ctx

  if (event.type === 'todo.updated') {
    if (!storedSessionId) {
      return handled(state)
    }

    const { state: withUpdate } = updateSession(state, storedSessionId, session => {
      if (session.interrupted) {
        return session
      }

      const todos = parseTodos(payload)

      if (todos === null) {
        return session
      }

      const revision = parseTodoRevision(payload)

      // An unused store serializes as {todos: [], revision: 0} — not a real
      // snapshot; applying it would stamp watermark 0 and blank the list.
      if (todos.length === 0 && (revision === null || revision === 0)) {
        return session
      }

      if (revision !== null && session.todosRevision !== null && revision < session.todosRevision) {
        return session
      }

      return { ...session, todos, todosRevision: revision ?? session.todosRevision }
    })

    return handled(withUpdate)
  }

  if (event.type === 'tool.generating') {
    return handled(state)
  }

  if (event.type === 'tool.start' || event.type === 'tool.progress') {
    if (!storedSessionId) {
      return handled(state)
    }

    let next = flushSessionDeltas(state, storedSessionId)

    next = updateSession(next, storedSessionId, session =>
      upsertToolCall(session, payload, 'running', occurredAt)
    ).state

    return handled(next)
  }

  if (event.type === 'tool.complete') {
    if (!storedSessionId) {
      return handled(state)
    }

    let next = flushSessionDeltas(state, storedSessionId)

    next = updateSession(next, storedSessionId, session => {
      const upserted = upsertToolCall(session, payload, 'complete', occurredAt)

      return upserted.needsInput ? { ...upserted, needsInput: false } : upserted
    }).state

    return handled(next)
  }

  if (SUBAGENT_EVENT_TYPES.has(event.type) || DELEGATE_EVENT_TYPES.has(event.type)) {
    return handled(state)
  }

  return notHandled(state)
}
