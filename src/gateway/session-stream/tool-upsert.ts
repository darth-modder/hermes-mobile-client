// Pure port of the tool-call half of apps/desktop's `upsertToolCall`
// (.../use-message-stream/index.ts): patches/seeds the tool-call part AND, for
// a `todo`-named tool, mirrors the snapshot into `session.todos`.
//
// Dropped relative to the desktop version (see message-stream.ts / tools.ts
// file headers for the general rationale): composer-status background-process
// refresh, skill-suggestion-cache invalidation, MCP-repair-suggestion
// reporting, tool-diff recording, workspace-file-tree refresh, and delegate/
// subagent panel tracking — all desktop-only surfaces this client doesn't have.

import { type GatewayEventPayload, upsertToolPart } from '../../upstream/lib/chat-messages'
import { dedupeGeneratedImageEchoesInParts } from '../../upstream/lib/generated-images'
import { nextTodosFromToolEvent, parseTodoRevision } from '../../upstream/lib/todos'

import { mutateStreamingMessage } from './mutate-stream'
import type { SessionState } from './types'

function applyTodoSnapshot(session: SessionState, payload: GatewayEventPayload): SessionState {
  const nextTodos = nextTodosFromToolEvent(session.todos, payload)

  if (nextTodos === null) {
    return session
  }

  const revision = parseTodoRevision(payload)

  // tool.start carries no revision — apply and leave the watermark alone so a
  // later todo.updated / tool.complete can still win (mirrors the desktop's
  // acceptRevision: a null revision always applies).
  if (revision !== null && session.todosRevision !== null && revision < session.todosRevision) {
    return session
  }

  return { ...session, todos: nextTodos, todosRevision: revision ?? session.todosRevision }
}

export function upsertToolCall(
  session: SessionState,
  payload: GatewayEventPayload | undefined,
  phase: 'running' | 'complete',
  occurredAt: number = Date.now() / 1000
): SessionState {
  if (session.interrupted) {
    return session
  }

  const withTodos = payload?.name === 'todo' ? applyTodoSnapshot(session, payload) : session

  return mutateStreamingMessage(
    withTodos,
    parts => dedupeGeneratedImageEchoesInParts(upsertToolPart(parts, payload, phase, occurredAt)),
    () => upsertToolPart([], payload, phase, occurredAt),
    { pending: m => phase !== 'complete' || (m.pending ?? false) },
    occurredAt
  )
}
