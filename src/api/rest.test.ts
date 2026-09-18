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

const { getActiveConnection, setActiveConnection } = await import('../connections/registry')
const { restRequest } = await import('./rest')

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

// D24.1.2: `restRequest` backs every M09-era `src/api/*.ts` module (cron —
// the Tasks tab — plus config/models/profiles/skills/toolsets/mcp/
// messaging/plugins/system), so fixing the confirmed-401/403 gap here closes
// it for all of them at once, not just Tasks. Mirrors the same fix in
// src/api/sessions.ts (which predates this shared file and keeps its own
// inline copy).
describe('src/api/rest: restRequest marks needsLogin on a confirmed 401/403 (D24.1.2)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    backing.clear()
    secureStore.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('a confirmed 401 marks the connection needsLogin and throws a classified message', async () => {
    setActiveConnection({
      authMode: 'password',
      baseUrl: 'http://host',
      id: 'conn-rest-401',
      kind: 'remote',
      label: 'test'
    })

    global.fetch = vi.fn(async () => jsonResponse(401, { error: 'unauthorized' })) as unknown as typeof fetch

    await expect(restRequest('/api/cron/jobs')).rejects.not.toThrow(/HTTP 401/)
    expect(getActiveConnection()?.needsLogin).toBe(true)
  })

  it('a confirmed 403 also marks needsLogin', async () => {
    setActiveConnection({
      authMode: 'password',
      baseUrl: 'http://host',
      id: 'conn-rest-403',
      kind: 'remote',
      label: 'test'
    })

    global.fetch = vi.fn(async () => jsonResponse(403, { error: 'forbidden' })) as unknown as typeof fetch

    await expect(restRequest('/api/cron/jobs')).rejects.toThrow()
    expect(getActiveConnection()?.needsLogin).toBe(true)
  })

  it('a non-auth error (e.g. 500) does not mark needsLogin — never on a transient failure', async () => {
    setActiveConnection({
      authMode: 'password',
      baseUrl: 'http://host',
      id: 'conn-rest-500',
      kind: 'remote',
      label: 'test'
    })

    global.fetch = vi.fn(async () => jsonResponse(500, { error: 'boom' })) as unknown as typeof fetch

    await expect(restRequest('/api/cron/jobs')).rejects.toThrow()
    expect(getActiveConnection()?.needsLogin).toBeUndefined()
  })
})
