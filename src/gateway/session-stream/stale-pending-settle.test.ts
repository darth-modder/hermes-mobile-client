// Ported from apps/desktop/src/app/session/hooks/use-message-stream/
// stale-pending-settle.test.tsx — a turn that ends WITHOUT its
// message.complete (turn crash, reconnect gap, steer race) used to leave its
// streaming bubble pending:true forever. session.info running=false is the
// turn's finally-block signal and the only settle edge those paths still
// emit, so it must finalize the bubble.

import { describe, expect, it } from 'vitest'

import { createStreamHarness } from './test-helpers'

const SID = 'stale-pending-session'

describe('session-stream-reducer: turn end without message.complete (session.info running=false)', () => {
  it('settles a streaming bubble that kept text', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ session_id: SID, type: 'message.start', payload: {} })
    h.dispatch({ payload: { text: 'partial answer' }, session_id: SID, type: 'message.delta' })

    expect(h.session(SID)?.messages.at(-1)?.pending).toBe(true)

    h.dispatch({ payload: { running: false }, session_id: SID, type: 'session.info' })

    const session = h.session(SID)
    const tail = session?.messages.at(-1)

    expect(tail?.role).toBe('assistant')
    expect(tail?.pending).toBe(false)
    expect(tail?.parts).toMatchObject([{ type: 'text', text: 'partial answer' }])
    expect(session?.streamId).toBeNull()
    expect(session?.busy).toBe(false)
  })

  it('drops an empty streaming placeholder instead of stranding it', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ session_id: SID, type: 'message.start', payload: {} })
    h.dispatch({
      payload: { args: { command: 'true' }, name: 'terminal', tool_id: 't1' },
      session_id: SID,
      type: 'tool.start'
    })
    h.dispatch({
      payload: { name: 'terminal', result: 'ok', tool_id: 't1' },
      session_id: SID,
      type: 'tool.complete'
    })

    h.dispatch({ payload: { running: false }, session_id: SID, type: 'session.info' })

    const session = h.session(SID)

    expect(session?.messages.every(message => !message.pending)).toBe(true)
    expect(session?.streamId).toBeNull()
  })
})
