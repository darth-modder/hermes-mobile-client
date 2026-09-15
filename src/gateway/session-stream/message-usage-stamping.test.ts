// M15 B, task 2: a completed ChatMessage must carry the session's model and
// that turn's own usage (Response stats), not just merge usage into the
// session-wide running total (`SessionState.usage`, session-info.ts) — see
// message-stream.ts's `completeAssistantMessage`. `model` comes from the
// session's own state (set by a prior `session.info`, session-info.ts:51-52)
// at the moment `message.complete` lands, NOT from that event's own payload
// — the real gateway never sends one there (`_complete_turn_payload`,
// tui_gateway/prompt_turn.py:622-648, builds `{text, usage, status, ...}`
// with no `model` key).

import { describe, expect, it } from 'vitest'

import type { ChatMessageWithExtras } from '../../chat/message-extras'

import { createStreamHarness } from './test-helpers'

const SID = 'session-1'

function harnessWithActive() {
  return createStreamHarness({ activeRuntimeSessionId: SID })
}

function lastAssistantMessage(h: ReturnType<typeof harnessWithActive>): ChatMessageWithExtras | undefined {
  const session = h.session(SID)

  return [...(session?.messages ?? [])].reverse().find(m => m.role === 'assistant')
}

describe('message.complete stamps model/usage onto the completed message', () => {
  it("a message.complete carrying usage lands the session's model and that usage on the message, not just the session total", () => {
    const h = harnessWithActive()

    h.dispatch({ payload: { model: 'mimo-v2.5' }, session_id: SID, type: 'session.info' })
    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({
      payload: {
        text: 'All checks passed.',
        usage: { avg_tps: 3.9, calls: 1, input: 200, output: 14_000, total: 14_200 }
      },
      session_id: SID,
      type: 'message.complete'
    })

    const message = lastAssistantMessage(h)

    expect(message?.model).toBe('mimo-v2.5')
    expect(message?.usage).toEqual({ avg_tps: 3.9, calls: 1, input: 200, output: 14_000, total: 14_200 })

    // Same numbers also folded into the session's own running total —
    // stamping the message must not replace that existing behavior.
    expect(h.session(SID)?.usage?.total).toBe(14_200)
  })

  it('a message.complete with no usage leaves the message without one — no stats line to show, even with a known model', () => {
    const h = harnessWithActive()

    h.dispatch({ payload: { model: 'mimo-v2.5' }, session_id: SID, type: 'session.info' })
    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({ payload: { text: 'Hello.' }, session_id: SID, type: 'message.complete' })

    const message = lastAssistantMessage(h)

    expect(message?.usage).toBeUndefined()
  })

  it('a fresh assistant message created straight from message.complete (no message.start) still gets the model/usage', () => {
    const h = harnessWithActive()

    h.dispatch({ payload: { model: 'deepseek-v4-flash' }, session_id: SID, type: 'session.info' })
    h.dispatch({
      payload: {
        text: 'Standalone reply.',
        usage: { calls: 1, input: 50, output: 12, total: 62 }
      },
      session_id: SID,
      type: 'message.complete'
    })

    const message = lastAssistantMessage(h)

    expect(message?.model).toBe('deepseek-v4-flash')
    expect(message?.usage).toEqual({ calls: 1, input: 50, output: 12, total: 62 })
  })

  it('no session.info seen yet leaves the completed message without a model', () => {
    const h = harnessWithActive()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({
      payload: { text: 'Hello.', usage: { calls: 1, input: 1, output: 1, total: 2 } },
      session_id: SID,
      type: 'message.complete'
    })

    const message = lastAssistantMessage(h)

    expect(message?.model).toBeUndefined()
  })
})
