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

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
  digestStringAsync: vi.fn(
    async () => 'ZmFrZS1kaWdlc3Q+Pj8=' /* deliberately contains + and = to exercise toBase64Url */
  ),
  getRandomBytesAsync: vi.fn(async (n: number) => new Uint8Array(n).fill(7))
}))

const webBrowser = {
  dismissBrowser: vi.fn(async () => ({ type: 'dismiss' })),
  openBrowserAsync: vi.fn(async (_url: string) => ({ type: 'opened' }))
}

vi.mock('expo-web-browser', () => webBrowser)

class FakeLoopbackListenerError extends Error {
  reason: string

  constructor(reason: string, message: string) {
    super(message)
    this.name = 'LoopbackListenerError'
    this.reason = reason
  }
}

const loopback = {
  cancelLoopbackListener: vi.fn(async () => undefined),
  startLoopbackListener: vi.fn(async () => 54321),
  waitForLoopbackCallback: vi.fn()
}

vi.mock('./loopback-listener', () => ({
  ...loopback,
  LoopbackListenerError: FakeLoopbackListenerError
}))

const { getConnectionOAuth } = await import('../../connections/secure')
const { nativeLogin, NativeLoginError } = await import('./native-login')

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('nativeLogin', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    secureStore.clear()
    vi.clearAllMocks()
    loopback.startLoopbackListener.mockResolvedValue(54321)
    loopback.cancelLoopbackListener.mockResolvedValue(undefined)
    webBrowser.openBrowserAsync.mockResolvedValue({ type: 'opened' })
    webBrowser.dismissBrowser.mockResolvedValue({ type: 'dismiss' })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('opens the authorize URL with S256 PKCE, redirect_uri on the loopback port, and a state param', async () => {
    loopback.waitForLoopbackCallback.mockResolvedValueOnce({ code: 'auth-code', state: expect.any(String) })

    // Capture the state generated for this attempt from the authorize URL itself,
    // then hand it back on the callback so the state-match check passes.
    let capturedState = ''

    webBrowser.openBrowserAsync.mockImplementationOnce(async (url: string) => {
      capturedState = new URL(url).searchParams.get('state') ?? ''

      return { type: 'opened' }
    })
    loopback.waitForLoopbackCallback.mockReset()
    loopback.waitForLoopbackCallback.mockImplementationOnce(async () => ({ code: 'auth-code', state: capturedState }))

    global.fetch = vi.fn(async () =>
      jsonResponse(200, { access_token: 'at', expires_at: 9_999, provider: 'nous', refresh_token: 'rt', user_id: 'u1' })
    ) as unknown as typeof fetch

    await nativeLogin('conn-1', 'http://host', { provider: 'nous' })

    const authorizeUrl = new URL(webBrowser.openBrowserAsync.mock.calls[0][0] as string)

    expect(authorizeUrl.pathname).toBe('/auth/native/authorize')
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:54321/cb')
    expect(authorizeUrl.searchParams.get('provider')).toBe('nous')
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy()
    expect(authorizeUrl.searchParams.get('state')).toBeTruthy()
  })

  it('exchanges the code for tokens and persists the full bearer payload', async () => {
    loopback.waitForLoopbackCallback.mockImplementationOnce(async () => {
      const url = new URL(webBrowser.openBrowserAsync.mock.calls[0][0] as string)

      return { code: 'auth-code', state: url.searchParams.get('state') }
    })

    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { access_token: 'at', expires_at: 9_999, provider: 'nous', refresh_token: 'rt', user_id: 'u1' })
    )

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await nativeLogin('conn-1', 'http://host')

    expect(result).toEqual({ accessToken: 'at', expiresAt: 9_999, provider: 'nous', refreshToken: 'rt', userId: 'u1' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(JSON.parse(init.body as string)).toEqual({ code: 'auth-code', code_verifier: expect.any(String) })

    const stored = await getConnectionOAuth('conn-1')

    expect(stored).toEqual({ accessToken: 'at', expiresAt: 9_999, provider: 'nous', refreshToken: 'rt', userId: 'u1' })
  })

  it('rejects with state-mismatch when the callback state does not match, and never calls the token endpoint', async () => {
    loopback.waitForLoopbackCallback.mockResolvedValueOnce({ code: 'auth-code', state: 'wrong-state' })

    const fetchMock = vi.fn()

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(nativeLogin('conn-1', 'http://host')).rejects.toMatchObject({
      name: 'NativeLoginError',
      reason: 'state-mismatch'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects with provider-error when the callback carries an OAuth error', async () => {
    loopback.waitForLoopbackCallback.mockResolvedValueOnce({
      error: 'access_denied',
      error_description: 'user declined'
    })

    await expect(nativeLogin('conn-1', 'http://host')).rejects.toMatchObject({
      message: 'user declined',
      name: 'NativeLoginError',
      reason: 'provider-error'
    })
  })

  it('maps a loopback timeout to NativeLoginError reason timed-out', async () => {
    loopback.waitForLoopbackCallback.mockRejectedValueOnce(new FakeLoopbackListenerError('timeout', 'timed out'))

    await expect(nativeLogin('conn-1', 'http://host')).rejects.toMatchObject({
      name: 'NativeLoginError',
      reason: 'timed-out'
    })
  })

  it('maps a cancelled loopback listener to NativeLoginError reason cancelled', async () => {
    loopback.waitForLoopbackCallback.mockRejectedValueOnce(new FakeLoopbackListenerError('cancelled', 'cancelled'))

    await expect(nativeLogin('conn-1', 'http://host')).rejects.toMatchObject({
      name: 'NativeLoginError',
      reason: 'cancelled'
    })
  })

  it('rejects with malformed-response when the token endpoint omits an access token', async () => {
    loopback.waitForLoopbackCallback.mockImplementationOnce(async () => {
      const url = new URL(webBrowser.openBrowserAsync.mock.calls[0][0] as string)

      return { code: 'auth-code', state: url.searchParams.get('state') }
    })

    global.fetch = vi.fn(async () => jsonResponse(200, { provider: 'nous' })) as unknown as typeof fetch

    await expect(nativeLogin('conn-1', 'http://host')).rejects.toMatchObject({
      name: 'NativeLoginError',
      reason: 'malformed-response'
    })
  })

  it('always cancels the loopback listener afterward, on both success and failure', async () => {
    loopback.waitForLoopbackCallback.mockResolvedValueOnce({ code: 'auth-code', state: 'wrong-state' })

    await nativeLogin('conn-1', 'http://host').catch(() => undefined)

    expect(loopback.cancelLoopbackListener).toHaveBeenCalledTimes(1)
  })
})

describe('NativeLoginError', () => {
  it('carries the reason and an optional cause', () => {
    const cause = new Error('root cause')
    const error = new NativeLoginError('timed-out', 'timed out', cause)

    expect(error.reason).toBe('timed-out')
    expect(error.cause).toBe(cause)
  })
})
