// D10.2: session.resume returns pending_approval / pending_clarify — the
// oldest gateway approval or clarify still blocking a session, so a request
// that arrived while the transport was detached (or that a session.reclaimed
// replaced with a fresh runtime session) is not lost on the client while the
// server still waits for it. Restoring them here mirrors exactly the store
// state a live approval.request/clarify.request event produces
// (input-requests.ts) — the card component itself (ApprovalCard/ClarifyCard)
// doesn't know or care whether its request came from a live event or a
// resume snapshot.
//
// sudo.request/secret.request have no resume field upstream at all (only
// clarify/approval do — see the vendored SessionResumeResponse), so a card
// that was open when the transport detached cannot be told apart from one
// already answered. Left open, it would wedge the composer on a request
// nobody can answer anymore — cleared unconditionally on every resume
// instead. Recorded in M07-sessions-and-lifecycle.md as an upstream
// limitation, not a bug in this function.

import type { SessionResumeResponse } from '../../upstream/types/hermes'

import { normalizeChoices, normalizeQuestions } from './clarify-support'
import { updateSession } from './session-keys'
import type { ApprovalRequest, ClarifyRequest, Effect, ReducerState } from './types'

type PendingSnapshot = Pick<SessionResumeResponse, 'pending_approval' | 'pending_clarify'>

function buildApprovalRequest(
  storedSessionId: string,
  pending: PendingSnapshot['pending_approval']
): ApprovalRequest | null {
  if (!pending) {
    return null
  }

  return {
    allowPermanent: pending.allow_permanent !== false,
    choices: Array.isArray(pending.choices) ? pending.choices.filter(choice => typeof choice === 'string') : undefined,
    command: typeof pending.command === 'string' ? pending.command : '',
    description: typeof pending.description === 'string' ? pending.description : 'dangerous command',
    requestId: typeof pending.request_id === 'string' ? pending.request_id : undefined,
    smartDenied: pending.smart_denied === true,
    storedSessionId
  }
}

function buildClarifyRequest(
  storedSessionId: string,
  pending: PendingSnapshot['pending_clarify']
): ClarifyRequest | null {
  const requestId = pending && typeof pending.request_id === 'string' ? pending.request_id : ''

  if (!pending || !requestId) {
    return null
  }

  const questions = normalizeQuestions(pending.questions)
  const question = typeof pending.question === 'string' ? pending.question : ''

  if (questions.length === 0 && !question) {
    return null
  }

  const choices = normalizeChoices(pending.choices)

  const lockedAnswers =
    typeof pending.answers === 'object' && pending.answers !== null
      ? Object.fromEntries(
          Object.entries(pending.answers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        )
      : undefined

  return {
    choices: questions.length > 0 ? null : choices.length > 0 ? choices : null,
    lockedAnswers,
    multiSelect: questions.length > 0 ? false : pending.multi_select === true,
    question: questions.length > 0 ? '' : question,
    questions,
    receivedAt: Date.now() / 1000,
    requestId,
    storedSessionId
  }
}

/**
 * Called from `resumeSession` (session-connection.ts) after every
 * `session.resume` — both reconnect branches (inside the server's orphan
 * grace, and after a `session.reclaimed`) call `resumeSession` the same way,
 * so this runs identically on either.
 */
export function restorePendingRequestsFromResume(
  state: ReducerState,
  storedSessionId: string,
  response: PendingSnapshot
): { state: ReducerState; effects: Effect[] } {
  const session = state.sessions.get(storedSessionId)
  const approval = buildApprovalRequest(storedSessionId, response.pending_approval)
  const clarify = buildClarifyRequest(storedSessionId, response.pending_clarify)
  const staleSudo = Boolean(session?.pendingSudoRequestId)
  const staleSecret = Boolean(session?.pendingSecretRequestId)

  if (!approval && !clarify && !staleSudo && !staleSecret) {
    return { state, effects: [] }
  }

  const effects: Effect[] = []

  if (approval) {
    effects.push({ type: 'setApproval', storedSessionId, request: approval })
  }

  if (clarify) {
    effects.push({ type: 'setClarify', storedSessionId, request: clarify })
  }

  if (staleSudo) {
    effects.push({ type: 'setSudo', storedSessionId, request: null })
  }

  if (staleSecret) {
    effects.push({ type: 'setSecret', storedSessionId, request: null })
  }

  if (approval || clarify) {
    effects.push({ type: 'scrollToBottom', storedSessionId })
  }

  const next = updateSession(state, storedSessionId, current => ({
    ...current,
    needsInput: Boolean(approval || clarify),
    pendingClarifyRequestId: clarify ? clarify.requestId : current.pendingClarifyRequestId,
    pendingSecretRequestId: staleSecret ? null : current.pendingSecretRequestId,
    pendingSudoRequestId: staleSudo ? null : current.pendingSudoRequestId
  })).state

  return { state: next, effects }
}
