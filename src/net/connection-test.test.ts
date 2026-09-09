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

const { setConnectionOAuth, setConnectionToken } = await import('../connections/secure')
const { testConnection } = await import('./connection-test')

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

const TOKEN_CONNECTION = {
  authMode: 'token' as const,
  baseUrl: 'http://host',
  id: 'conn-token',
  kind: 'remote' as const,
  label: 'Token'
}

const PASSWORD_CONNECTION = {
  authMode: 'password' as const,
  baseUrl: 'http://host',
  id: 'conn-password',
  kind: 'remote' as const,
  label: 'Password'
}

const OAUTH_CONNECTION = {
  authMode: 'oauth' as const,
  baseUrl: 'http://host',
  id: 'conn-oauth',
  kind: 'remote' as const,
  label: 'OAuth'
}

describe('src/net/connection-test', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    secureStore.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('token mode: no stored token is unauthorized without a network call', async () => {
    const fetchMock = vi.fn()

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await testConnection(TOKEN_CONNECTION)

    expect(result).toEqual({
      message: 'No stored session token for this connection.',
      ok: false,
      reason: 'unauthorized'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('token mode: GET /api/sessions with Bearer succeeds (never /api/status — it is on the public allowlist)', async () => {
    await setConnectionToken('conn-token', 'tok-abc')

    const fetchMock = vi.fn(async () => jsonResponse(200, { total: 3 }))

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await testConnection(TOKEN_CONNECTION)

    expect(result.ok).toBe(true)
    expect(result.reason).toBe('ok')
    expect(result.message).toContain('3 session(s)')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toContain('/api/sessions')
    expect(url).not.toContain('/api/status')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc')
  })

  it('token mode: a 401 classifies as unauthorized', async () => {
    await setConnectionToken('conn-token', 'bad-token')

    global.fetch = vi.fn(async () => jsonResponse(401, { detail: 'nope' })) as unknown as typeof fetch

    const result = await testConnection(TOKEN_CONNECTION)

    expect(result).toEqual({
      message: 'Unauthorized — the stored credentials were rejected.',
      ok: false,
      reason: 'unauthorized'
    })
  })

  it('password mode: mints a WS ticket via POST /api/auth/ws-ticket, not just /api/status', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { ticket: 'tik-1', ttl_seconds: 30 }))

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await testConnection(PASSWORD_CONNECTION)

    expect(result.ok).toBe(true)
    expect(result.message).toContain('WS ticket minted')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toContain('/api/auth/ws-ticket')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
  })

  it('password mode: a 403 classifies as forbidden', async () => {
    global.fetch = vi.fn(async () => jsonResponse(403, { detail: 'nope' })) as unknown as typeof fetch

    const result = await testConnection(PASSWORD_CONNECTION)

    expect(result).toEqual({ message: 'Forbidden — signed in, but not permitted.', ok: false, reason: 'forbidden' })
  })

  it('a network failure (no HTTP status) classifies as unreachable, not unauthorized', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch

    const result = await testConnection(PASSWORD_CONNECTION)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unreachable')
    expect(result.message).toContain('Unreachable')
  })

  it('a 500 also classifies as unreachable (never a login prompt, per the ladder)', async () => {
    global.fetch = vi.fn(async () => jsonResponse(500, { detail: 'boom' })) as unknown as typeof fetch

    const result = await testConnection(PASSWORD_CONNECTION)

    expect(result.reason).toBe('unreachable')
  })

  it('oauth mode: sends the stored access token as Bearer when minting the ticket', async () => {
    await setConnectionOAuth('conn-oauth', { accessToken: 'access-xyz' })

    const fetchMock = vi.fn(async () => jsonResponse(200, { ticket: 'tik-2', ttl_seconds: 30 }))

    global.fetch = fetchMock as unknown as typeof fetch

    await testConnection(OAUTH_CONNECTION)

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-xyz')
  })
})
