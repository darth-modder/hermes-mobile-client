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

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn()
}))

const { setActiveConnection } = await import('../connections/registry')
const { setConnectionToken } = await import('../connections/secure')

const {
  createCronJob,
  deleteCronJob,
  getCronDeliveryTargets,
  listCronJobs,
  pauseCronJob,
  resumeCronJob,
  triggerCronJob,
  updateCronJob
} = await import('./cron')

// Recorded live (GET /api/cron/delivery-targets) from this milestone's
// throwaway gateway — two seeded profiles (researcher, coder) each surface
// their own bot-chat delivery target alongside the always-present "local".
const DELIVERY_TARGETS_FIXTURE = {
  targets: [
    { home_env_var: null, home_target_set: true, id: 'local', name: 'Local (save only)' },
    { home_env_var: null, home_target_set: true, id: 'bot-chat:default', name: 'Bot Chat (default)' },
    { home_env_var: null, home_target_set: true, id: 'bot-chat:coder', name: 'Bot Chat (coder)' },
    { home_env_var: null, home_target_set: true, id: 'bot-chat:researcher', name: 'Bot Chat (researcher)' }
  ]
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('src/api/cron', () => {
  const originalFetch = global.fetch

  beforeEach(async () => {
    backing.clear()
    setActiveConnection({ authMode: 'token', baseUrl: 'http://host', id: 'conn-1', kind: 'remote', label: 'test' })
    await setConnectionToken('conn-1', 'tok-abc')
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('listCronJobs returns the bare array unwrapped', async () => {
    const jobs = [{ enabled: true, id: 'job-1' }]

    global.fetch = vi.fn(async () => jsonResponse(200, jobs)) as unknown as typeof fetch

    const result = await listCronJobs('work')

    expect(result).toEqual(jobs)

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string]

    expect(url).toContain('/api/cron/jobs')
    expect(url).toContain('profile=work')
  })

  it('createCronJob POSTs the payload as-is', async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, { enabled: true, id: 'job-1' })) as unknown as typeof fetch

    await createCronJob({ name: 'Morning', prompt: 'Say hi', schedule: '0 9 * * *' })

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]

    expect(url).toContain('/api/cron/jobs')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Morning', prompt: 'Say hi', schedule: '0 9 * * *' })
  })

  it('updateCronJob wraps the patch in an "updates" envelope (CronJobUpdate.updates: dict)', async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, { enabled: false, id: 'job-1' })) as unknown as typeof fetch

    await updateCronJob('job-1', { enabled: false })

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]

    expect(url).toContain('/api/cron/jobs/job-1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ updates: { enabled: false } })
  })

  it.each([
    ['pause', pauseCronJob],
    ['resume', resumeCronJob],
    ['trigger', triggerCronJob]
  ] as const)('%s POSTs to the matching action route', async (action, fn) => {
    global.fetch = vi.fn(async () => jsonResponse(200, { enabled: true, id: 'job-1' })) as unknown as typeof fetch

    await fn('job-1')

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]

    expect(url).toContain(`/api/cron/jobs/job-1/${action}`)
    expect(init.method).toBe('POST')
  })

  it('deleteCronJob DELETEs the job', async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, { ok: true })) as unknown as typeof fetch

    await deleteCronJob('job-1')

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]

    expect(url).toContain('/api/cron/jobs/job-1')
    expect(init.method).toBe('DELETE')
  })

  it('getCronDeliveryTargets GETs the list, local always first', async () => {
    global.fetch = vi.fn(async () => jsonResponse(200, DELIVERY_TARGETS_FIXTURE)) as unknown as typeof fetch

    const result = await getCronDeliveryTargets()

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]

    expect(url).toContain('/api/cron/delivery-targets')
    expect(init.method).toBe('GET')
    expect(result).toEqual(DELIVERY_TARGETS_FIXTURE)
    expect(result.targets[0]).toEqual({
      home_env_var: null,
      home_target_set: true,
      id: 'local',
      name: 'Local (save only)'
    })
  })
})
