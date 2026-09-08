// D10.2: session.resume's pending_approval/pending_clarify restore a request
// that arrived while the transport was detached (or that a session.reclaimed
// replaced with a fresh runtime session) — see resume-pending.ts's own doc
// comment. Unit-tested at the reducer level, independent of the connection
// layer: resumeSession() (session-connection.ts) just calls this function
// with the real RPC response, so covering its input/output here covers both
// reconnect branches without needing a live socket.

import { describe, expect, it } from 'vitest'

import { updateSession } from '../session-stream-reducer'

import { restorePendingRequestsFromResume } from './resume-pending'
import { createStreamHarness } from './test-helpers'

const SID = 'session-1'

describe('restorePendingRequestsFromResume', () => {
  it('mounts the approval card state exactly like a live approval.request', () => {
    const h = createStreamHarness()

    const { state, effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_approval: {
        allow_permanent: false,
        choices: ['once', 'deny'],
        command: 'rm -rf /tmp/x',
        description: 'delete in root path',
        request_id: 'req-approval',
        smart_denied: true
      }
    })

    expect(effects).toContainEqual({
      type: 'setApproval',
      storedSessionId: SID,
      request: {
        allowPermanent: false,
        choices: ['once', 'deny'],
        command: 'rm -rf /tmp/x',
        description: 'delete in root path',
        requestId: 'req-approval',
        smartDenied: true,
        storedSessionId: SID
      }
    })
    expect(effects).toContainEqual({ type: 'scrollToBottom', storedSessionId: SID })
    expect(state.sessions.get(SID)?.needsInput).toBe(true)
  })

  it('mounts the clarify card state exactly like a live clarify.request', () => {
    const h = createStreamHarness()

    const { state, effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_clarify: { choices: ['a', 'b'], question: 'Which one?', request_id: 'req-clarify' }
    })

    expect(effects).toContainEqual({
      type: 'setClarify',
      storedSessionId: SID,
      request: {
        choices: ['a', 'b'],
        lockedAnswers: undefined,
        multiSelect: false,
        question: 'Which one?',
        questions: [],
        receivedAt: expect.any(Number),
        requestId: 'req-clarify',
        storedSessionId: SID
      }
    })
    expect(state.sessions.get(SID)?.pendingClarifyRequestId).toBe('req-clarify')
    expect(state.sessions.get(SID)?.needsInput).toBe(true)
  })

  it('a batch clarify (questions array) restores the same way a live batch clarify.request does', () => {
    const h = createStreamHarness()

    const { effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_clarify: {
        questions: [
          { qid: 'q0', question: 'First?' },
          { qid: 'q1', question: 'Second?' }
        ],
        request_id: 'req-batch'
      }
    })

    const setClarify = effects.find(e => e.type === 'setClarify')

    expect(setClarify?.type === 'setClarify' && setClarify.request?.questions).toEqual([
      { choices: null, multiSelect: false, qid: 'q0', question: 'First?' },
      { choices: null, multiSelect: false, qid: 'q1', question: 'Second?' }
    ])
  })

  it('a pending_clarify with no request_id is dropped, same as a malformed live clarify.request', () => {
    const h = createStreamHarness()

    const { state, effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_clarify: { question: 'orphaned' }
    })

    expect(effects.some(e => e.type === 'setClarify')).toBe(false)
    expect(state.sessions.get(SID)).toBeUndefined()
  })

  it('resume with neither field clears nothing when nothing is stale — a pure no-op', () => {
    const h = createStreamHarness()

    const before = h.getState()
    const { state, effects } = restorePendingRequestsFromResume(before, SID, {})

    expect(effects).toEqual([])
    expect(state).toBe(before)
  })

  it('clears a stale sudo request unconditionally on hydrate, since sudo has no resume field', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.request' })
    expect(h.session(SID)?.needsInput).toBe(true)

    const { state, effects } = restorePendingRequestsFromResume(h.getState(), SID, {})

    expect(effects).toContainEqual({ type: 'setSudo', storedSessionId: SID, request: null })
    expect(state.sessions.get(SID)?.pendingSudoRequestId).toBeNull()
    expect(state.sessions.get(SID)?.needsInput).toBe(false)
  })

  it('clears a stale secret request unconditionally on hydrate, since secret has no resume field', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret' },
      session_id: SID,
      type: 'secret.request'
    })
    expect(h.session(SID)?.needsInput).toBe(true)

    const { state, effects } = restorePendingRequestsFromResume(h.getState(), SID, {})

    expect(effects).toContainEqual({ type: 'setSecret', storedSessionId: SID, request: null })
    expect(state.sessions.get(SID)?.pendingSecretRequestId).toBeNull()
    expect(state.sessions.get(SID)?.needsInput).toBe(false)
  })

  it('a fresh approval alongside a stale secret both land in one call (an approval taking over from an expired secret prompt)', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret' },
      session_id: SID,
      type: 'secret.request'
    })

    const { state, effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_approval: { command: 'rm -rf /tmp/x', description: 'dangerous', request_id: 'req-approval' }
    })

    expect(effects).toContainEqual({ type: 'setSecret', storedSessionId: SID, request: null })
    expect(effects.some(e => e.type === 'setApproval')).toBe(true)
    expect(state.sessions.get(SID)?.pendingSecretRequestId).toBeNull()
    expect(state.sessions.get(SID)?.needsInput).toBe(true)
  })

  // "Both reclaim branches": resumeSession() (session-connection.ts) calls
  // this function identically whether or not the server reclaimed the
  // session in between — the only difference between the branches is
  // whether local session state already existed going in. Both must restore
  // the same pending_approval/pending_clarify snapshot correctly.
  it('restores identically starting from no local session state (a fresh runtime bind, the in-grace reconnect shape)', () => {
    const h = createStreamHarness()

    expect(h.getState().sessions.get(SID)).toBeUndefined()

    const { effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_approval: { command: 'rm -rf /tmp/x', description: 'dangerous', request_id: 'req-approval' }
    })

    expect(effects.some(e => e.type === 'setApproval')).toBe(true)
  })

  it('restores identically starting from carried-over local session state (the post-reclaim rebind shape)', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    // Simulate state surviving a session.reclaimed rebind: the session
    // already has an unrelated live-turn field set before this resume.
    h.setState(updateSession(h.getState(), SID, session => ({ ...session, busy: true, title: 'Carried over' })).state)

    const { effects } = restorePendingRequestsFromResume(h.getState(), SID, {
      pending_approval: { command: 'rm -rf /tmp/x', description: 'dangerous', request_id: 'req-approval' }
    })

    expect(effects.some(e => e.type === 'setApproval')).toBe(true)
  })
})
