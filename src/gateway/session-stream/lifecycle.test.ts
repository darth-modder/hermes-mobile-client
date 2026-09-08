// M07: gateway.ready's replay_epoch change (cold start after a backend
// restart) and replay.truncated (the transport layer's own synthesized event
// when a reconnect's replay came back with events dropped from the server's
// ring buffer) — both previously unhandled, both now route through the same
// `hydrate` effect session.reclaimed already uses for "our view might be
// stale".

import { describe, expect, it } from 'vitest'

import { bindSession } from '../session-stream-reducer'

import { createStreamHarness } from './test-helpers'

const SID = 'session-1'
const RUNTIME_ID = 'runtime-1'

describe('session-stream-reducer: gateway.ready replay_epoch', () => {
  it('the first gateway.ready ever seen adopts the epoch without treating it as a restart', () => {
    const h = createStreamHarness()

    const effects = h.dispatch({ payload: { replay_epoch: 'epoch-a' }, type: 'gateway.ready' })

    expect(effects).toEqual([])
    expect(h.getState().lastReplayEpoch).toBe('epoch-a')
  })

  it('the same epoch on a later gateway.ready is an ordinary reconnect, not a restart', () => {
    const h = createStreamHarness()

    h.dispatch({ payload: { replay_epoch: 'epoch-a' }, type: 'gateway.ready' })
    const effects = h.dispatch({ payload: { replay_epoch: 'epoch-a' }, type: 'gateway.ready' })

    expect(effects).toEqual([])
  })

  it('a changed epoch drops the runtime->stored map and refreshes the session list', () => {
    let h = createStreamHarness()

    h.setState(bindSession(h.getState(), RUNTIME_ID, SID))
    h.dispatch({ payload: { replay_epoch: 'epoch-a' }, type: 'gateway.ready' })

    expect(h.getState().runtimeToStored.get(RUNTIME_ID)).toBe(SID)

    const effects = h.dispatch({ payload: { replay_epoch: 'epoch-b' }, type: 'gateway.ready' })

    expect(effects).toContainEqual({ type: 'refreshSessions' })
    expect(h.getState().runtimeToStored.size).toBe(0)
    expect(h.getState().lastReplayEpoch).toBe('epoch-b')
  })

  it('a changed epoch re-resumes the active session, not an inactive one', () => {
    const h = createStreamHarness()

    h.setState(bindSession(h.getState(), RUNTIME_ID, SID, { makeActive: true }))
    h.dispatch({ payload: { replay_epoch: 'epoch-a' }, type: 'gateway.ready' })

    const effects = h.dispatch({ payload: { replay_epoch: 'epoch-b' }, type: 'gateway.ready' })

    expect(effects).toContainEqual({
      type: 'hydrate',
      storedSessionId: SID,
      runtimeSessionId: null,
      attempts: 3
    })
  })

  it('a changed epoch with no active session only refreshes the list, no hydrate', () => {
    const h = createStreamHarness()

    h.dispatch({ payload: { replay_epoch: 'epoch-a' }, type: 'gateway.ready' })

    const effects = h.dispatch({ payload: { replay_epoch: 'epoch-b' }, type: 'gateway.ready' })

    expect(effects).toEqual([{ type: 'refreshSessions' }])
  })
})

describe('session-stream-reducer: replay.truncated', () => {
  it('hydrates the session the truncated replay was for', () => {
    let h = createStreamHarness()

    h.setState(bindSession(h.getState(), RUNTIME_ID, SID))

    const effects = h.dispatch({ session_id: RUNTIME_ID, payload: { latest_seq: 42 }, type: 'replay.truncated' })

    expect(effects).toContainEqual({
      type: 'hydrate',
      storedSessionId: SID,
      runtimeSessionId: null,
      attempts: 3
    })
  })

  it('falls back to the runtime id as a placeholder when it was never bound to a stored session', () => {
    // Matches the router preamble's documented "placeholder key" convention
    // (session-connection.ts's runtimeIdForStored): a session with no
    // session.info yet has no runtime->stored mapping, so the runtime id
    // stands in for the stored id. Best-effort hydrate is still correct here
    // — session.resume against that id either succeeds or the caller's own
    // retry/backoff (rehydrateSession) gives up cleanly.
    const h = createStreamHarness()

    const effects = h.dispatch({ session_id: 'unknown-runtime', payload: {}, type: 'replay.truncated' })

    expect(effects).toContainEqual({
      type: 'hydrate',
      storedSessionId: 'unknown-runtime',
      runtimeSessionId: null,
      attempts: 3
    })
  })

  it('does nothing for an event with no session id at all', () => {
    const h = createStreamHarness()

    const effects = h.dispatch({ payload: {}, type: 'replay.truncated' })

    expect(effects).toEqual([])
  })
})
