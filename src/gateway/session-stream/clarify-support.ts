// Small pure helpers hand-ported from apps/desktop/src/store/clarify.ts (the
// normalization rules) and .../use-session-actions/restore-pending-clarify.ts
// (the projection back to a tool-call payload) — both dependency-free and
// used by exactly the one call site input-requests.ts needs.

import type { GatewayEventPayload } from '../../upstream/lib/chat-messages'

import type { ClarifyQuestion, ClarifyRequest } from './types'

/** The backend labels the agent's recommended option by appending this to the
 *  first choice (tools/clarify_tool.py::mark_recommended). */
export const RECOMMENDED_LABEL = '(Recommended)'

export const bareChoice = (choice: string): string =>
  choice.endsWith(RECOMMENDED_LABEL) ? choice.slice(0, -RECOMMENDED_LABEL.length).trim() : choice

/** Keeps non-blank, newline-free strings of length <= 200; drops everything
 *  else. An all-dropped result means "fall back to free-text", not "no choices
 *  were ever sent" — callers must not conflate the two. */
export function normalizeChoices(choices: unknown): string[] {
  return Array.isArray(choices)
    ? choices.filter(
        (c): c is string =>
          typeof c === 'string' && c.trim().length > 0 && bareChoice(c).length <= 200 && !c.includes('\n')
      )
    : []
}

/** Validate and normalize a batch clarify payload's `questions` array. Keeps
 *  entries with a non-blank string `qid` and `question`; returns an empty
 *  array when nothing usable remains (caller treats that as "not a batch"). */
export function normalizeQuestions(questions: unknown): ClarifyQuestion[] {
  if (!Array.isArray(questions)) {
    return []
  }

  const normalized: ClarifyQuestion[] = []

  for (const entry of questions) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }

    const row = entry as Record<string, unknown>
    const qid = typeof row.qid === 'string' ? row.qid.trim() : ''
    const question = typeof row.question === 'string' ? row.question.trim() : ''

    if (!qid || !question) {
      continue
    }

    const choices = normalizeChoices(row.choices)

    normalized.push({
      choices: choices.length > 0 ? choices : null,
      multiSelect: row.multi_select === true && choices.length > 0,
      qid,
      question
    })
  }

  return normalized
}

/** Project a parked clarify request back to the shape `restorePendingClarifyToolCall`
 *  / `settlePendingClarifyToolCall` (src/upstream/lib/chat-messages) expect. */
export function pendingClarifyToolPayload(request: ClarifyRequest): GatewayEventPayload {
  return {
    args: request.questions.length
      ? {
          questions: request.questions.map(question => ({
            choices: question.choices ?? undefined,
            multi_select: question.multiSelect || undefined,
            question: question.question
          }))
        }
      : {
          choices: request.choices ?? [],
          ...(request.multiSelect ? { multi_select: true } : {}),
          question: request.question
        },
    tool_id: request.requestId
  }
}
