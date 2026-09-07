import { afterEach, describe, expect, it, vi } from 'vitest'

import { probeAuthProviders, probeHealth, probeMe, probeStatus } from './probe'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('probe', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('probeHealth reads auth_required off /api/health', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, { ok: true, version: '0.21.0', auth_required: true })
    ) as unknown as typeof fetch

    const result = await probeHealth('http://host')

    expect(result).toEqual({ ok: true, version: '0.21.0', auth_required: true })
  })

  it('probeAuthProviders unwraps the providers array', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, {
        providers: [{ name: 'basic', display_name: 'Username & Password', supports_password: true }]
      })
    ) as unknown as typeof fetch

    const providers = await probeAuthProviders('http://host')

    expect(providers).toEqual([{ name: 'basic', display_name: 'Username & Password', supports_password: true }])
  })

  it('probeAuthProviders defaults to an empty array when providers is missing', async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof fetch

    expect(await probeAuthProviders('http://host')).toEqual([])
  })

  it('probeStatus sends the Bearer token and credentials: include', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { install_id: 'abc' }))

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await probeStatus('http://host', { token: 'tok' })

    expect(result).toEqual({ install_id: 'abc' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }]

    expect(init.credentials).toBe('include')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('probeMe returns the session identity', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, { user_id: 'u1', provider: 'basic', email: '', display_name: 'u1', org_id: '' })
    ) as unknown as typeof fetch

    const result = await probeMe('http://host')

    expect(result.user_id).toBe('u1')
    expect(result.provider).toBe('basic')
  })
})
