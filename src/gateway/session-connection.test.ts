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

// session-connection.ts imports connections/secure.ts, which pulls in
// expo-secure-store -> expo-modules-core -> a bare `__DEV__` reference that
// only exists under React Native's own bundler global, not plain Node/vitest.
// Stub the whole module so the import graph resolves. Map-backed (not the
// project's other files' bare vi.fn()s) so the M08 Defect 1 tests below can
// round-trip a real stored OAuth session through connections/secure.ts's own
// getConnectionOAuth/setConnectionOAuth/deleteConnectionOAuth.
const secureStoreBacking = new Map<string, string>()

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreBacking.delete(key)
  }),
  getItemAsync: vi.fn(async (key: string) => secureStoreBacking.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreBacking.set(key, value)
  })
}))

// M08: handleSocketClose's oauth branch calls refreshConnectionOAuth
// directly — mocked here so the "on 4401, try refresh first" decision is
// exercised without a real token-refresh HTTP round trip.
const tokenRefresh = {
  ensureFreshOAuthAccessToken: vi.fn(async (): Promise<null | string> => null),
  refreshConnectionOAuth: vi.fn(async () => false)
}

vi.mock('../net/auth/token-refresh', () => tokenRefresh)

const { getActiveConnection, setActiveConnection } = await import('../connections/registry')
const { deleteConnectionOAuth, setConnectionOAuth } = await import('../connections/secure')
const { $sessionStates } = await import('../store/session-states')
const { bindSession, createReducerState } = await import('./session-stream-reducer')

const {
  ensureGatewayConnection,
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

describe('handleSocketClose: M08 — a 4401 on an oauth connection tries refresh before needsLogin', () => {
  const oauthConnection = {
    authMode: 'oauth' as const,
    baseUrl: 'http://127.0.0.1:9120',
    id: 'conn-oauth',
    kind: 'remote' as const,
    label: 'test-oauth'
  }

  beforeEach(() => {
    mmkvBacking.clear()
    setActiveConnection(oauthConnection)
    tokenRefresh.refreshConnectionOAuth.mockReset()
    resetSessionConnectionForTests()
  })

  it('a successful refresh does NOT mark the connection needsLogin', async () => {
    tokenRefresh.refreshConnectionOAuth.mockResolvedValue(true)
    // ensureGatewayConnection's own redial attempt has no real backend to
    // reach in this test — make it fail fast and predictably rather than
    // waiting on a real connection-refused timeout.
    global.fetch = vi.fn(async () => {
      throw new Error('no network in unit tests')
    }) as unknown as typeof fetch

    handleSocketClose(oauthConnection, 4401)

    await vi.waitFor(() => {
      expect(tokenRefresh.refreshConnectionOAuth).toHaveBeenCalledWith(oauthConnection.id, oauthConnection.baseUrl)
    })

    expect(getActiveConnection()?.needsLogin).toBeUndefined()
  })

  it('a failed refresh (dead refresh token) DOES mark the connection needsLogin', async () => {
    tokenRefresh.refreshConnectionOAuth.mockResolvedValue(false)

    handleSocketClose(oauthConnection, 4401)

    await vi.waitFor(() => {
      expect(getActiveConnection()?.needsLogin).toBe(true)
    })
  })

  it('does not fall through to the token/password immediate-needsLogin path', () => {
    tokenRefresh.refreshConnectionOAuth.mockResolvedValue(false)

    handleSocketClose(oauthConnection, 4401)

    // Synchronously, right after the call, nothing has flipped yet — the
    // oauth branch is async (it awaits a refresh attempt first), unlike the
    // token/password branch which sets needsLogin synchronously.
    expect(getActiveConnection()?.needsLogin).toBeUndefined()
  })
})

// M08 Defect 1 (verifier findings, 2026-09-09 device pass): a dead refresh
// token never opens a socket at all — `resolveAuth`'s ws-ticket mint 401s
// and `ensureGatewayConnection()` just rejects, so `handleSocketClose` (the
// describe block above) never runs. Before the fix these three cases all
// left `needsLogin` untouched; the middle one must STAY untouched even after
// the fix (AGENTS.md: a transient failure must never trigger a login prompt).
describe('resolveAuth (via ensureGatewayConnection): M08 Defect 1 — the pre-connect path must reach needsLogin too', () => {
  const oauthConnection = {
    authMode: 'oauth' as const,
    baseUrl: 'http://127.0.0.1:9120',
    id: 'conn-oauth',
    kind: 'remote' as const,
    label: 'test-oauth'
  }

  function unauthorizedResponse() {
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'unauthorized' }) } as Response
  }

  beforeEach(() => {
    mmkvBacking.clear()
    secureStoreBacking.clear()
    setActiveConnection(oauthConnection)
    tokenRefresh.ensureFreshOAuthAccessToken.mockReset()
    resetSessionConnectionForTests()
  })

  it('a confirmed session_expired (doRefresh already cleared the stored session) sets needsLogin even though no socket ever opened', async () => {
    // ensureFreshOAuthAccessToken already tried and failed the one silent
    // refresh the ladder allows — token-refresh.ts's doRefresh cleared the
    // stored session on its own confirmed 401, so nothing is left to read.
    tokenRefresh.ensureFreshOAuthAccessToken.mockResolvedValue(null)
    await deleteConnectionOAuth(oauthConnection.id)

    global.fetch = vi.fn(async () => unauthorizedResponse()) as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow()

    expect(getActiveConnection()?.needsLogin).toBe(true)
  })

  it('a merely unreachable provider (RT not confirmed dead) must NOT set needsLogin', async () => {
    tokenRefresh.ensureFreshOAuthAccessToken.mockResolvedValue(null)
    // The stored session survives a transient (503/timeout) failure —
    // doRefresh only clears it on a CONFIRMED session_expired.
    await setConnectionOAuth(oauthConnection.id, { accessToken: 'stale-but-unconfirmed', refreshToken: 'rt-1' })

    global.fetch = vi.fn(async () => unauthorizedResponse()) as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow()

    expect(getActiveConnection()?.needsLogin).toBeUndefined()
  })

  it('a valid access token that still draws a surprise 401 does not set needsLogin (the stored session is untouched)', async () => {
    tokenRefresh.ensureFreshOAuthAccessToken.mockResolvedValue('fresh-access-token')
    await setConnectionOAuth(oauthConnection.id, { accessToken: 'fresh-access-token', refreshToken: 'rt-1' })

    global.fetch = vi.fn(async () => unauthorizedResponse()) as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow()

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
