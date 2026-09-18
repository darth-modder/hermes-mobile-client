// Pure port of apps/desktop's gateway-event/input-requests.ts: the
// blocking-input family — clarify / approval / sudo / secret requests. The
// Python side blocks on the matching *.respond, so each of these must be
// parked (as an effect, for the `clarify`/`prompts` stores to hold) and
// surfaced.
//
// `mcp.setup.request` (desktop-GUI-only MCP consent card) is dropped — not on
// M05's event catalog, and the tool it belongs to (`setup_mcp`) is gated to
// the desktop surface upstream.
//
// D25: these handlers used to push a mobile-only `scrollToBottom` effect so
// the ListHeaderComponent mounting the card (at the inverted FlashList's
// visual bottom edge) would actually be on screen. The four blocking cards
// now dock above the composer instead (src/chat/InputDock.tsx), visible
// independent of scroll position — the same reason desktop never needed
// this. Forcing a scroll here would now violate D25.8 ("a request arriving
// while the reader is scrolled up... the transcript position must not
// jump"), so it's removed, not just left unused.

import { restorePendingClarifyToolCall, settlePendingClarifyToolCall } from '../../upstream/lib/chat-messages'

import { normalizeChoices, normalizeQuestions, pendingClarifyToolPayload } from './clarify-support'
import { type FamilyHandler, handled, notHandled } from './context'
import { updateSession } from './session-keys'
import type { ClarifyRequest, Effect } from './types'

export const handleInputRequestEvent: FamilyHandler = (state, ctx) => {
  const { event, payload, storedSessionId, occurredAt } = ctx

  if (event.type === 'clarify.request') {
    const session = storedSessionId ? state.sessions.get(storedSessionId) : undefined

    if (session?.interrupted) {
      return handled(state)
    }

    const requestId = typeof payload?.request_id === 'string' ? payload.request_id : ''
    const question = typeof payload?.question === 'string' ? payload.question : ''
    const choices = normalizeChoices(payload?.choices)
    const multiSelect = payload?.multi_select === true
    const questions = normalizeQuestions(payload?.questions)

    const lockedAnswers =
      typeof payload?.answers === 'object' && payload?.answers !== null
        ? Object.fromEntries(
            Object.entries(payload.answers as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
          )
        : undefined

    if (!requestId || (questions.length === 0 && !question)) {
      return handled(state)
    }

    const request: ClarifyRequest = {
      choices: questions.length > 0 ? null : choices.length > 0 ? choices : null,
      lockedAnswers,
      multiSelect: questions.length > 0 ? false : multiSelect,
      question: questions.length > 0 ? '' : question,
      questions,
      receivedAt: Date.now() / 1000,
      requestId,
      storedSessionId
    }

    const effects: Effect[] = [{ type: 'setClarify', storedSessionId, request }]
    let next = state

    if (storedSessionId) {
      next = updateSession(state, storedSessionId, current => {
        const projection = restorePendingClarifyToolCall(
          current.messages,
          pendingClarifyToolPayload(request),
          occurredAt
        )

        return {
          ...current,
          messages: projection.messages,
          streamId: projection.streamId,
          sawAssistantPayload: true,
          awaitingResponse: false,
          needsInput: true,
          pendingClarifyRequestId: requestId
        }
      }).state
    }

    return handled(next, effects)
  }

  if (event.type === 'clarify.expire') {
    if (!storedSessionId) {
      return handled(state)
    }

    const requestId = typeof payload?.request_id === 'string' ? payload.request_id : ''
    const session = state.sessions.get(storedSessionId)

    // Expiry is request-correlated: a delayed event from an older prompt must
    // not erase a newer clarify raised by the same session.
    if (!requestId || !session || session.pendingClarifyRequestId !== requestId) {
      return handled(state)
    }

    const next = updateSession(state, storedSessionId, current => {
      const projection = settlePendingClarifyToolCall(
        current.messages,
        { tool_id: requestId },
        current.busy,
        occurredAt
      )

      return {
        ...current,
        messages: projection.messages,
        needsInput: false,
        pendingClarifyRequestId: null,
        streamId: current.busy ? (projection.streamId ?? current.streamId) : null
      }
    }).state

    return handled(next, [{ type: 'setClarify', storedSessionId, request: null }])
  }

  if (event.type === 'approval.request') {
    const command = typeof payload?.command === 'string' ? payload.command : ''
    const description = typeof payload?.description === 'string' ? payload.description : 'dangerous command'

    const effects: Effect[] = [
      {
        type: 'setApproval',
        storedSessionId,
        request: {
          allowPermanent: payload?.allow_permanent !== false,
          choices: Array.isArray(payload?.choices)
            ? payload.choices.filter(choice => typeof choice === 'string')
            : undefined,
          command,
          description,
          requestId: typeof payload?.request_id === 'string' ? payload.request_id : undefined,
          smartDenied: payload?.smart_denied === true,
          storedSessionId
        }
      }
    ]

    const next = storedSessionId
      ? updateSession(state, storedSessionId, current => ({ ...current, needsInput: true })).state
      : state

    return handled(next, effects)
  }

  if (event.type === 'sudo.request') {
    const requestId = typeof payload?.request_id === 'string' ? payload.request_id : ''

    if (!requestId) {
      return handled(state)
    }

    const next = storedSessionId
      ? updateSession(state, storedSessionId, current => ({
          ...current,
          needsInput: true,
          pendingSudoRequestId: requestId
        })).state
      : state

    const effects: Effect[] = [{ type: 'setSudo', storedSessionId, request: { requestId, storedSessionId } }]

    return handled(next, effects)
  }

  // Found live, on-device, testing the SecretCard skip branch (M06 round 4):
  // the server's default 300s `_block` wait times out and emits `sudo.expire`
  // / `secret.expire` (both are in `_EXPIRING_REQUESTS`, same as clarify) —
  // but until this fix, nothing here handled either event, so `SudoCard`/
  // `SecretCard` stayed mounted (and `FLAG_SECURE` stayed engaged) forever
  // for a request the server had already given up on and resolved as
  // "skipped". `clarify.expire` already did this correctly; sudo/secret just
  // never got the same treatment.
  if (event.type === 'sudo.expire') {
    if (!storedSessionId) {
      return handled(state)
    }

    const requestId = typeof payload?.request_id === 'string' ? payload.request_id : ''
    const session = state.sessions.get(storedSessionId)

    if (!requestId || !session || session.pendingSudoRequestId !== requestId) {
      return handled(state)
    }

    const next = updateSession(state, storedSessionId, current => ({
      ...current,
      needsInput: false,
      pendingSudoRequestId: null
    })).state

    return handled(next, [{ type: 'setSudo', storedSessionId, request: null }])
  }

  if (event.type === 'secret.request') {
    const requestId = typeof payload?.request_id === 'string' ? payload.request_id : ''

    if (!requestId) {
      return handled(state)
    }

    const envVar = typeof payload?.env_var === 'string' ? payload.env_var : ''
    const promptText = typeof payload?.prompt === 'string' ? payload.prompt : ''

    const next = storedSessionId
      ? updateSession(state, storedSessionId, current => ({
          ...current,
          needsInput: true,
          pendingSecretRequestId: requestId
        })).state
      : state

    const effects: Effect[] = [
      { type: 'setSecret', storedSessionId, request: { envVar, prompt: promptText, requestId, storedSessionId } }
    ]

    return handled(next, effects)
  }

  if (event.type === 'secret.expire') {
    if (!storedSessionId) {
      return handled(state)
    }

    const requestId = typeof payload?.request_id === 'string' ? payload.request_id : ''
    const session = state.sessions.get(storedSessionId)

    if (!requestId || !session || session.pendingSecretRequestId !== requestId) {
      return handled(state)
    }

    const next = updateSession(state, storedSessionId, current => ({
      ...current,
      needsInput: false,
      pendingSecretRequestId: null
    })).state

    return handled(next, [{ type: 'setSecret', storedSessionId, request: null }])
  }

  return notHandled(state)
}
