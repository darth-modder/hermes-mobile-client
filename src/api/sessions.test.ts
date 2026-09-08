import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backing = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => backing.get(key),
    remove: (key: string) => backing.delete(key),
    set: (key: string, value: string) => {
      backing.set(key, value)
    }
  })
}))

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

const { setActiveConnection } = await import('../connections/registry')
const { setConnectionOAuth, setConnectionToken } = await import('../connections/secure')
const { deleteSession, listSessions, updateSessionFlags } = await import('./sessions')

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('src/api/sessions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    backing.clear()
    secureStore.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('throws without an active connection', async () => {
    setActiveConnection(null)

    await expect(listSessions()).rejects.toThrow('No active connection')
  })

  it('token mode: sends Authorization: Bearer and the query params', async () => {
    setActiveConnection({
      authMode: 'token',
      baseUrl: 'http://host',
      id: 'conn-1',
      kind: 'remote',
      label: 'test'
    })
    await setConnectionToken('conn-1', 'tok-abc')

    const fetchMock = vi.fn(async () => jsonResponse(200, { limit: 20, offset: 0, sessions: [], total: 0 }))

    global.fetch = fetchMock as unknown as typeof fetch

    await listSessions({ archived: 'exclude', limit: 20, order: 'recent' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toContain('/api/sessions?')
    expect(url).toContain('limit=20')
    expect(url).toContain('order=recent')
    expect(url).toContain('archived=exclude')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc')
    expect(init.credentials).toBeUndefined()
  })

  it('password mode: sends credentials include, no Authorization header', async () => {
    setActiveConnection({
      authMode: 'password',
      baseUrl: 'http://host',
      id: 'conn-2',
      kind: 'remote',
      label: 'test'
    })

    const fetchMock = vi.fn(async () => jsonResponse(200, { limit: 20, offset: 0, sessions: [], total: 0 }))

    global.fetch = fetchMock as unknown as typeof fetch

    await listSessions()

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('oauth mode: sends the stored access token as Bearer', async () => {
    setActiveConnection({
      authMode: 'oauth',
      baseUrl: 'http://host',
      id: 'conn-3',
      kind: 'remote',
      label: 'test'
    })
    await setConnectionOAuth('conn-3', { accessToken: 'access-xyz' })

    const fetchMock = vi.fn(async () => jsonResponse(200, { limit: 20, offset: 0, sessions: [], total: 0 }))

    global.fetch = fetchMock as unknown as typeof fetch

    await listSessions()

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-xyz')
  })

  it('updateSessionFlags PATCHes the session with the body as-is', async () => {
    setActiveConnection({
      authMode: 'token',
      baseUrl: 'http://host',
      id: 'conn-1',
      kind: 'remote',
      label: 'test'
    })
    await setConnectionToken('conn-1', 'tok-abc')

    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true, pinned: true, title: 'Hi' }))

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await updateSessionFlags('sess-1', { pinned: true })

    expect(result).toEqual({ ok: true, pinned: true, title: 'Hi' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toContain('/api/sessions/sess-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ pinned: true })
  })

  it('deleteSession DELETEs the session', async () => {
    setActiveConnection({
      authMode: 'token',
      baseUrl: 'http://host',
      id: 'conn-1',
      kind: 'remote',
      label: 'test'
    })
    await setConnectionToken('conn-1', 'tok-abc')

    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }))

    global.fetch = fetchMock as unknown as typeof fetch

    await deleteSession('sess-1')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toContain('/api/sessions/sess-1')
    expect(init.method).toBe('DELETE')
  })
})
