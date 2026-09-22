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

// D31: respondApproval/respondClarify/respondSudo/respondSecret now dismiss
// the OS notification through the same clearPendingRequest path dispatchEffects
// uses — mocked here (not expo-notifications directly) so the describe block
// below can assert on `dismissNativeNotification` itself, the same way
// native-notifications.test.ts mocks expo-notifications for its own module.
const dismissNativeNotification = vi.fn(async () => undefined)

vi.mock('../push/native-notifications', () => ({
  dismissAllNativeNotifications: vi.fn(async () => undefined),
  dismissNativeNotification,
  dispatchNativeNotification: vi.fn(async () => false)
}))

const { getActiveConnection, setActiveConnection } = await import('../connections/registry')
const { deleteConnectionOAuth, setConnectionOAuth } = await import('../connections/secure')

const { $approvalRequests, $secretRequests, $sudoRequests, setApprovalRequest, setSecretRequest, setSudoRequest } =
  await import('../store/prompts')

const { $clarifyRequests, setClarifyRequest } = await import('../store/clarify')
const { $notifications } = await import('../store/notifications')
const { $activeRuntimeSessionId, $runtimeToStored, $sessionStates } = await import('../store/session-states')
const { bindSession, createReducerState } = await import('./session-stream-reducer')

const {
  ensureGatewayConnection,
  handleSocketClose,
  reconnectAndProbeGateway,
  resetSessionConnectionForTests,
  resumeSession,
  respondApproval,
  respondClarify,
  respondSecret,
  respondSudo,
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

describe('resumeSession: M15 Deviation 5 — a Bot Chat needs `profile` to be found', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
  })

  it("sends no `profile` for a plain session — matches session.resume's existing behavior", async () => {
    fake.request.mockResolvedValue({ session_id: 'runtime-1' })

    await resumeSession('stored-1')

    expect(fake.request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-1' })
  })

  it("sends `profile` when the caller passes one (the chat screen's botId route param)", async () => {
    fake.request.mockResolvedValue({ session_id: 'runtime-1' })

    await resumeSession('stored-1', undefined, 'researcher')

    expect(fake.request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-1', profile: 'researcher' })
  })

  it("remembers a Bot Chat's profile so a later call with none supplied still sends it — this is what lets rehydrateSession recover one without ever seeing a route param", async () => {
    fake.request.mockResolvedValue({ session_id: 'runtime-1' })

    await resumeSession('stored-1', undefined, 'researcher')
    fake.request.mockClear()
    await resumeSession('stored-1')

    expect(fake.request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-1', profile: 'researcher' })
  })

  it('an explicit profile on a later call overrides the remembered one', async () => {
    fake.request.mockResolvedValue({ session_id: 'runtime-1' })

    await resumeSession('stored-1', undefined, 'researcher')
    fake.request.mockClear()
    await resumeSession('stored-1', undefined, 'coder')

    expect(fake.request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-1', profile: 'coder' })
  })
})

describe("resumeSession/createSession: a reopened session's model/provider/effort must reflect the server, not go stale", () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
  })

  it("resumeSession applies session.resume's own `info` onto the session state — not just messages", async () => {
    fake.request.mockResolvedValue({
      info: { model: 'deepseek-v4-flash', provider: 'nous', reasoning_effort: 'high' },
      session_id: 'runtime-1'
    })

    await resumeSession('stored-1')

    const session = $sessionStates.get()['stored-1']

    expect(session.model).toBe('deepseek-v4-flash')
    expect(session.provider).toBe('nous')
    expect(session.reasoningEffort).toBe('high')
  })

  it('a stale model/effort left over from a prior open (e.g. before a force-stop/relaunch) is overwritten by the fresh resume, not left stuck', async () => {
    fake.request.mockResolvedValue({
      info: { model: 'deepseek-v4-flash', provider: 'nous', reasoning_effort: 'high' },
      session_id: 'runtime-1'
    })
    await resumeSession('stored-1')
    expect($sessionStates.get()['stored-1'].model).toBe('deepseek-v4-flash')

    // Simulates reopening the same session after the model/effort were
    // changed elsewhere (another client, or this session before the app was
    // killed) — this client never saw a live session.info for the change.
    fake.request.mockResolvedValue({
      info: { model: 'mimo-v2.5', provider: 'moonshot', reasoning_effort: 'low' },
      session_id: 'runtime-1'
    })
    await resumeSession('stored-1')

    const session = $sessionStates.get()['stored-1']

    expect(session.model).toBe('mimo-v2.5')
    expect(session.reasoningEffort).toBe('low')
  })

  it('a resume response with no `info` at all leaves the session state untouched — nothing to apply', async () => {
    fake.request.mockResolvedValue({ session_id: 'runtime-1' })

    // A known title forces the session entry to materialize (seedSessionTitle
    // also uses updateSession's create-if-missing) so there is something to
    // read back — resumeSession's own bindSession doesn't materialize one for
    // a runtime id it has never seen live state for (session-keys.ts).
    await resumeSession('stored-1', 'My Session')

    const session = $sessionStates.get()['stored-1']

    expect(session.model).toBe('')
  })

  it("createSession applies session.create's own `info` onto the fresh session too", async () => {
    fake.request.mockResolvedValue({
      info: { model: 'deepseek-v4-flash', provider: 'nous' },
      session_id: 'runtime-1',
      stored_session_id: 'stored-1'
    })

    const { createSession } = await import('./session-connection')

    const storedId = await createSession()

    expect(storedId).toBe('stored-1')
    expect($sessionStates.get()['stored-1'].model).toBe('deepseek-v4-flash')
  })
})

// D31 point 6 / D32: resumeSession wires mergeInflightIntoMessages in after
// seedSessionMessages — a mid-turn resume must show the partial assistant
// reply, not just the user's message with nothing after it. The pure merge
// logic itself (same-row live delta, the excluded error/absent/not-streaming
// shapes) is covered at the reducer level in inflight-merge.test.ts; these
// pin that resumeSession actually reaches it with the real response field.
describe('resumeSession: mid-turn inflight merges into the transcript (D31 point 6 / D32)', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
  })

  it("shows the user's message AND the partial assistant text from a mid-turn resume", async () => {
    fake.request.mockResolvedValue({
      inflight: { assistant: 'Working on it, give me a', streaming: true },
      messages: [{ content: 'are you there?', role: 'user' }],
      session_id: 'runtime-1'
    })

    await resumeSession('stored-1')

    const messages = $sessionStates.get()['stored-1'].messages

    expect(messages.map(m => m.role)).toEqual(['user', 'assistant'])
    expect(messages[1].pending).toBe(true)
    expect(messages[1].parts).toEqual([
      { text: 'Working on it, give me a', timestamp: expect.any(Number), type: 'text' }
    ])
  })

  it('no inflight in the response: the transcript is exactly what messages carried, nothing extra appended', async () => {
    fake.request.mockResolvedValue({
      messages: [{ content: 'are you there?', role: 'user' }],
      session_id: 'runtime-1'
    })

    await resumeSession('stored-1')

    const messages = $sessionStates.get()['stored-1'].messages

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
  })

  it('inflight with an error is left alone — no partial-reply row, not half-rendered', async () => {
    fake.request.mockResolvedValue({
      inflight: { assistant: 'partial before the failure', error: 'API call failed after 3 retries', streaming: true },
      messages: [{ content: 'are you there?', role: 'user' }],
      session_id: 'runtime-1'
    })

    await resumeSession('stored-1')

    const messages = $sessionStates.get()['stored-1'].messages

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
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

// D24 part 1: Opus reproduced this on device (EXPIRY-PATH-2026-09-19.md) — a
// password connection whose session the gateway invalidated never gets a
// socket open at all. `resolveAuth`'s ws-ticket mint 401s first,
// `ensureGatewayConnection()` rejects, so `handleSocketClose` above (which IS
// correct) never runs, and before this fix the ws-ticket catch only set the
// screen-level `ConnectionAttention`, never the persisted `needsLogin` the
// gateway card and every list screen actually read.
describe("resolveAuth (via ensureGatewayConnection): a password connection's ws-ticket 401 must reach needsLogin too (D24.1.2)", () => {
  const passwordConnection = {
    authMode: 'password' as const,
    baseUrl: 'http://127.0.0.1:9128',
    id: 'conn-password',
    kind: 'remote' as const,
    label: 'test-password'
  }

  function unauthorizedResponse() {
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'unauthorized' }) } as Response
  }

  beforeEach(() => {
    mmkvBacking.clear()
    setActiveConnection(passwordConnection)
    resetSessionConnectionForTests()
  })

  it('a 401 minting the ws-ticket marks the connection needsLogin, even though no socket ever opened', async () => {
    global.fetch = vi.fn(async () => unauthorizedResponse()) as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow()

    expect(getActiveConnection()?.needsLogin).toBe(true)
  })

  it('a 403 minting the ws-ticket also marks needsLogin (forbidden is still a credentials problem here)', async () => {
    global.fetch = vi.fn(
      async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: 'forbidden' }) }) as Response
    ) as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow()

    expect(getActiveConnection()?.needsLogin).toBe(true)
  })
})

// D27 point 2 (Opus's review): needsLogin must gate the WS dial at this same
// choke point — refuse before even attempting a ws-ticket mint or reading a
// stored token, so a signed-out connection never re-dials on its own.
describe('resolveAuth (via ensureGatewayConnection): refuses upfront when the connection already needsLogin (D27)', () => {
  const passwordConnection = {
    authMode: 'password' as const,
    baseUrl: 'http://127.0.0.1:9128',
    id: 'conn-password-needslogin',
    kind: 'remote' as const,
    label: 'test-password',
    needsLogin: true
  }

  beforeEach(() => {
    mmkvBacking.clear()
    setActiveConnection(passwordConnection)
    resetSessionConnectionForTests()
  })

  it('rejects with the shared needs-login message without ever calling fetch', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }) as Response)

    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow('Authentication failed — check the password.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('a token connection with needsLogin set is refused too, without reading the stored token', async () => {
    mmkvBacking.clear()
    setActiveConnection({ ...passwordConnection, authMode: 'token', id: 'conn-token-needslogin' })
    resetSessionConnectionForTests()

    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }) as Response)

    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(ensureGatewayConnection()).rejects.toThrow('Authentication failed — check the password.')
    expect(fetchSpy).not.toHaveBeenCalled()
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
    // $activeRuntimeSessionId/$runtimeToStored are separate nanostores
    // resetSessionConnectionForTests doesn't touch — reset explicitly so an
    // earlier describe block's seedSession() (which does publish to them)
    // can't leak an active session into these tests.
    $activeRuntimeSessionId.set(null)
    $runtimeToStored.set({})
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

  it('no active session: a successful probe fires no light reconcile at all', async () => {
    fake.request.mockResolvedValue(undefined)

    await reconnectAndProbeGateway()

    expect(fake.request).toHaveBeenCalledTimes(1) // just the ping
    expect(fake.request).not.toHaveBeenCalledWith('session.resume', expect.anything())
  })
})

// D32 (the trigger): the socket-survived path previously reconciled
// nothing at all — a stale approval/sudo/secret card left over from while
// the app was away sat there until something ELSE happened to trigger a
// full resume. Covers that path directly: ping succeeds -> a light
// session.resume (omit_messages: true, no message/info seeding) -> the same
// reconcilePendingRequestsFromResume resumeSession itself uses.
describe('reconnectAndProbeGateway: the light reconcile on a survived socket (D32)', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    setActiveConnection(null)
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
    seedSession('stored-1', 'runtime-1')
  })

  it('a successful probe with an active session resumes with omit_messages: true', async () => {
    fake.request.mockImplementation(async (method: string) => {
      if (method === 'ping') {
        return undefined
      }

      return { message_count: 0, messages: [], resumed: 'stored-1', running: false, session_id: 'runtime-1' }
    })

    await reconnectAndProbeGateway()

    expect(fake.request).toHaveBeenCalledWith('session.resume', { omit_messages: true, session_id: 'stored-1' })
  })

  it('a pending approval already present is cleared through the light reconcile, same as a full resume would', async () => {
    setApprovalRequest('stored-1', {
      allowPermanent: false,
      command: 'rm -rf x',
      description: '',
      requestId: 'req-appr',
      smartDenied: false,
      storedSessionId: 'stored-1'
    })
    fake.request.mockImplementation(async (method: string) => {
      if (method === 'ping') {
        return undefined
      }

      return { message_count: 0, messages: [], resumed: 'stored-1', running: false, session_id: 'runtime-2' }
    })

    await reconnectAndProbeGateway()

    expect($approvalRequests.get()['stored-1']).toBeUndefined()
  })

  it('a ping failure (redial path) fires no light reconcile — that path already reconciles via session.reclaimed', async () => {
    fake.request.mockRejectedValueOnce(new Error('request timed out after 5s: ping'))

    await reconnectAndProbeGateway()

    expect(fake.request).not.toHaveBeenCalledWith('session.resume', expect.anything(), expect.anything())
  })

  it('two reconnectAndProbeGateway calls in quick succession coalesce into one session.resume call', async () => {
    let resumeCalls = 0
    let resolveResume: (value: unknown) => void = () => undefined

    const resumePromise = new Promise(resolve => {
      resolveResume = resolve
    })

    fake.request.mockImplementation(async (method: string) => {
      if (method === 'ping') {
        return undefined
      }

      resumeCalls += 1

      return resumePromise
    })

    const first = reconnectAndProbeGateway()
    const second = reconnectAndProbeGateway()

    // Let both calls run their (already-resolved) ensureGatewayConnection +
    // ping legs through however many microtask hops those take, so both
    // reach the reconcile call and the second one sees the first's in-flight
    // entry before either RPC promise settles.
    for (let i = 0; i < 5; i++) {
      await Promise.resolve()
    }

    resolveResume({ message_count: 0, messages: [], resumed: 'stored-1', running: false, session_id: 'runtime-1' })
    await Promise.all([first, second])

    expect(resumeCalls).toBe(1)
  })

  // Opus's follow-up on the light path: a response session_id that DIFFERS
  // from the runtime id this session was bound to means the server-side
  // session was re-minted underneath us (orphan reap, gateway restart) — the
  // light (omit_messages: true) call correctly clears any now-dead pending
  // request, but the stored transcript has moved on without us and nothing
  // else is scheduled to fetch it. A same-id response is the common case and
  // must stay cheap (no second RPC at all).
  it('same session_id as before: no follow-up message fetch — exactly one session.resume call', async () => {
    fake.request.mockImplementation(async (method: string) => {
      if (method === 'ping') {
        return undefined
      }

      return { message_count: 0, messages: [], resumed: 'stored-1', running: false, session_id: 'runtime-1' }
    })

    await reconnectAndProbeGateway()

    const resumeCalls = fake.request.mock.calls.filter(call => call[0] === 'session.resume')

    expect(resumeCalls).toHaveLength(1)
    expect(resumeCalls[0][1]).toEqual({ omit_messages: true, session_id: 'stored-1' })
  })

  it('a DIFFERENT session_id than before triggers a full resumeSession follow-up to refresh the transcript', async () => {
    fake.request.mockImplementation(async (method: string) => {
      if (method === 'ping') {
        return undefined
      }

      return { message_count: 0, messages: [], resumed: 'stored-1', running: false, session_id: 'runtime-2' }
    })

    await reconnectAndProbeGateway()

    const resumeCalls = fake.request.mock.calls.filter(call => call[0] === 'session.resume')

    expect(resumeCalls).toHaveLength(2)
    expect(resumeCalls[0][1]).toEqual({ omit_messages: true, session_id: 'stored-1' })
    // The follow-up is the ordinary full resumeSession call — no omit_messages.
    expect(resumeCalls[1][1]).toEqual({ session_id: 'stored-1' })
  })
})

// D26: SudoCardActions/SecretCardActions' new Cancel button calls these same
// functions with an empty value — the upstream contract (agent_callbacks.py's
// secret_cb, prompt-overlays.tsx) is that an empty response is a definite
// "no" (a failed sudo / a skipped secret), never a resend. These pin the
// wrapper's own plumbing (RPC shape, request cleared) for that empty-value
// call, since the .tsx components themselves aren't unit-tested in this repo.
describe('respondSudo/respondSecret: an empty value (D26 Cancel) is sent through, not special-cased client-side', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
    seedSession('stored-1', 'runtime-1')
  })

  it('respondSudo("") sends an empty password to sudo.respond', async () => {
    fake.request.mockResolvedValue(undefined)

    await respondSudo('stored-1', 'req-1', '')

    expect(fake.request).toHaveBeenCalledWith('sudo.respond', {
      password: '',
      request_id: 'req-1',
      session_id: 'runtime-1'
    })
  })

  it('respondSudo("") clears the pending sudo request the same as a real password would', async () => {
    fake.request.mockResolvedValue(undefined)
    setSudoRequest('stored-1', { requestId: 'req-1', runtimeSessionId: 'runtime-1', storedSessionId: 'stored-1' })

    await respondSudo('stored-1', 'req-1', '')

    expect($sudoRequests.get()['stored-1']).toBeUndefined()
  })

  it('respondSecret("") sends an empty value to secret.respond', async () => {
    fake.request.mockResolvedValue(undefined)

    await respondSecret('stored-1', 'req-2', '')

    expect(fake.request).toHaveBeenCalledWith('secret.respond', {
      request_id: 'req-2',
      session_id: 'runtime-1',
      value: ''
    })
  })

  it('respondSecret("") clears the pending secret request the same as a real value would', async () => {
    fake.request.mockResolvedValue(undefined)
    setSecretRequest('stored-1', {
      envVar: 'TENOR_API_KEY',
      prompt: '',
      requestId: 'req-2',
      runtimeSessionId: 'runtime-1',
      storedSessionId: 'stored-1'
    })

    await respondSecret('stored-1', 'req-2', '')

    expect($secretRequests.get()['stored-1']).toBeUndefined()
  })
})

// D31: before this fix, the four respond* functions cleared their store
// entry directly and never called dismissNativeNotification at all — only
// dispatchEffects' server-driven clear path did. Answering a request IN this
// app left its OS notification behind (found live: a stale notification sat
// next to a since-answered card). These pin that every respond* function now
// dismisses through the same clearPendingRequest path dispatchEffects uses.
describe('respond*: answering in the app also dismisses the OS notification (D31)', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    fake.request.mockResolvedValue(undefined)
    setGatewayForTests(fake as never)
    seedSession('stored-1', 'runtime-1')
    dismissNativeNotification.mockClear()
  })

  it('respondApproval dismisses the notification for the answered request id', async () => {
    setApprovalRequest('stored-1', {
      allowPermanent: false,
      command: 'rm -rf x',
      description: '',
      requestId: 'req-appr',
      smartDenied: false,
      storedSessionId: 'stored-1'
    })

    await respondApproval('stored-1', 'once', { requestId: 'req-appr' })

    expect($approvalRequests.get()['stored-1']).toBeUndefined()
    expect(dismissNativeNotification).toHaveBeenCalledWith('req-appr')
  })

  it('respondClarify (single-question, no questionId) dismisses the notification', async () => {
    setClarifyRequest('stored-1', {
      choices: null,
      multiSelect: false,
      question: 'which one?',
      questions: [],
      receivedAt: Date.now(),
      requestId: 'req-clar',
      storedSessionId: 'stored-1'
    })

    await respondClarify('stored-1', 'req-clar', 'the first one')

    expect($clarifyRequests.get()['stored-1']).toBeUndefined()
    expect(dismissNativeNotification).toHaveBeenCalledWith('req-clar')
  })

  it('respondClarify mid-batch (more questions remaining) neither clears the card nor dismisses the notification', async () => {
    fake.request.mockResolvedValue({ remaining: ['q2'], status: 'ok' })
    setClarifyRequest('stored-1', {
      choices: null,
      multiSelect: false,
      question: 'q1?',
      questions: [],
      receivedAt: Date.now(),
      requestId: 'req-batch',
      storedSessionId: 'stored-1'
    })

    await respondClarify('stored-1', 'req-batch', 'answer', 'q1')

    expect($clarifyRequests.get()['stored-1']).toBeDefined()
    expect(dismissNativeNotification).not.toHaveBeenCalled()
  })

  it('respondClarify finishing the last question in a batch clears the card and dismisses the notification', async () => {
    fake.request.mockResolvedValue({ remaining: [], status: 'ok' })
    setClarifyRequest('stored-1', {
      choices: null,
      multiSelect: false,
      question: 'last?',
      questions: [],
      receivedAt: Date.now(),
      requestId: 'req-batch-2',
      storedSessionId: 'stored-1'
    })

    await respondClarify('stored-1', 'req-batch-2', 'answer', 'qN')

    expect($clarifyRequests.get()['stored-1']).toBeUndefined()
    expect(dismissNativeNotification).toHaveBeenCalledWith('req-batch-2')
  })

  it('respondSudo dismisses the notification for the answered request id', async () => {
    setSudoRequest('stored-1', { requestId: 'req-sudo', runtimeSessionId: 'runtime-1', storedSessionId: 'stored-1' })

    await respondSudo('stored-1', 'req-sudo', 'hunter2')

    expect($sudoRequests.get()['stored-1']).toBeUndefined()
    expect(dismissNativeNotification).toHaveBeenCalledWith('req-sudo')
  })

  it('respondSecret dismisses the notification for the answered request id', async () => {
    setSecretRequest('stored-1', {
      envVar: 'TENOR_API_KEY',
      prompt: '',
      requestId: 'req-secret',
      runtimeSessionId: 'runtime-1',
      storedSessionId: 'stored-1'
    })

    await respondSecret('stored-1', 'req-secret', 'value')

    expect($secretRequests.get()['stored-1']).toBeUndefined()
    expect(dismissNativeNotification).toHaveBeenCalledWith('req-secret')
  })
})

// D31 point 7: approval.respond/clarify.respond/sudo.respond/secret.respond
// are success-shaped even when the request already died server-side before
// the answer arrived — dead-request.ts's isXRespondDead functions detect the
// two upstream shapes for that (resolved: 0 / status: "expired"). These pin
// that a dead result surfaces a "Request expired" notice AND still clears
// the card+notification the same as a genuine success would (the user's
// answer was real, it just arrived too late — the card must not linger).
describe('respond*: a dead-request result notifies "expired" and still clears (D31 point 7)', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
    seedSession('stored-1', 'runtime-1')
    $notifications.set([])
  })

  it('respondApproval: resolved: 0 notifies expired and still clears', async () => {
    fake.request.mockResolvedValue({ resolved: 0 })
    setApprovalRequest('stored-1', {
      allowPermanent: false,
      command: 'rm -rf x',
      description: '',
      requestId: 'req-appr',
      smartDenied: false,
      storedSessionId: 'stored-1'
    })

    await respondApproval('stored-1', 'once', { requestId: 'req-appr' })

    expect($approvalRequests.get()['stored-1']).toBeUndefined()
    expect($notifications.get()).toContainEqual(
      expect.objectContaining({ id: 'request-expired-stored-1', kind: 'info' })
    )
  })

  it('respondApproval: resolved: 1 does not notify expired', async () => {
    fake.request.mockResolvedValue({ resolved: 1 })

    await respondApproval('stored-1', 'once', { requestId: 'req-appr' })

    expect($notifications.get()).toEqual([])
  })

  it('respondClarify: status "expired" notifies and clears even mid-batch (no `remaining` in a dead response)', async () => {
    fake.request.mockResolvedValue({ status: 'expired' })
    setClarifyRequest('stored-1', {
      choices: null,
      multiSelect: false,
      question: 'q1?',
      questions: [],
      receivedAt: Date.now(),
      requestId: 'req-clar',
      storedSessionId: 'stored-1'
    })

    await respondClarify('stored-1', 'req-clar', 'answer', 'q1')

    expect($clarifyRequests.get()['stored-1']).toBeUndefined()
    expect($notifications.get()).toContainEqual(expect.objectContaining({ id: 'request-expired-stored-1' }))
  })

  it('respondClarify: status "ok" does not notify expired', async () => {
    fake.request.mockResolvedValue({ status: 'ok' })

    await respondClarify('stored-1', 'req-clar', 'answer')

    expect($notifications.get()).toEqual([])
  })

  it('respondSudo: status "expired" notifies and still clears', async () => {
    fake.request.mockResolvedValue({ status: 'expired' })
    setSudoRequest('stored-1', { requestId: 'req-sudo', runtimeSessionId: 'runtime-1', storedSessionId: 'stored-1' })

    await respondSudo('stored-1', 'req-sudo', 'hunter2')

    expect($sudoRequests.get()['stored-1']).toBeUndefined()
    expect($notifications.get()).toContainEqual(expect.objectContaining({ id: 'request-expired-stored-1' }))
  })

  it('respondSecret: status "expired" notifies and still clears', async () => {
    fake.request.mockResolvedValue({ status: 'expired' })
    setSecretRequest('stored-1', {
      envVar: 'TENOR_API_KEY',
      prompt: '',
      requestId: 'req-secret',
      runtimeSessionId: 'runtime-1',
      storedSessionId: 'stored-1'
    })

    await respondSecret('stored-1', 'req-secret', 'value')

    expect($secretRequests.get()['stored-1']).toBeUndefined()
    expect($notifications.get()).toContainEqual(expect.objectContaining({ id: 'request-expired-stored-1' }))
  })
})
