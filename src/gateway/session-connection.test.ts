// Covers the pure decisions session-connection.ts makes around an
// injectable gateway/store, per Opus's M06 review: "session-connection.ts is
// 581 lines with no unit tests, justified as 'almost entirely I/O.' Much of
// it is not... submitPrompt's optimistic insert / ack-flip / rollback-on-
// throw... is where a real user-visible bug already lived — the missing
// user bubble found on-device." That bug (no reducer event ever echoes the
// user's own submitted text back, so the transcript showed only the reply)
// is exactly what the first three tests below pin.
//
// react-native-mmkv isn't mocked project-wide (storage.ts's own try/catch
// makes an unmocked call fail safe — see storage.test.ts's comment), but
// `handleSocketClose`'s test needs a REAL active connection to observe the
// `needsLogin` flip, so it mocks 'react-native-mmkv' locally the same way
// storage.test.ts does.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mmkvBacking = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mmkvBacking.get(key),
    set: (key: string, value: string) => {
      mmkvBacking.set(key, value)
    },
    remove: (key: string) => mmkvBacking.delete(key)
  })
}))

// session-connection.ts imports connections/secure.ts (unused by the
// functions under test here), which pulls in expo-secure-store ->
// expo-modules-core -> a bare `__DEV__` reference that only exists under
// React Native's own bundler global, not plain Node/vitest. Stub the whole
// module so the import graph resolves; nothing in these tests calls it.
vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn()
}))

const { getActiveConnection, setActiveConnection } = await import('../connections/registry')
const { $sessionStates } = await import('../store/session-states')
const { bindSession, createReducerState } = await import('./session-stream-reducer')

const {
  handleSocketClose,
  reconnectAndProbeGateway,
  resetSessionConnectionForTests,
  setGatewayForTests,
  setReducerStateForTests,
  submitPrompt
} = await import('./session-connection')

const { JsonRpcGatewayError } = await import('../upstream/shared/json-rpc-gateway')

class FakeGateway {
  // Real connectionState after invalidate() would flip to 'closed' via the
  // client's own close/invalidateSocket handling — modeled here so a test
  // can assert reconnectAndProbeGateway() actually redials afterward instead
  // of reusing the same dead instance.
  connectionState: string = 'open'
  invalidate = vi.fn(() => {
    this.connectionState = 'closed'
  })
  request = vi.fn()
  close = vi.fn()
}

function seedSession(storedSessionId: string, runtimeSessionId: string) {
  setReducerStateForTests(bindSession(createReducerState(), runtimeSessionId, storedSessionId, { makeActive: true }))
}

describe('submitPrompt: optimistic user-message insert', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
    seedSession('stored-1', 'runtime-1')
  })

  it('appends a pending user message synchronously, before the RPC resolves', () => {
    fake.request.mockReturnValue(new Promise(() => {})) // never resolves within this test

    void submitPrompt('stored-1', 'hello')

    const session = $sessionStates.get()['stored-1']

    expect(session.messages).toHaveLength(1)
    expect(session.messages[0]).toMatchObject({ pending: true, role: 'user' })
    expect(session.messages[0].parts).toEqual([{ text: 'hello', type: 'text', timestamp: expect.any(Number) }])
  })

  it('flips pending off once the RPC ack lands, without duplicating the bubble', async () => {
    fake.request.mockResolvedValue(undefined)

    await submitPrompt('stored-1', 'hello')

    const session = $sessionStates.get()['stored-1']

    expect(session.messages).toHaveLength(1)
    expect(session.messages[0].pending).toBe(false)
  })

  it('drops the optimistic bubble entirely if the RPC itself throws — nothing to show for a submit that never reached the server', async () => {
    fake.request.mockRejectedValue(new Error('gateway not connected'))

    await expect(submitPrompt('stored-1', 'hello')).rejects.toThrow('gateway not connected')

    const session = $sessionStates.get()['stored-1']

    expect(session.messages).toHaveLength(0)
  })

  it('sends the RUNTIME id (not the stored id) to prompt.submit', async () => {
    fake.request.mockResolvedValue(undefined)

    await submitPrompt('stored-1', 'hello')

    expect(fake.request).toHaveBeenCalledWith(
      'prompt.submit',
      { session_id: 'runtime-1', text: 'hello' },
      expect.any(Number)
    )
  })

  it('joins attachment refs into the submitted text, once, and not into the optimistic bubble a second time', async () => {
    fake.request.mockResolvedValue(undefined)

    await submitPrompt('stored-1', 'hello', ['@file:a.txt'])

    expect(fake.request).toHaveBeenCalledWith(
      'prompt.submit',
      { session_id: 'runtime-1', text: 'hello\n@file:a.txt' },
      expect.any(Number)
    )

    const session = $sessionStates.get()['stored-1']

    expect(session.messages[0].parts).toEqual([{ text: 'hello', type: 'text', timestamp: expect.any(Number) }])
    expect(session.messages[0].attachmentRefs).toEqual(['@file:a.txt'])
  })

  it('sends the trimmed request even when the caller passes an empty attachment list', async () => {
    fake.request.mockResolvedValue(undefined)

    await submitPrompt('stored-1', 'hello', [])

    const session = $sessionStates.get()['stored-1']

    expect(session.messages[0].attachmentRefs).toBeUndefined()
  })

  it('a 4090 SESSION_NOT_OWNED rejection is rewritten to say the session is open elsewhere', async () => {
    fake.request.mockRejectedValue(
      new JsonRpcGatewayError('rejected', { code: 4090, data: { reason: 'SESSION_NOT_OWNED' } })
    )

    await expect(submitPrompt('stored-1', 'hello')).rejects.toThrow(/open elsewhere/)
  })

  it('a 4090 MAX_CONCURRENT_SESSIONS rejection gets its own message', async () => {
    fake.request.mockRejectedValue(
      new JsonRpcGatewayError('rejected', { code: 4090, data: { reason: 'MAX_CONCURRENT_SESSIONS' } })
    )

    await expect(submitPrompt('stored-1', 'hello')).rejects.toThrow(/Too many sessions/)
  })

  it('a non-4090 error passes through unchanged', async () => {
    fake.request.mockRejectedValue(new Error('boom'))

    await expect(submitPrompt('stored-1', 'hello')).rejects.toThrow('boom')
  })
})

describe('handleSocketClose: AGENTS.md "Credentials and reauth" applied to WS close codes', () => {
  const connection = {
    authMode: 'token' as const,
    baseUrl: 'http://127.0.0.1:9119',
    id: 'conn-1',
    kind: 'remote' as const,
    label: 'test'
  }

  beforeEach(() => {
    mmkvBacking.clear()
    setActiveConnection(connection)
  })

  it('4401 (confirmed unauthorized) marks the active connection needsLogin', () => {
    handleSocketClose(connection, 4401)

    expect(getActiveConnection()?.needsLogin).toBe(true)
  })

  it('4403 (confirmed forbidden) does not prompt a login', () => {
    handleSocketClose(connection, 4403)

    expect(getActiveConnection()?.needsLogin).toBeUndefined()
  })

  it('every other close code (timeout/5xx/refusal-shaped) never prompts a login — AGENTS.md: only a confirmed 401/403 does', () => {
    for (const code of [1000, 1006, 4000, 4500]) {
      handleSocketClose(connection, code)

      expect(getActiveConnection()?.needsLogin).toBeUndefined()
    }
  })

  it('does not touch a DIFFERENT connection than the one whose socket closed', () => {
    const other = { ...connection, id: 'conn-2' }

    handleSocketClose(other, 4401)

    expect(getActiveConnection()?.needsLogin).toBeUndefined()
  })
})

// The M06/M07 attachment-round bug: a socket that silently died while
// backgrounded (no close/error event ever fired — a stale Wi-Fi AP, a NAT
// timeout, or the OS reclaiming a backgrounded app's transport) still reports
// connectionState 'open'. The foreground-return ping probe is the one thing
// designed to catch this, but a probe *timeout* only rejects that one pending
// call (JsonRpcGatewayClient.request()'s own timeout branch) — it never runs
// the client's close handling. Before this fix, the probe's failure was
// swallowed outright, so the same broken instance kept being handed out by
// every requireGateway()-based RPC (attach, submit, ...) forever, each one
// silently hanging for its own timeout instead of failing visibly — exactly
// what looked like "file.attach breaks the whole connection".
describe('reconnectAndProbeGateway: a half-open socket must not stay wedged forever', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    setActiveConnection(null)
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
  })

  it('invalidates the connection when the ping probe times out', async () => {
    fake.request.mockRejectedValue(new Error('request timed out after 5s: ping'))

    await reconnectAndProbeGateway()

    expect(fake.invalidate).toHaveBeenCalledTimes(1)
  })

  it('the connection no longer reports open after a probe timeout, so the next call redials instead of reusing it', async () => {
    fake.request.mockRejectedValue(new Error('request timed out after 5s: ping'))

    await reconnectAndProbeGateway()

    expect(fake.connectionState).toBe('closed')
  })

  it('does not invalidate a probe that succeeds', async () => {
    fake.request.mockResolvedValue(undefined)

    await reconnectAndProbeGateway()

    expect(fake.invalidate).not.toHaveBeenCalled()
    expect(fake.connectionState).toBe('open')
  })

  it('never throws, even though there is no active connection to redial to after invalidating', async () => {
    fake.request.mockRejectedValue(new Error('request timed out after 5s: ping'))

    await expect(reconnectAndProbeGateway()).resolves.toBeUndefined()
  })
})
