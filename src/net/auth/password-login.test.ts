import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mintWsTicket, passwordLogin, PasswordLoginError } from './password-login'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('passwordLogin', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('succeeds and returns { ok, next }', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true, next: '/' }))

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await passwordLogin('http://host', { provider: 'basic', username: 'u', password: 'p' })

    expect(result).toEqual({ ok: true, next: '/' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(init.credentials).toBe('include')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ provider: 'basic', username: 'u', password: 'p' })
  })

  it('401 throws PasswordLoginError with reason invalid-credentials', async () => {
    global.fetch = vi.fn(async () => jsonResponse(401, { detail: 'Invalid credentials' })) as unknown as typeof fetch

    await expect(
      passwordLogin('http://host', { provider: 'basic', username: 'u', password: 'wrong' })
    ).rejects.toMatchObject({
      reason: 'invalid-credentials'
    })
  })

  it('401 rejects with exactly one PasswordLoginError, no retry storm', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { detail: 'Invalid credentials' }))

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(
      passwordLogin('http://host', { provider: 'basic', username: 'u', password: 'wrong' })
    ).rejects.toBeInstanceOf(PasswordLoginError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('429 throws PasswordLoginError with reason rate-limited', async () => {
    global.fetch = vi.fn(async () => jsonResponse(429, { detail: 'Too many attempts' })) as unknown as typeof fetch

    await expect(
      passwordLogin('http://host', { provider: 'basic', username: 'u', password: 'p' })
    ).rejects.toMatchObject({
      reason: 'rate-limited'
    })
  })

  it('404 throws PasswordLoginError with reason unknown-provider', async () => {
    global.fetch = vi.fn(async () => jsonResponse(404, { detail: 'Unknown provider' })) as unknown as typeof fetch

    await expect(
      passwordLogin('http://host', { provider: 'nope', username: 'u', password: 'p' })
    ).rejects.toMatchObject({
      reason: 'unknown-provider'
    })
  })

  it('a 500 rethrows the raw HttpError, not a PasswordLoginError', async () => {
    global.fetch = vi.fn(async () => jsonResponse(500, { detail: 'boom' })) as unknown as typeof fetch

    await expect(
      passwordLogin('http://host', { provider: 'basic', username: 'u', password: 'p' })
    ).rejects.not.toBeInstanceOf(PasswordLoginError)
  })
})

describe('mintWsTicket', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, { ticket: 'abc123', ttl_seconds: 30 })
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('mints a ticket with credentials included', async () => {
    const result = await mintWsTicket('http://host')

    expect(result).toEqual({ ticket: 'abc123', ttl_seconds: 30 })

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]

    expect(init.credentials).toBe('include')
    expect(init.method).toBe('POST')
  })
})
