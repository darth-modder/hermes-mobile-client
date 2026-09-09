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

const { getConnectionOAuth, setConnectionOAuth } = await import('../../connections/secure')

const { ensureFreshOAuthAccessToken, oauthAccessTokenNeedsRefresh, refreshConnectionOAuth, resetTokenRefreshForTests } =
  await import('./token-refresh')

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('oauthAccessTokenNeedsRefresh', () => {
  it('needs refresh when within the 60s skew of expiry', () => {
    expect(oauthAccessTokenNeedsRefresh(1_000, 941)).toBe(true) // 59s left
    expect(oauthAccessTokenNeedsRefresh(1_000, 940)).toBe(true) // exactly 60s left
  })

  it('does not need refresh with more than 60s left', () => {
    expect(oauthAccessTokenNeedsRefresh(1_000, 939)).toBe(false) // 61s left
  })

  it('treats a missing/non-finite expiry as needing refresh', () => {
    expect(oauthAccessTokenNeedsRefresh(undefined, 0)).toBe(true)
    expect(oauthAccessTokenNeedsRefresh(Number.NaN, 0)).toBe(true)
  })
})

describe('refreshConnectionOAuth', () => {
  const originalFetch = global.fetch

  beforeEach(async () => {
    secureStore.clear()
    resetTokenRefreshForTests()
    await setConnectionOAuth('conn-1', { accessToken: 'old-access', expiresAt: 100, refreshToken: 'old-refresh' })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('persists the rotated access AND refresh token before resolving true (AGENTS.md: rotated RT persisted before the promise resolves)', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, {
        access_token: 'new-access',
        expires_at: 9_999,
        provider: 'nous',
        refresh_token: 'new-refresh',
        user_id: 'u1'
      })
    ) as unknown as typeof fetch

    const result = await refreshConnectionOAuth('conn-1', 'http://host')

    expect(result).toBe(true)

    const stored = await getConnectionOAuth('conn-1')

    expect(stored).toEqual({
      accessToken: 'new-access',
      expiresAt: 9_999,
      provider: 'nous',
      refreshToken: 'new-refresh',
      userId: 'u1'
    })
  })

  it('keeps the existing refresh token when the server does not rotate it', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, { access_token: 'new-access', expires_at: 9_999 })
    ) as unknown as typeof fetch

    await refreshConnectionOAuth('conn-1', 'http://host')

    const stored = await getConnectionOAuth('conn-1')

    expect(stored?.refreshToken).toBe('old-refresh')
  })

  it('a confirmed session_expired (401) clears the stored session and resolves false', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(401, { detail: 'Refresh token expired or invalid; start a new sign-in.', error: 'session_expired' })
    ) as unknown as typeof fetch

    const result = await refreshConnectionOAuth('conn-1', 'http://host')

    expect(result).toBe(false)
    expect(await getConnectionOAuth('conn-1')).toBeNull()
  })

  it('a 503 (provider unreachable) resolves false but leaves the stored session untouched — never a login prompt for a 5xx (AGENTS.md)', async () => {
    global.fetch = vi.fn(async () => jsonResponse(503, { detail: 'unreachable' })) as unknown as typeof fetch

    const result = await refreshConnectionOAuth('conn-1', 'http://host')

    expect(result).toBe(false)
    expect(await getConnectionOAuth('conn-1')).toMatchObject({ accessToken: 'old-access' })
  })

  it('resolves false with no stored refresh token, without calling the network', async () => {
    secureStore.clear()

    const fetchMock = vi.fn(async () => jsonResponse(200, {}))

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await refreshConnectionOAuth('conn-missing', 'http://host')

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('concurrent callers for the same connection share one in-flight attempt', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { access_token: 'new-access', expires_at: 9_999 }))

    global.fetch = fetchMock as unknown as typeof fetch

    const [a, b] = await Promise.all([
      refreshConnectionOAuth('conn-1', 'http://host'),
      refreshConnectionOAuth('conn-1', 'http://host')
    ])

    expect(a).toBe(true)
    expect(b).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ensureFreshOAuthAccessToken', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    secureStore.clear()
    resetTokenRefreshForTests()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns null when there is no stored session', async () => {
    expect(await ensureFreshOAuthAccessToken('conn-none', 'http://host')).toBeNull()
  })

  it('returns the stored access token unchanged when it is not near expiry — no network call', async () => {
    await setConnectionOAuth('conn-1', {
      accessToken: 'still-good',
      expiresAt: Math.floor(Date.now() / 1000) + 3_600,
      refreshToken: 'rt'
    })

    const fetchMock = vi.fn()

    global.fetch = fetchMock as unknown as typeof fetch

    expect(await ensureFreshOAuthAccessToken('conn-1', 'http://host')).toBe('still-good')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes proactively and returns the rotated token when within the skew window', async () => {
    await setConnectionOAuth('conn-1', {
      accessToken: 'about-to-expire',
      expiresAt: Math.floor(Date.now() / 1000) + 10,
      refreshToken: 'rt'
    })

    global.fetch = vi.fn(async () =>
      jsonResponse(200, { access_token: 'rotated', expires_at: 9_999_999_999 })
    ) as unknown as typeof fetch

    expect(await ensureFreshOAuthAccessToken('conn-1', 'http://host')).toBe('rotated')
  })

  it('returns null when a needed refresh fails', async () => {
    await setConnectionOAuth('conn-1', {
      accessToken: 'about-to-expire',
      expiresAt: Math.floor(Date.now() / 1000) + 10,
      refreshToken: 'rt'
    })

    global.fetch = vi.fn(async () => jsonResponse(401, { error: 'session_expired' })) as unknown as typeof fetch

    expect(await ensureFreshOAuthAccessToken('conn-1', 'http://host')).toBeNull()
  })
})
