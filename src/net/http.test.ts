// M11 Defect 3: `/api/audio/speak` accepted a request and never answered, and the speak button
// spun forever — `httpRequest`'s AbortController.abort() fired at the 180s deadline (confirmed
// live), but the `fetch()` promise it was meant to cancel never settled, so `httpRequest` itself
// never settled either. These tests simulate exactly that: a `fetch` mock that ignores the abort
// signal entirely and never resolves/rejects on its own, proving `httpRequest` must not depend
// solely on `fetch` honoring the signal to make its own promise settle.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpRequest } from './http'

describe('httpRequest: timeout must settle the promise even if fetch ignores the abort signal', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  it('rejects at the deadline against a fetch that never settles, abort signal or not', async () => {
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch

    let settled = false

    const promise = httpRequest('http://host', '/api/audio/speak', { timeoutMs: 1000 })

    promise.catch(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)

    await expect(promise).rejects.toThrow(/timed out after 1s/)
  })

  it('still calls AbortController.abort() at the deadline (best-effort release on platforms where it works)', async () => {
    let capturedSignal: AbortSignal | undefined

    global.fetch = vi.fn((_url: unknown, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined

      return new Promise<Response>(() => {})
    }) as unknown as typeof fetch

    const promise = httpRequest('http://host', '/api/audio/speak', { timeoutMs: 1000 })

    promise.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(1000)

    expect(capturedSignal?.aborted).toBe(true)
  })

  it('a fetch that settles first still resolves normally (no regression on the happy path)', async () => {
    global.fetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ ok: true })
        }) as Response
    ) as unknown as typeof fetch

    await expect(httpRequest('http://host', '/api/status', { timeoutMs: 1000 })).resolves.toEqual({ ok: true })
  })
})
