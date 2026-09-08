// Found live, on-device while testing SecretCard's skip branch (M06 round 4):
// the server's default 300s `_block` wait times out and emits `sudo.expire` /
// `secret.expire` (both listed in `_EXPIRING_REQUESTS`, tui_gateway/server.py),
// but nothing in this reducer handled either event, so SudoCard/SecretCard
// stayed mounted forever — and FLAG_SECURE stayed engaged — for a request the
// server had already resolved as "skipped". `clarify.expire` already handled
// this correctly, including the request-id correlation guard against a stale
// expire clearing a newer request; this mirrors that for sudo and secret.

import { describe, expect, it } from 'vitest'

import { createStreamHarness } from './test-helpers'

const SID = 'session-1'

describe('session-stream-reducer: sudo.expire / secret.expire', () => {
  it('clears the sudo request when the expire matches the pending request id', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.request' })

    expect(h.session(SID)?.needsInput).toBe(true)

    const effects = h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.expire' })

    expect(effects).toContainEqual({ type: 'setSudo', storedSessionId: SID, request: null })
    expect(h.session(SID)?.needsInput).toBe(false)
  })

  it('ignores a stale sudo.expire for a request that was already superseded', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-old' }, session_id: SID, type: 'sudo.request' })
    h.dispatch({ payload: { request_id: 'req-new' }, session_id: SID, type: 'sudo.request' })

    const effects = h.dispatch({ payload: { request_id: 'req-old' }, session_id: SID, type: 'sudo.expire' })

    expect(effects.some(e => e.type === 'setSudo')).toBe(false)
    expect(h.session(SID)?.needsInput).toBe(true)
  })

  it('clears the secret request when the expire matches the pending request id', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret' },
      session_id: SID,
      type: 'secret.request'
    })

    expect(h.session(SID)?.needsInput).toBe(true)

    const effects = h.dispatch({ payload: { request_id: 'req-secret' }, session_id: SID, type: 'secret.expire' })

    expect(effects).toContainEqual({ type: 'setSecret', storedSessionId: SID, request: null })
    expect(h.session(SID)?.needsInput).toBe(false)
  })

  it('ignores a stale secret.expire for a request that was already superseded', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'first', request_id: 'req-old' },
      session_id: SID,
      type: 'secret.request'
    })
    h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'second', request_id: 'req-new' },
      session_id: SID,
      type: 'secret.request'
    })

    const effects = h.dispatch({ payload: { request_id: 'req-old' }, session_id: SID, type: 'secret.expire' })

    expect(effects.some(e => e.type === 'setSecret')).toBe(false)
    expect(h.session(SID)?.needsInput).toBe(true)
  })

  it('ignores an expire with no request id', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.request' })

    const effects = h.dispatch({ payload: {}, session_id: SID, type: 'sudo.expire' })

    expect(effects.some(e => e.type === 'setSudo')).toBe(false)
    expect(h.session(SID)?.needsInput).toBe(true)
  })
})
