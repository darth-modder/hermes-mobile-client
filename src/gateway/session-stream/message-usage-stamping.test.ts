// M15 B, task 2: `message.complete`'s own `model`/`usage` fields must land
// on the completed ChatMessage itself (Response stats), not just merge into
// the session-wide running total (`SessionState.usage`, session-info.ts) —
// see message-stream.ts's `completeAssistantMessage`.

import { describe, expect, it } from 'vitest'

import { createStreamHarness } from './test-helpers'

const SID = 'session-1'

function harnessWithActive() {
  return createStreamHarness({ activeRuntimeSessionId: SID })
}

function lastAssistantMessage(h: ReturnType<typeof harnessWithActive>) {
  const session = h.session(SID)

  return [...(session?.messages ?? [])].reverse().find(m => m.role === 'assistant')
}

describe('message.complete stamps model/usage onto the completed message', () => {
  it('a message.complete carrying both lands them on the message, not just the session total', () => {
    const h = harnessWithActive()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({
      payload: {
        model: 'mimo-v2.5',
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

  it('a message.complete with no usage leaves the message without one — no stats line to show', () => {
    const h = harnessWithActive()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({ payload: { text: 'Hello.' }, session_id: SID, type: 'message.complete' })

    const message = lastAssistantMessage(h)

    expect(message?.usage).toBeUndefined()
    expect(message?.model).toBeUndefined()
  })

  it('a fresh assistant message created straight from message.complete (no message.start) still gets model/usage', () => {
    const h = harnessWithActive()

    h.dispatch({
      payload: {
        model: 'deepseek-v4-flash',
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
})
