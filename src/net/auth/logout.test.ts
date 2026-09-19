import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const secureStore = new Map<string, string>()

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStore.delete(key)
  }),
  getItemAsync: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value)
  })
}))

// signOutConnection (M08 Defect 2) also touches the MMKV-backed connection
// registry — mocked the same Map-backed way session-connection.test.ts does,
// so upsertConnection's needsLogin flip is actually observable here instead
// of silently no-op-ing through storage.ts's try/catch fail-safe.
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

// D27: signOutConnection now clears the native cookie jar (cookie-clear.ts)
// as part of sign-out — see that module's own test file for its
// best-effort/never-throws/timeout behaviour in isolation; this just needs
// it resolvable and quiet here.
vi.mock('react-native', () => ({
  NativeModules: { Networking: { clearCookies: vi.fn((callback: (result: boolean) => void) => callback(true)) } },
  Platform: { OS: 'android', select: () => undefined }
}))

const { getConnection, listConnections, setActiveConnection, upsertConnection } =
  await import('../../connections/registry')

const { getConnectionOAuth, getConnectionToken, setConnectionHeader, setConnectionOAuth, setConnectionToken } =
  await import('../../connections/secure')

const { getConnectionAttention, resetSessionConnectionForTests, setGatewayForTests } =
  await import('../../gateway/session-connection')

const { $approvalRequests, $sudoRequests, setApprovalRequest } = await import('../../store/prompts')
const { $sessions, setSessions } = await import('../../store/sessions')

const { logoutConnection, signOutConnection } = await import('./logout')

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('logoutConnection', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    secureStore.clear()
    mmkvBacking.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('clears every SecureStore entry for the connection: token, oauth session, and extra headers', async () => {
    await setConnectionToken('conn-1', 'session-token')
    await setConnectionOAuth('conn-1', { accessToken: 'at', refreshToken: 'rt' })
    await setConnectionHeader('conn-1', 'CF-Access-Client-Id', 'abc')

    global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

    await logoutConnection({
      authMode: 'oauth',
      baseUrl: 'http://host',
      headerNames: ['CF-Access-Client-Id'],
      id: 'conn-1',
      kind: 'remote',
      label: 'test'
    })

    expect(await getConnectionToken('conn-1')).toBeNull()
    expect(await getConnectionOAuth('conn-1')).toBeNull()
    expect(secureStore.has('conn.conn-1.header.CF-Access-Client-Id')).toBe(false)
  })

  it('still clears SecureStore even when the /auth/logout request fails outright', async () => {
    await setConnectionToken('conn-1', 'session-token')

    global.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    await logoutConnection({ authMode: 'token', baseUrl: 'http://host', id: 'conn-1', kind: 'remote', label: 'test' })

    expect(await getConnectionToken('conn-1')).toBeNull()
  })

  it('sends the oauth bearer token on the logout request for an oauth connection', async () => {
    await setConnectionOAuth('conn-1', { accessToken: 'at-123' })

    const fetchMock = vi.fn(async () => jsonResponse(302, {}))

    global.fetch = fetchMock as unknown as typeof fetch

    await logoutConnection({ authMode: 'oauth', baseUrl: 'http://host', id: 'conn-1', kind: 'remote', label: 'test' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer at-123')
  })

  it('sends cookies (credentials: include) for a password connection', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(302, {}))

    global.fetch = fetchMock as unknown as typeof fetch

    await logoutConnection({
      authMode: 'password',
      baseUrl: 'http://host',
      id: 'conn-1',
      kind: 'remote',
      label: 'test'
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(init.credentials).toBe('include')
  })
})

// M08 Defect 2: logoutConnection had no caller anywhere in the app. This is
// the connections screen's actual "Sign out" button.
describe('signOutConnection', () => {
  const originalFetch = global.fetch

  const connection = {
    authMode: 'oauth' as const,
    baseUrl: 'http://host',
    id: 'conn-1',
    kind: 'remote' as const,
    label: 'test'
  }

  beforeEach(() => {
    secureStore.clear()
    mmkvBacking.clear()
    resetSessionConnectionForTests()
    $approvalRequests.set({})
    $sudoRequests.set({})
    $sessions.set([])
    setActiveConnection(connection)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('runs the full logout (SecureStore cleared, best-effort POST sent) AND marks the registry entry needsLogin', async () => {
    await setConnectionOAuth('conn-1', { accessToken: 'at', refreshToken: 'rt' })

    const fetchMock = vi.fn(async () => jsonResponse(302, {}))

    global.fetch = fetchMock as unknown as typeof fetch

    await signOutConnection(connection)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await getConnectionOAuth('conn-1')).toBeNull()
    expect(getConnection('conn-1')?.needsLogin).toBe(true)
  })

  it('still marks needsLogin even when the best-effort /auth/logout request fails outright', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    await signOutConnection(connection)

    expect(getConnection('conn-1')?.needsLogin).toBe(true)
  })

  // D27 point 1 (Opus's review, Fable's ruling): sign-out on the active
  // connection invalidates the live socket and clears every piece of
  // runtime state this app holds for it.
  describe("D27: clears the active connection's runtime state", () => {
    it('invalidates the live gateway client', async () => {
      const fakeGateway = { invalidate: vi.fn(), close: vi.fn(), request: vi.fn() }

      setGatewayForTests(fakeGateway as never)
      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect(fakeGateway.invalidate).toHaveBeenCalledTimes(1)
    })

    // Opus's round-2 review: the old order awaited the best-effort POST
    // /auth/logout FIRST — up to 15s offline. During that whole window the
    // socket stayed live and needsLogin was unset, so an app kill mid-window
    // left neither gate up. A fetch that never resolves (simulating
    // genuinely offline, no timeout reached yet) must still leave both
    // gates up immediately — proving they don't wait on the network at all.
    it('marks needsLogin and invalidates the socket before the logout request resolves — offline must not leave the gates down', async () => {
      const fakeGateway = { invalidate: vi.fn(), close: vi.fn(), request: vi.fn() }

      setGatewayForTests(fakeGateway as never)

      let releaseFetch: (() => void) | null = null

      global.fetch = vi.fn(
        () =>
          new Promise<Response>(resolve => {
            releaseFetch = () => resolve(jsonResponse(200, {}))
          })
      ) as unknown as typeof fetch

      const signOutPromise = signOutConnection(connection)

      // These run truly synchronously — before even the FIRST microtask
      // (including resolveLogoutAuth's own SecureStore lookup) has had a
      // chance to run, let alone the fetch call itself — proving the gates
      // don't wait on anything async, not just "not the network specifically".
      expect(getConnection('conn-1')?.needsLogin).toBe(true)
      expect(fakeGateway.invalidate).toHaveBeenCalledTimes(1)

      // The rest of the flow DOES need microtasks to reach the actual fetch
      // call (resolveLogoutAuth awaits the mocked SecureStore) — drain them
      // until it does, then release it so the test itself doesn't hang.
      while (!releaseFetch) {
        await Promise.resolve()
      }

      ;(releaseFetch as () => void)()
      await signOutPromise
    })

    it('clears connection attention (needs-login banner state)', async () => {
      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect(getConnectionAttention()).toBeNull()
    })

    it('clears every pending approval/sudo card, across every session, not just the active one', async () => {
      setApprovalRequest('sess-a', {
        allowPermanent: true,
        choices: undefined,
        command: 'rm -rf',
        description: 'dangerous',
        requestId: 'req-1',
        smartDenied: false,
        storedSessionId: 'sess-a'
      })
      $sudoRequests.set({ 'sess-b': { requestId: 'req-2', storedSessionId: 'sess-b' } })

      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect($approvalRequests.get()).toEqual({})
      expect($sudoRequests.get()).toEqual({})
    })

    it('clears the cached session list', async () => {
      setSessions([{ storedSessionId: 'sess-a', title: 'Old session', updatedAt: 0 }])

      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect($sessions.get()).toEqual([])
    })

    it('does nothing to the socket when signing out a connection that is NOT active', async () => {
      const fakeGateway = { invalidate: vi.fn(), close: vi.fn(), request: vi.fn() }

      setGatewayForTests(fakeGateway as never)
      setActiveConnection({ ...connection, id: 'conn-other-active' })
      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect(fakeGateway.invalidate).not.toHaveBeenCalled()
    })
  })

  // D27 point 3 (Fable's ruling via Opus): the cookie clear is global, not
  // per-host, so every OTHER password-mode connection is marked needsLogin
  // in the same action — otherwise the registry would claim a connection is
  // still signed in when its cookie no longer works.
  describe('D27: marks every other password-mode connection needsLogin', () => {
    it('marks a different password-mode connection needsLogin', async () => {
      const other = {
        authMode: 'password' as const,
        baseUrl: 'http://host-2',
        id: 'conn-2',
        kind: 'remote' as const,
        label: 'other'
      }

      setActiveConnection(connection)
      // Registers `other` into the list without making it active.
      upsertConnection(other)
      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect(getConnection('conn-2')?.needsLogin).toBe(true)
    })

    it('does not touch a non-password connection (token/oauth have no shared cookie jar to invalidate)', async () => {
      const other = {
        authMode: 'token' as const,
        baseUrl: 'http://host-2',
        id: 'conn-token',
        kind: 'remote' as const,
        label: 'other'
      }

      setActiveConnection(connection)
      upsertConnection(other)
      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      expect(getConnection('conn-token')?.needsLogin).toBeUndefined()
    })

    it('every OTHER password connection ends up in the registry list marked needsLogin', async () => {
      const other = {
        authMode: 'password' as const,
        baseUrl: 'http://host-3',
        id: 'conn-3',
        kind: 'remote' as const,
        label: 'third'
      }

      setActiveConnection(connection)
      upsertConnection(other)
      global.fetch = vi.fn(async () => jsonResponse(302, {})) as unknown as typeof fetch

      await signOutConnection(connection)

      const stillFalse = listConnections().find(c => c.id === 'conn-3')

      expect(stillFalse?.needsLogin).toBe(true)
    })
  })
})
