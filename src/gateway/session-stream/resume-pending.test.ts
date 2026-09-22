// D10.2 / D31 / D32: session.resume's pending_approval/pending_clarify
// restore a request that arrived while the transport was detached (or that a
// session.reclaimed replaced with a fresh runtime session) — see
// resume-pending.ts's own doc comment for the full design, including why
// sudo/secret need the `current`/`runtimeSessionId` machinery approval/
// clarify don't. Unit-tested at the reducer level, independent of the
// connection layer: resumeSession() (session-connection.ts) just calls this
// function with the real RPC response, so covering its input/output here
// covers both reconnect branches without needing a live socket.
//
// Every fixture below includes `session_id` and `running` — D32's
// validation gate requires both before reconciling anything at all — mirrors
// what a real session.resume response always carries for THIS client (it
// never sends `lazy`, so `running` is always a real boolean; see
// session-connection.ts's own call site and its test pinning the request
// shape).

import { describe, expect, it } from 'vitest'

import { updateSession } from '../session-stream-reducer'

import { reconcilePendingRequestsFromResume } from './resume-pending'
import { createStreamHarness } from './test-helpers'

const SID = 'session-1'
const RUNTIME = 'runtime-1'
const RUNTIME_2 = 'runtime-2'

describe('reconcilePendingRequestsFromResume: approval/clarify — present sets, absent clears, no live/cold branch', () => {
  it('mounts the approval card state exactly like a live approval.request', () => {
    const h = createStreamHarness()

    const { state, effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      pending_approval: {
        allow_permanent: false,
        choices: ['once', 'deny'],
        command: 'rm -rf /tmp/x',
        description: 'delete in root path',
        request_id: 'req-approval',
        smart_denied: true
      },
      resumed: SID,
      running: true,
      session_id: RUNTIME
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

    const { state, effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      pending_clarify: { choices: ['a', 'b'], question: 'Which one?', request_id: 'req-clarify' },
      resumed: SID,
      running: true,
      session_id: RUNTIME
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

    const { effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      pending_clarify: {
        questions: [
          { qid: 'q0', question: 'First?' },
          { qid: 'q1', question: 'Second?' }
        ],
        request_id: 'req-batch'
      },
      resumed: SID,
      running: true,
      session_id: RUNTIME
    })

    const setClarify = effects.find((e): e is Extract<typeof e, { type: 'setClarify' }> => e.type === 'setClarify')

    expect(setClarify?.request?.questions).toEqual([
      { choices: null, multiSelect: false, qid: 'q0', question: 'First?' },
      { choices: null, multiSelect: false, qid: 'q1', question: 'Second?' }
    ])
  })

  it('a pending_clarify with no request_id is dropped, same as a malformed live clarify.request', () => {
    const h = createStreamHarness()

    const { effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      pending_clarify: { question: 'orphaned' },
      resumed: SID,
      running: true,
      session_id: RUNTIME
    })

    expect(effects.some(e => e.type === 'setClarify' && e.request !== null)).toBe(false)
  })

  it('an absent pending_approval/pending_clarify clears an existing card — no live/cold branch needed', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({
      payload: { command: 'ls', description: 'list', request_id: 'req-old' },
      session_id: SID,
      type: 'approval.request'
    })
    expect(h.session(SID)?.needsInput).toBe(true)

    const { state, effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      resumed: SID,
      running: false,
      session_id: RUNTIME_2
    })

    expect(effects).toContainEqual({ type: 'setApproval', storedSessionId: SID, request: null })
    expect(state.sessions.get(SID)?.needsInput).toBe(false)
  })
})

describe('reconcilePendingRequestsFromResume: validation gate — an unusable response reconciles nothing', () => {
  it('a response with no session_id at all: no effects, state untouched', () => {
    const h = createStreamHarness()
    const before = h.getState()

    const { state, effects } = reconcilePendingRequestsFromResume(before, SID, {
      message_count: 0,
      messages: [],
      pending_approval: { command: 'rm -rf /tmp/x', description: 'dangerous', request_id: 'req-approval' },
      resumed: SID,
      running: true,
      session_id: ''
    })

    expect(effects).toEqual([])
    expect(state).toBe(before)
  })

  it('a response where running is not a boolean: no effects, state untouched', () => {
    const h = createStreamHarness()
    const before = h.getState()

    const { state, effects } = reconcilePendingRequestsFromResume(before, SID, {
      message_count: 0,
      messages: [],
      resumed: SID,
      running: undefined,
      session_id: RUNTIME
    })

    expect(effects).toEqual([])
    expect(state).toBe(before)
  })

  it('a malformed response does NOT clear an already-live sudo card — the whole point of failing closed', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.request' })
    expect(h.session(SID)?.pendingSudoRequestId).toBe('req-sudo')

    const { state, effects } = reconcilePendingRequestsFromResume(
      h.getState(),
      SID,
      // @ts-expect-error deliberately malformed
      { message_count: 0, messages: [], resumed: SID, running: true, session_id: undefined },
      { sudo: { runtimeSessionId: RUNTIME } }
    )

    expect(effects).toEqual([])
    expect(state.sessions.get(SID)?.pendingSudoRequestId).toBe('req-sudo')
  })
})

describe('reconcilePendingRequestsFromResume: sudo/secret — no resume field, keep only on a live, same-runtime-id turn', () => {
  it('running=false clears a sudo card unconditionally — covers the cold-resume case', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.request' })

    const { state, effects } = reconcilePendingRequestsFromResume(
      h.getState(),
      SID,
      { message_count: 0, messages: [], resumed: SID, running: false, session_id: RUNTIME_2 },
      { sudo: { runtimeSessionId: RUNTIME } }
    )

    expect(effects).toContainEqual({ type: 'setSudo', storedSessionId: SID, request: null })
    expect(state.sessions.get(SID)?.pendingSudoRequestId).toBeNull()
    expect(state.sessions.get(SID)?.needsInput).toBe(false)
  })

  it('running=true but a DIFFERENT session_id than the request arrived under clears it — new server-side session, old wait is dead', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const { effects } = reconcilePendingRequestsFromResume(
      h.getState(),
      SID,
      { message_count: 0, messages: [], resumed: SID, running: true, session_id: RUNTIME_2 },
      { sudo: { runtimeSessionId: RUNTIME } }
    )

    expect(effects).toContainEqual({ type: 'setSudo', storedSessionId: SID, request: null })
  })

  it('running=true and the SAME session_id the request arrived under keeps it', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({ payload: { request_id: 'req-sudo' }, session_id: SID, type: 'sudo.request' })

    const { state, effects } = reconcilePendingRequestsFromResume(
      h.getState(),
      SID,
      { message_count: 0, messages: [], resumed: SID, running: true, session_id: RUNTIME },
      { sudo: { runtimeSessionId: RUNTIME } }
    )

    expect(effects.some(e => e.type === 'setSudo')).toBe(false)
    expect(state.sessions.get(SID)?.pendingSudoRequestId).toBe('req-sudo')
    expect(state.sessions.get(SID)?.needsInput).toBe(true)
  })

  it('no current sudo/secret at all: nothing to keep, no clearing effect needed either (already absent)', () => {
    const h = createStreamHarness()

    const { effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      resumed: SID,
      running: true,
      session_id: RUNTIME
    })

    // The store already has nothing — clearing is still sent (idempotent,
    // matches Part 1's clearPendingRequest being a plain "set to null").
    expect(effects).toContainEqual({ type: 'setSudo', storedSessionId: SID, request: null })
  })

  it('the same rule applies to secret, independently of sudo', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret' },
      session_id: SID,
      type: 'secret.request'
    })

    const kept = reconcilePendingRequestsFromResume(
      h.getState(),
      SID,
      { message_count: 0, messages: [], resumed: SID, running: true, session_id: RUNTIME },
      { secret: { runtimeSessionId: RUNTIME } }
    )

    expect(kept.effects.some(e => e.type === 'setSecret')).toBe(false)

    const cleared = reconcilePendingRequestsFromResume(
      h.getState(),
      SID,
      { message_count: 0, messages: [], resumed: SID, running: false, session_id: RUNTIME_2 },
      { secret: { runtimeSessionId: RUNTIME } }
    )

    expect(cleared.effects).toContainEqual({ type: 'setSecret', storedSessionId: SID, request: null })
  })
})

describe('reconcilePendingRequestsFromResume: the "spinner" — busy/turnLive follow `running`', () => {
  it('running=true sets busy/turnLive', () => {
    const h = createStreamHarness()

    const { state } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      resumed: SID,
      running: true,
      session_id: RUNTIME,
      turn_started_at: 1_700_000_000
    })

    expect(state.sessions.get(SID)?.busy).toBe(true)
    expect(state.sessions.get(SID)?.turnLive).toBe(true)
    expect(state.sessions.get(SID)?.turnStartedAt).toBe(1_700_000_000 * 1000)
  })

  it('running=false clears busy/turnLive/turnStartedAt/streamId', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    h.setState(
      updateSession(h.getState(), SID, session => ({
        ...session,
        busy: true,
        streamId: 'stream-1',
        turnLive: true,
        turnStartedAt: 123
      })).state
    )

    const { state } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      resumed: SID,
      running: false,
      session_id: RUNTIME
    })

    expect(state.sessions.get(SID)?.busy).toBe(false)
    expect(state.sessions.get(SID)?.turnLive).toBe(false)
    expect(state.sessions.get(SID)?.turnStartedAt).toBeNull()
    expect(state.sessions.get(SID)?.streamId).toBeNull()
  })
})

describe('reconcilePendingRequestsFromResume: both reconnect branches behave identically', () => {
  // "Both reclaim branches": resumeSession() (session-connection.ts) calls
  // this function identically whether or not the server reclaimed the
  // session in between — the only difference between the branches is
  // whether local session state already existed going in. Both must restore
  // the same pending_approval/pending_clarify snapshot correctly.
  it('restores identically starting from no local session state (a fresh runtime bind, the in-grace reconnect shape)', () => {
    const h = createStreamHarness()

    expect(h.getState().sessions.get(SID)).toBeUndefined()

    const { effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      pending_approval: { command: 'rm -rf /tmp/x', description: 'dangerous', request_id: 'req-approval' },
      resumed: SID,
      running: true,
      session_id: RUNTIME
    })

    expect(effects.some(e => e.type === 'setApproval')).toBe(true)
  })

  it('restores identically starting from carried-over local session state (the post-reclaim rebind shape)', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    // Simulate state surviving a session.reclaimed rebind: the session
    // already has an unrelated field set before this resume.
    h.setState(updateSession(h.getState(), SID, session => ({ ...session, title: 'Carried over' })).state)

    const { effects } = reconcilePendingRequestsFromResume(h.getState(), SID, {
      message_count: 0,
      messages: [],
      pending_approval: { command: 'rm -rf /tmp/x', description: 'dangerous', request_id: 'req-approval' },
      resumed: SID,
      running: true,
      session_id: RUNTIME
    })

    expect(effects.some(e => e.type === 'setApproval')).toBe(true)
  })
})
