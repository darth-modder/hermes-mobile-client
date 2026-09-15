// Pure port of apps/desktop's gateway-event/message-stream.ts: the
// message/reasoning/MoA streaming family — message.start -> deltas -> interim
// -> complete, thinking/reasoning deltas, moa.* progress, reaction.
//
// Dropped relative to the desktop handler (AGENTS.md "Machine features don't
// exist here" + no multi-window/pet-overlay surface on mobile):
//   - Pet sprite activity (setPetActivity/flashPetActivity) and vibe-heart
//     bursts (`reaction` event) — desktop-only chrome, nothing to drive here.
//   - `markPetUnread` / `document.hasFocus()` mail-icon badge — pet-overlay-only.
//   - Billing CTA click handler (billingCtaLabel/runBillingRecovery) — the
//     `notify` effect this reducer emits for a billing wall carries no
//     `onClick` (effects are data, not callbacks); resolving the block is a
//     UI-layer action for whichever milestone builds the billing screen.
// `reaction` is still routed here (falls through as handled-but-inert) so it
// doesn't reach `status.ts`'s catch-all as an unhandled event.

import {
  assistantTextPart,
  type ChatMessage,
  type ChatMessagePart,
  chatMessageText,
  completeOpenTimelineParts,
  mergeFinalAssistantText,
  reasoningPart,
  sealOpenToolParts
} from '../../upstream/lib/chat-messages'
import { parseErrorSurface } from '../../upstream/lib/error-surface'
import { generatedImageEchoSources, stripGeneratedImageEchoes } from '../../upstream/lib/generated-images'
import type { UsageStats } from '../../upstream/types/hermes'

import { type FamilyHandler, handled, notHandled } from './context'
import { flushSessionDeltas, queueDelta } from './delta-queue'
import { nextStreamMessageId } from './ids'
import { mutateStreamingMessage } from './mutate-stream'
import { updateSession } from './session-keys'
import { coerceGatewayText, coerceThinkingText } from './text-coercion'
import type { BillingBlock, Effect, ReducerState, SessionState } from './types'

const COMPLETION_ERROR_PATTERNS = [
  /^API call failed after \d+ retries:/i,
  /^HTTP\s+\d{3}\b/i,
  /^(Provider|Gateway)\s+error:/i
]

function completionErrorText(finalText: string): null | string {
  const text = finalText.trim()

  return text && COMPLETION_ERROR_PATTERNS.some(re => re.test(text)) ? text : null
}

function firstBillingLine(text: string): string {
  return (text || '').split('\n')[0]?.trim() ?? ''
}

function billingNotifyEffect(storedSessionId: string, block: BillingBlock): Effect {
  return {
    type: 'notify',
    id: `billing-block:${block.provider}`,
    kind: 'warning',
    title: block.is_nous ? 'Out of Nous credits' : `${block.provider_label} billing`,
    message: firstBillingLine(block.message) || 'This turn could not run — check your billing.',
    // Sticky: a credit wall blocks every turn until resolved.
    durationMs: 0
  }
}

function finalizeInterimAssistantMessage(session: SessionState, text: string, occurredAt: number): SessionState {
  if (session.interrupted) {
    return session
  }

  const authoritativeText = text.trim()

  if (!authoritativeText) {
    return session
  }

  const streamId = session.streamId

  const replaceTextPart = (parts: ChatMessagePart[]) => {
    const visibleText = stripGeneratedImageEchoes(authoritativeText, generatedImageEchoSources(parts)).trim()

    return mergeFinalAssistantText(parts, visibleText, occurredAt)
  }

  let nextMessages = session.messages

  if (streamId && nextMessages.some(m => m.id === streamId)) {
    nextMessages = nextMessages.map(m =>
      m.id === streamId
        ? {
            ...m,
            parts: completeOpenTimelineParts(replaceTextPart(m.parts), occurredAt),
            completedAt: occurredAt,
            pending: false,
            interim: true
          }
        : m
    )
  } else {
    nextMessages = [
      ...nextMessages,
      {
        id: nextStreamMessageId('assistant-interim'),
        role: 'assistant' as const,
        parts: [{ ...assistantTextPart(authoritativeText, occurredAt), completedAt: occurredAt }],
        timestamp: occurredAt,
        completedAt: occurredAt,
        pending: false,
        interim: true,
        branchGroupId: session.pendingBranchGroup ?? undefined
      }
    ]
  }

  return {
    ...session,
    messages: nextMessages,
    streamId: null,
    interimBoundaryPending: true,
    sawAssistantPayload: session.sawAssistantPayload || Boolean(authoritativeText)
  }
}

interface CompleteResult {
  session: SessionState
  shouldHydrate: boolean
}

function completeAssistantMessage(
  session: SessionState,
  text: string,
  responsePreviewed: boolean | undefined,
  failure: { error: string; partial: boolean; surface?: ReturnType<typeof parseErrorSurface> } | undefined,
  occurredAt: number,
  model: string | undefined,
  usage: Partial<UsageStats> | undefined
): CompleteResult {
  if (session.interrupted) {
    return {
      session: {
        ...session,
        awaitingResponse: false,
        busy: false,
        needsInput: false,
        pendingBranchGroup: null,
        streamId: null,
        turnStartedAt: null,
        turnLive: false
      },
      shouldHydrate: false
    }
  }

  const streamId = session.streamId
  const finalText = text.trim()
  const completionError = failure?.error ?? completionErrorText(finalText)
  const keepFailedPartialText = Boolean(failure?.partial && finalText)
  const interimBoundaryPending = session.interimBoundaryPending

  const durationS = session.turnStartedAt
    ? Math.max(1, Math.round((Date.now() - session.turnStartedAt) / 1000))
    : undefined

  const replaceTextPart = (parts: ChatMessagePart[]) => {
    const visibleFinalText = stripGeneratedImageEchoes(finalText, generatedImageEchoSources(parts)).trim()

    return mergeFinalAssistantText(parts, visibleFinalText, occurredAt)
  }

  const completeMessage = (message: ChatMessage): ChatMessage => {
    const settled = {
      ...message,
      completedAt: occurredAt,
      parts: completeOpenTimelineParts(message.parts, occurredAt),
      pending: false,
      interim: false,
      ...(durationS !== undefined ? { durationS } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(usage !== undefined ? { usage } : {}),
      ...(completionError && failure?.surface ? { errorSurface: failure.surface } : {})
    }

    if (completionError && !keepFailedPartialText) {
      return { ...settled, error: completionError, parts: settled.parts.filter(part => part.type !== 'text') }
    }

    return {
      ...settled,
      parts: completeOpenTimelineParts(replaceTextPart(settled.parts), occurredAt),
      ...(completionError ? { error: completionError } : {})
    }
  }

  const newAssistantFromCompletion = (): ChatMessage => ({
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    parts:
      completionError && !keepFailedPartialText
        ? []
        : [{ ...assistantTextPart(finalText, occurredAt), completedAt: occurredAt }],
    timestamp: occurredAt,
    completedAt: occurredAt,
    branchGroupId: session.pendingBranchGroup ?? undefined,
    ...(durationS !== undefined ? { durationS } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(usage !== undefined ? { usage } : {}),
    ...(completionError && { error: completionError }),
    ...(completionError && failure?.surface ? { errorSurface: failure.surface } : {})
  })

  const prev = session.messages
  let nextMessages = prev

  if (streamId && prev.some(m => m.id === streamId)) {
    nextMessages = prev.map(m => (m.id === streamId ? completeMessage(m) : m))
  } else {
    const fallbackIndex = [...prev].reverse().findIndex(message => message.role === 'assistant' && !message.hidden)

    if (fallbackIndex >= 0) {
      const index = prev.length - 1 - fallbackIndex
      const existing = prev[index]
      const existingText = chatMessageText(existing).trim()

      const finalContinuesInterim = Boolean(
        existing.interim &&
        finalText &&
        existingText &&
        (finalText === existingText || finalText.startsWith(existingText) || existingText.startsWith(finalText))
      )

      if (existing.pending || (!interimBoundaryPending && finalText && existingText === finalText)) {
        nextMessages = prev.map((message, messageIndex) =>
          messageIndex === index ? completeMessage(message) : message
        )
      } else if ((interimBoundaryPending && responsePreviewed) || finalContinuesInterim) {
        nextMessages = prev.map((message, messageIndex) =>
          messageIndex === index ? completeMessage(message) : message
        )
      } else if (finalText) {
        nextMessages = [...prev, newAssistantFromCompletion()]
      }
    } else if (finalText) {
      nextMessages = [...prev, newAssistantFromCompletion()]
    }
  }

  nextMessages = sealOpenToolParts(nextMessages)

  const hasInlineError = nextMessages.some(m => m.role === 'assistant' && m.error && !m.hidden)
  const lastVisible = [...nextMessages].reverse().find(m => !m.hidden)
  const unresolvedUserTail = lastVisible?.role === 'user'

  const sameTurnAssistant = streamId
    ? nextMessages.find(m => m.id === streamId)
    : [...nextMessages].reverse().find(m => m.role === 'assistant' && !m.hidden)

  const localVisibleText = sameTurnAssistant ? chatMessageText(sameTurnAssistant).trim() : ''

  const shouldHydrate =
    !completionError &&
    !hasInlineError &&
    (!unresolvedUserTail || !finalText) &&
    !(localVisibleText && !finalText) &&
    (session.adoptedRunningTurn || !session.sawAssistantPayload || !finalText)

  return {
    session: {
      ...session,
      messages: nextMessages,
      adoptedRunningTurn: false,
      streamId: null,
      pendingBranchGroup: null,
      awaitingResponse: false,
      busy: false,
      needsInput: false,
      interimBoundaryPending: false,
      turnStartedAt: null,
      turnLive: false
    },
    shouldHydrate
  }
}

function failAssistantMessage(session: SessionState, errorMessage: string, occurredAt: number): SessionState {
  const streamId = session.streamId ?? `assistant-error-${Date.now()}`
  const groupId = session.pendingBranchGroup ?? undefined
  const prev = session.messages
  const error = errorMessage.trim() || 'Hermes reported an error'

  const durationS = session.turnStartedAt
    ? Math.max(1, Math.round((Date.now() - session.turnStartedAt) / 1000))
    : undefined

  const nextMessages = prev.some(m => m.id === streamId)
    ? prev.map(message =>
        message.id === streamId
          ? {
              ...message,
              completedAt: occurredAt,
              error,
              parts: completeOpenTimelineParts(message.parts, occurredAt),
              pending: false,
              ...(durationS !== undefined ? { durationS } : {})
            }
          : message
      )
    : [
        ...prev,
        {
          id: streamId,
          role: 'assistant' as const,
          parts: [],
          timestamp: occurredAt,
          completedAt: occurredAt,
          error,
          pending: false,
          branchGroupId: groupId,
          ...(durationS !== undefined ? { durationS } : {})
        }
      ]

  return {
    ...session,
    messages: nextMessages,
    streamId: null,
    pendingBranchGroup: null,
    sawAssistantPayload: true,
    awaitingResponse: false,
    busy: false,
    needsInput: false,
    interimBoundaryPending: false,
    turnStartedAt: null,
    turnLive: false
  }
}

/** Exported so status.ts (the `error` event) can settle the streaming bubble
 *  the same way a failed `message.complete` would. */
export function applyFailAssistantMessage(
  state: ReducerState,
  storedSessionId: string,
  errorMessage: string,
  occurredAt: number
): ReducerState {
  return updateSession(state, storedSessionId, session => failAssistantMessage(session, errorMessage, occurredAt)).state
}

export const handleMessageStreamEvent: FamilyHandler = (state, ctx) => {
  const { event, payload, storedSessionId, isActiveEvent, occurredAt } = ctx

  if (event.type === 'message.start') {
    if (!storedSessionId) {
      return handled(state)
    }

    let next = flushSessionDeltas(state, storedSessionId)
    const effects: Effect[] = []

    const { state: withUpdate } = updateSession(next, storedSessionId, session => {
      if (session.interrupted) {
        return session
      }

      return {
        ...session,
        busy: true,
        awaitingResponse: true,
        sawAssistantPayload: false,
        interrupted: false,
        interimBoundaryPending: false,
        turnLive: true,
        turnStartedAt: session.turnStartedAt ?? Date.now(),
        compacting: false,
        billingBlock: null
      }
    })

    next = withUpdate
    next = { ...next, compactedTurns: new Set([...next.compactedTurns].filter(id => id !== storedSessionId)) }

    if (isActiveEvent) {
      effects.push({ type: 'haptic', kind: 'streamStart' })
    }

    return handled(next, effects)
  }

  if (event.type === 'message.delta') {
    if (!storedSessionId) {
      return handled(state)
    }

    return handled(queueDelta(state, storedSessionId, 'assistant', coerceGatewayText(payload?.text), occurredAt))
  }

  if (event.type === 'message.interim') {
    if (!storedSessionId) {
      return handled(state)
    }

    let next = flushSessionDeltas(state, storedSessionId)
    const text = coerceGatewayText(payload?.text)

    if (text) {
      next = updateSession(next, storedSessionId, session =>
        finalizeInterimAssistantMessage(session, text, occurredAt)
      ).state
    }

    return handled(next)
  }

  if (event.type === 'thinking.delta' || event.type === 'reaction') {
    // Provider-wait status text (thinking.delta) and vibe-heart reactions are
    // desktop-only presentation — see file header. Consumed here so neither
    // falls through to an "unhandled event" surface.
    return handled(state)
  }

  if (event.type === 'reasoning.delta' || event.type === 'reasoning.available') {
    if (!storedSessionId) {
      return handled(state)
    }

    const replace = event.type === 'reasoning.available'
    const delta = coerceThinkingText(payload?.text)

    if (!delta) {
      return handled(state)
    }

    if (!replace) {
      return handled(queueDelta(state, storedSessionId, 'reasoning', delta, occurredAt))
    }

    let next = flushSessionDeltas(state, storedSessionId)

    next = updateSession(next, storedSessionId, session =>
      mutateStreamingMessage(
        session,
        (parts, message) => {
          if (chatMessageText(message).trim()) {
            return parts
          }

          return [...parts.filter(part => part.type !== 'reasoning'), reasoningPart(delta, occurredAt)]
        },
        () => [reasoningPart(delta, occurredAt)],
        {},
        occurredAt
      )
    ).state

    return handled(next)
  }

  if (
    event.type === 'moa.reference' ||
    event.type === 'moa.progress' ||
    event.type === 'moa.phase' ||
    event.type === 'moa.aggregating'
  ) {
    if (!storedSessionId) {
      return handled(state)
    }

    if (event.type === 'moa.aggregating') {
      return handled(state)
    }

    let text: string | null = null
    let replace = false
    let flushAfter = false

    if (event.type === 'moa.reference') {
      const label = coerceGatewayText(payload?.label) || 'reference'
      const idx = typeof payload?.index === 'number' ? payload.index : undefined

      const cnt =
        typeof (payload as { count?: number } | undefined)?.count === 'number'
          ? (payload as { count?: number }).count
          : undefined

      const header = idx && cnt ? `◇ Reference ${idx}/${cnt} — ${label}` : `◇ Reference — ${label}`
      const body = coerceThinkingText(payload?.text)

      text = `${header}\n${body}\n\n`
      replace = idx === undefined || idx <= 1
      flushAfter = !replace
    } else if (event.type === 'moa.progress') {
      if (typeof payload?.refs_done === 'number' && typeof payload?.refs_total === 'number') {
        const label = coerceGatewayText(payload?.label)

        text = label
          ? `◇ MoA refs ${payload.refs_done}/${payload.refs_total} — ${label}\n`
          : `◇ MoA refs ${payload.refs_done}/${payload.refs_total}\n`
        replace = payload.refs_done <= 1
        flushAfter = true
      }
    } else if (event.type === 'moa.phase') {
      if (payload?.phase === 'aggregator') {
        text = '◇ MoA aggregating…\n'
        replace = false
        flushAfter = true
      }
    }

    if (!text) {
      return handled(state)
    }

    let next: ReducerState

    if (replace) {
      next = updateSession(state, storedSessionId, session =>
        mutateStreamingMessage(
          session,
          (parts, message) => {
            if (chatMessageText(message).trim()) {
              return parts
            }

            return [...parts.filter(part => part.type !== 'reasoning'), reasoningPart(text!, occurredAt)]
          },
          () => [reasoningPart(text!, occurredAt)],
          {},
          occurredAt
        )
      ).state
    } else {
      next = queueDelta(state, storedSessionId, 'reasoning', text, occurredAt)

      if (flushAfter) {
        next = flushSessionDeltas(next, storedSessionId)
      }
    }

    return handled(next)
  }

  if (event.type === 'message.complete') {
    if (!storedSessionId) {
      return handled(state)
    }

    let next = flushSessionDeltas(state, storedSessionId)
    const effects: Effect[] = []

    // Turn ended — drop any blocking prompt still open for THIS session and
    // any unfinished todo list (no final `todo.updated` arrived to settle it).
    const hadClarify = next.sessions.get(storedSessionId)?.pendingClarifyRequestId != null

    if (hadClarify) {
      effects.push({ type: 'setClarify', storedSessionId, request: null })
    }

    effects.push({ type: 'setApproval', storedSessionId, request: null })
    effects.push({ type: 'setSudo', storedSessionId, request: null })
    effects.push({ type: 'setSecret', storedSessionId, request: null })

    const finalText = coerceGatewayText(payload?.text) || coerceGatewayText(payload?.rendered)

    const failure =
      payload?.status === 'error'
        ? {
            error: coerceGatewayText(payload.error).trim() || finalText || 'Hermes reported an error',
            partial: Boolean(payload.partial),
            surface: parseErrorSurface(payload.error_surface)
          }
        : undefined

    let shouldHydrate = false

    next = updateSession(next, storedSessionId, session => {
      const result = completeAssistantMessage(
        session,
        finalText,
        payload?.response_previewed,
        failure,
        occurredAt,
        session.model || undefined,
        payload?.usage
      )

      shouldHydrate = result.shouldHydrate

      // An unfinished todo list (last item still pending/in_progress) means
      // the turn stopped without a final `todo.updated` — drop it so "Tasks
      // N/M" doesn't stay pinned with a stuck item. A finished list is left
      // untouched (mirrors the desktop's clearActiveSessionTodos).
      const todoListActive = result.session.todos.some(t => t.status === 'pending' || t.status === 'in_progress')

      let updated: SessionState = {
        ...result.session,
        compacting: false,
        pendingClarifyRequestId: null,
        ...(todoListActive ? { todos: [], todosRevision: null } : {})
      }

      if (payload?.billing) {
        const block = payload.billing as BillingBlock

        if (typeof block?.provider === 'string') {
          updated = { ...updated, billingBlock: block }
        }
      }

      if (payload?.usage) {
        updated = { ...updated, usage: { calls: 0, input: 0, output: 0, total: 0, ...updated.usage, ...payload.usage } }
      }

      return updated
    }).state

    if (next.compactedTurns.has(storedSessionId)) {
      shouldHydrate = false
      next = { ...next, compactedTurns: new Set([...next.compactedTurns].filter(id => id !== storedSessionId)) }
    }

    if (shouldHydrate) {
      effects.push({ type: 'hydrate', storedSessionId, runtimeSessionId: ctx.runtimeSessionId, attempts: 3 })
    }

    effects.push({ type: 'refreshSessions' })

    if (isActiveEvent) {
      effects.push({ type: 'sound', kind: 'completion' })
    }

    if (payload?.billing && typeof (payload.billing as BillingBlock)?.provider === 'string') {
      effects.push(billingNotifyEffect(storedSessionId, payload.billing as BillingBlock))
    }

    return handled(next, effects)
  }

  return notHandled(state)
}
