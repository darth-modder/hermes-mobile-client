// Adapted from apps/desktop/src/app/session/hooks/use-message-stream/
// delta-flush.test.tsx — same adaptive-floor arithmetic (fixed 33ms,
// stretching to 3x the last reported flush cost, capped at 250ms), tested
// against the standalone scheduler directly instead of a rendered hook (see
// delta-flush-scheduler.ts's header for why the desktop's rAF-based cost
// measurement isn't ported verbatim).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DeltaFlushScheduler, MAX_STREAM_FLUSH_GAP_MS, STREAM_DELTA_FLUSH_MS } from './delta-flush-scheduler'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DeltaFlushScheduler', () => {
  it('flushes on the fixed 33ms floor when no cost has been reported', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.schedule()
    expect(flush).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(STREAM_DELTA_FLUSH_MS - 1)
    expect(flush).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('is a no-op while a flush is already pending', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule()

    await vi.advanceTimersByTimeAsync(STREAM_DELTA_FLUSH_MS)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushNow flushes immediately and cancels the pending timer', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.schedule()
    scheduler.flushNow()
    expect(flush).toHaveBeenCalledTimes(1)

    // The cancelled timer must not fire a second flush later.
    await vi.advanceTimersByTimeAsync(STREAM_DELTA_FLUSH_MS)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('dispose cancels a pending timer without flushing', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.schedule()
    scheduler.dispose()

    await vi.advanceTimersByTimeAsync(STREAM_DELTA_FLUSH_MS)
    expect(flush).not.toHaveBeenCalled()
  })

  it('stretches the flush gap to 3x the last reported cost', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(STREAM_DELTA_FLUSH_MS)
    expect(flush).toHaveBeenCalledTimes(1)

    scheduler.reportFlushCost(60)
    scheduler.schedule()

    await vi.advanceTimersByTimeAsync(179)
    expect(flush).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('caps the adaptive floor at MAX_STREAM_FLUSH_GAP_MS even under a very expensive reported cost', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.reportFlushCost(1000) // 3x would be 3000ms; capped to 250ms
    scheduler.schedule()

    await vi.advanceTimersByTimeAsync(MAX_STREAM_FLUSH_GAP_MS - 1)
    expect(flush).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('accounts for time already elapsed since the last flush when computing the next gap', async () => {
    const flush = vi.fn()
    const scheduler = new DeltaFlushScheduler({ flush })

    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(STREAM_DELTA_FLUSH_MS)
    expect(flush).toHaveBeenCalledTimes(1)

    scheduler.reportFlushCost(60) // adaptive floor would be 180ms
    await vi.advanceTimersByTimeAsync(100) // 100ms pass with nothing scheduled

    scheduler.schedule() // only 80ms left of the 180ms floor
    await vi.advanceTimersByTimeAsync(79)
    expect(flush).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(flush).toHaveBeenCalledTimes(2)
  })
})
