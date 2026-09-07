// Pure port of apps/desktop's gateway-event/status.ts (status.update tail) +
// the portable core of desktop-bridge.ts's `message.reaction` (M05 omits
// desktop-bridge.ts wholesale, but keeps this one event because it's on
// M05's required catalog and its core logic — find a message by row id,
// paint reactions — has nothing desktop-specific in it).
//
// Dropped relative to the desktop handlers: agent-notice credits banner
// wiring, disk-full/provider-setup-error onboarding prompts, native OS
// notification dispatch (push belongs to M11), billing-state query
// invalidation (no query client here), pet activity, `status.update` kinds
// "process" (composer-status background-process refresh, a terminal/machine
// feature — AGENTS.md) and "goal" (desktop goal-tracking store, unbuilt here).

import { type ChatMessage, textPart } from '../../upstream/lib/chat-messages'

import { type FamilyHandler, handled, notHandled } from './context'
import { flushSessionDeltas } from './delta-queue'
import { applyFailAssistantMessage } from './message-stream'
import { updateSession } from './session-keys'
import { coerceGatewayText } from './text-coercion'
import type { Effect, ReducerState } from './types'

function appendSystemMessage(
  state: ReducerState,
  storedSessionId: string,
  id: string,
  text: string,
  occurredAt: number
) {
  return updateSession(state, storedSessionId, session => ({
    ...session,
    messages: [
      ...session.messages,
      { id, role: 'system', parts: [textPart(text, occurredAt)], timestamp: occurredAt } satisfies ChatMessage
    ]
  })).state
}

export const handleStatusEvent: FamilyHandler = (state, ctx) => {
  const { event, payload, storedSessionId, occurredAt } = ctx

  if (event.type === 'status.update') {
    if (!storedSessionId) {
      return handled(state)
    }

    if (payload?.kind === 'compacting') {
      const next = updateSession(state, storedSessionId, session => ({ ...session, compacting: true })).state

      return handled({ ...next, compactedTurns: new Set(next.compactedTurns).add(storedSessionId) })
    }

    if (payload?.kind === 'compacted') {
      const next = updateSession(state, storedSessionId, session => ({ ...session, compacting: false })).state
      const compactedTurns = new Set(next.compactedTurns)

      compactedTurns.delete(storedSessionId)

      const session = next.sessions.get(storedSessionId)
      const effects: Effect[] = []

      // A compress that finished with no live turn has no turn-end settle
      // path to refresh the transcript — hydrate now or the summarized
      // bubbles never appear.
      if (session && !session.busy && !session.awaitingResponse && !session.streamId) {
        effects.push({ type: 'hydrate', storedSessionId, runtimeSessionId: ctx.runtimeSessionId, attempts: 3 })
      }

      return handled({ ...next, compactedTurns }, effects)
    }

    return handled(state)
  }

  if (event.type === 'btw.complete' || event.type === 'background.complete') {
    if (!storedSessionId) {
      return handled(state)
    }

    const text = coerceGatewayText(payload?.text).trim()

    if (!text) {
      return handled(state)
    }

    const taskId = String(payload?.task_id ?? '').trim()
    const question = event.type === 'btw.complete' ? coerceGatewayText(payload?.question).trim() : ''
    const label = event.type === 'btw.complete' ? 'btw' : 'background'
    const header = `[${label}${question ? ` "${question}"` : ''}${taskId ? ` (${taskId})` : ''}]`

    // Text deltas flush on a timer but a system aside applies now — flush
    // first so it can't jump ahead of text that preceded it.
    let next = flushSessionDeltas(state, storedSessionId)

    next = appendSystemMessage(
      next,
      storedSessionId,
      `${label}-complete-${taskId || Date.now()}`,
      `${header}\n${text}`,
      occurredAt
    )

    return handled(next)
  }

  if (event.type === 'notification.show') {
    const key =
      typeof (payload as { key?: unknown } | undefined)?.key === 'string' ? (payload as { key: string }).key : ''

    const message =
      coerceGatewayText((payload as { message?: unknown } | undefined)?.message) || coerceGatewayText(payload?.text)

    if (!message) {
      return handled(state)
    }

    return handled(state, [
      { type: 'notify', id: key || `notice:${Date.now()}`, kind: 'info', title: 'Hermes', message }
    ])
  }

  if (event.type === 'notification.clear') {
    // No persistent notice list is tracked in this milestone — dismissal is
    // a UI-layer concern once M09/M11 build the real credits-notice surface.
    return handled(state)
  }

  if (event.type === 'message.reaction') {
    const reactedRowId = payload?.row_id

    if (typeof reactedRowId !== 'number' || !storedSessionId) {
      return handled(state)
    }

    const nextReactions = Array.isArray(payload?.reactions) ? payload.reactions : []
    const reactedRole = payload?.role === 'assistant' ? 'assistant' : 'user'

    const next = updateSession(state, storedSessionId, session => {
      const byRowId = session.messages.find(message => message.rowId === reactedRowId)

      if (byRowId) {
        return {
          ...session,
          messages: session.messages.map(message =>
            message.rowId === reactedRowId ? { ...message, reactions: nextReactions } : message
          )
        }
      }

      const lastIndex = session.messages.findLastIndex(
        message => message.role === reactedRole && message.rowId === undefined
      )

      if (lastIndex === -1) {
        return session
      }

      return {
        ...session,
        messages: session.messages.map((message, index) =>
          index === lastIndex ? { ...message, rowId: reactedRowId, reactions: nextReactions } : message
        )
      }
    }).state

    return handled(next)
  }

  if (event.type === 'error') {
    const errorMessage = coerceGatewayText(payload?.message) || 'Hermes reported an error'
    let next = state
    const effects: Effect[] = []

    if (storedSessionId) {
      next = updateSession(next, storedSessionId, session => {
        const todoListActive = session.todos.some(t => t.status === 'pending' || t.status === 'in_progress')

        return {
          ...session,
          needsInput: false,
          compacting: false,
          turnStartedAt: null,
          pendingClarifyRequestId: null,
          ...(todoListActive ? { todos: [], todosRevision: null } : {})
        }
      }).state

      next = { ...next, compactedTurns: new Set([...next.compactedTurns].filter(id => id !== storedSessionId)) }

      effects.push({ type: 'setClarify', storedSessionId, request: null })
      effects.push({ type: 'setApproval', storedSessionId, request: null })
      effects.push({ type: 'setSudo', storedSessionId, request: null })
      effects.push({ type: 'setSecret', storedSessionId, request: null })

      next = applyFailAssistantMessage(next, storedSessionId, errorMessage, occurredAt)
    }

    effects.push({
      type: 'notify',
      id: `gateway-error:${errorMessage}`,
      kind: 'error',
      title: 'Hermes error',
      message: errorMessage
    })

    return handled(next, effects)
  }

  return notHandled(state)
}
