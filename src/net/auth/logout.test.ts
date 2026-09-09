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

const { getConnectionOAuth, getConnectionToken, setConnectionHeader, setConnectionOAuth, setConnectionToken } =
  await import('../../connections/secure')

const { logoutConnection } = await import('./logout')

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
