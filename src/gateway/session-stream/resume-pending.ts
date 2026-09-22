// D10.2 / D31 / D32: reconcile this session's pending approval/clarify/sudo/
// secret cards (and the "a turn is running" spinner) against what
// session.resume actually says, on every resume — both reconnect branches
// (inside the server's orphan grace, and after a session.reclaimed) call
// resumeSession() the same way, so this runs identically on either.
//
// Design (D32, replacing D31's cold/live payload-shape detector after both
// turned out to rest on fields that don't actually distinguish the two —
// see the fix/reconcile-and-notifications branch history): no branching on
// which server-side payload builder produced the response. Only two fields
// this client already reads carry the signal:
//
//   - `session_id`: the RUNTIME id session.resume rebinds onto (done by the
//     caller, resumeSession(), before this runs). A reattach to an
//     already-live session keeps the SAME runtime id; a cold resume always
//     mints a NEW one (methods_session.py's _resume_reuse_live vs.
//     _resume_cold/_resume_lazy/_resume_deferred, all via ctx.mint()).
//   - `running`: whether a turn is live server-side right now. A cold resume
//     always reports false (this client never sends the one param —
//     `lazy` — that would make it true; see session-connection.ts's
//     session.resume call and its own test pinning that shape).
//
// approval/clarify: session.resume DOES carry pending_approval/pending_clarify
// when something is genuinely waiting (present -> set), and omits them
// otherwise, on every resume shape this client can receive (present -> set;
// absent -> clear needs no live/cold branch — a cold resume simply never has
// them, so "absent -> clear" already does the right thing there for free).
//
// sudo/secret: session.resume carries NO resume field for these at all, on
// any payload shape — the only way to tell "still good" from "the server-side
// session that raised it is gone" is: the turn that raised it is still
// running (`running === true`), AND the resume's own `session_id` matches
// the RUNTIME id the request arrived under (recorded on the request itself —
// see SudoRequest/SecretRequest.runtimeSessionId). A changed session_id means
// a new server-side session, so whatever it was waiting on is dead no matter
// what the socket did. Otherwise: clear.
//
// A malformed response (session_id not a non-empty string, or running not a
// boolean) reconciles NOTHING — no clearing, no spinner change — rather than
// guess: a missing/wrong field is also what a real bug looks like, and a
// destructive guess here could blank a live sudo card wrongly.

import { isDevBuild } from '../../lib/dev-build'
import type { SessionResumeResponse } from '../../upstream/types/hermes'

import { normalizeChoices, normalizeQuestions } from './clarify-support'
import { updateSession } from './session-keys'
import type { ApprovalRequest, ClarifyRequest, Effect, ReducerState, SecretRequest, SudoRequest } from './types'

function buildApprovalRequest(
  storedSessionId: string,
  pending: SessionResumeResponse['pending_approval']
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
  pending: SessionResumeResponse['pending_clarify']
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

/** The sudo/secret store's CURRENT entry for this session, if any — read by
 *  the caller (session-connection.ts) before this reconcile dispatches any
 *  clearing effect, since point 5's keep-or-clear decision is about what was
 *  already there going in, not what this call produces. */
export interface ReconcileCurrentPending {
  sudo?: null | Pick<SudoRequest, 'runtimeSessionId'>
  secret?: null | Pick<SecretRequest, 'runtimeSessionId'>
}

function isUsableResponse(response: SessionResumeResponse): response is SessionResumeResponse & { running: boolean } {
  return (
    typeof response.session_id === 'string' && response.session_id.length > 0 && typeof response.running === 'boolean'
  )
}

export function reconcilePendingRequestsFromResume(
  state: ReducerState,
  storedSessionId: string,
  response: SessionResumeResponse,
  current: ReconcileCurrentPending = {}
): { state: ReducerState; effects: Effect[] } {
  if (!isUsableResponse(response)) {
    if (isDevBuild()) {
      console.warn(
        '[reconcile] session.resume response missing session_id/running — skipping reconcile, nothing cleared',
        response
      )
    }

    return { state, effects: [] }
  }

  const { running, session_id: runtimeSessionId } = response
  const approval = buildApprovalRequest(storedSessionId, response.pending_approval)
  const clarify = buildClarifyRequest(storedSessionId, response.pending_clarify)

  const keepSudo = running && current.sudo != null && current.sudo.runtimeSessionId === runtimeSessionId
  const keepSecret = running && current.secret != null && current.secret.runtimeSessionId === runtimeSessionId

  const effects: Effect[] = [
    { type: 'setApproval', storedSessionId, request: approval },
    { type: 'setClarify', storedSessionId, request: clarify }
  ]

  if (!keepSudo) {
    effects.push({ type: 'setSudo', storedSessionId, request: null })
  }

  if (!keepSecret) {
    effects.push({ type: 'setSecret', storedSessionId, request: null })
  }

  if (approval || clarify) {
    effects.push({ type: 'scrollToBottom', storedSessionId })
  }

  const turnStartedAtMs =
    typeof response.turn_started_at === 'number' && response.turn_started_at > 0
      ? response.turn_started_at * 1000
      : null

  const next = updateSession(state, storedSessionId, session => ({
    ...session,
    awaitingResponse: running ? session.awaitingResponse : false,
    busy: running,
    needsInput: Boolean(approval || clarify || keepSudo || keepSecret),
    pendingClarifyRequestId: clarify ? clarify.requestId : null,
    pendingSecretRequestId: keepSecret ? session.pendingSecretRequestId : null,
    pendingSudoRequestId: keepSudo ? session.pendingSudoRequestId : null,
    streamId: running ? session.streamId : null,
    turnLive: running,
    turnStartedAt: running ? (turnStartedAtMs ?? session.turnStartedAt ?? Date.now()) : null
  })).state

  return { state: next, effects }
}
