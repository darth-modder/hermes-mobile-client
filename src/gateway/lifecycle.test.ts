import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppLifecycle, BACKGROUND_GRACE_MS } from './lifecycle'

function fakeTimers() {
  let nextHandle = 1
  const pending = new Map<number, { at: number; callback: () => void }>()
  let now = 0

  return {
    advance(ms: number): void {
      now += ms

      for (const [handle, entry] of [...pending.entries()]) {
        if (entry.at <= now) {
          pending.delete(handle)
          entry.callback()
        }
      }
    },
    clearTimeout: (handle: number) => {
      pending.delete(handle)
    },
    setTimeout: (callback: () => void, ms: number) => {
      const handle = nextHandle++

      pending.set(handle, { at: now + ms, callback })

      return handle
    }
  }
}

describe('AppLifecycle', () => {
  let closeConnection: ReturnType<typeof vi.fn<() => void>>
  let reconnectAndProbe: ReturnType<typeof vi.fn<() => Promise<void>>>
  let timers: ReturnType<typeof fakeTimers>
  let lifecycle: AppLifecycle

  beforeEach(() => {
    closeConnection = vi.fn<() => void>(() => {})
    reconnectAndProbe = vi.fn<() => Promise<void>>(async () => {})
    timers = fakeTimers()
    lifecycle = new AppLifecycle({
      clearTimeout: timers.clearTimeout,
      closeConnection,
      reconnectAndProbe,
      setTimeout: timers.setTimeout
    })
  })

  it('closes the connection after the background grace elapses', () => {
    lifecycle.handleAppStateChange('background')

    timers.advance(BACKGROUND_GRACE_MS - 1)
    expect(closeConnection).not.toHaveBeenCalled()

    timers.advance(1)
    expect(closeConnection).toHaveBeenCalledTimes(1)
  })

  it('returning to active before the grace elapses cancels the close', () => {
    lifecycle.handleAppStateChange('background')
    timers.advance(BACKGROUND_GRACE_MS - 1)

    lifecycle.handleAppStateChange('active')
    timers.advance(1000)

    expect(closeConnection).not.toHaveBeenCalled()
  })

  it('returning to active reconnects and probes', () => {
    lifecycle.handleAppStateChange('background')
    lifecycle.handleAppStateChange('active')

    expect(reconnectAndProbe).toHaveBeenCalledTimes(1)
  })

  it('treats inactive the same as background (starts the grace timer)', () => {
    lifecycle.handleAppStateChange('inactive')
    timers.advance(BACKGROUND_GRACE_MS)

    expect(closeConnection).toHaveBeenCalledTimes(1)
  })

  it('a second background transition does not restart an already-armed grace timer', () => {
    lifecycle.handleAppStateChange('background')
    timers.advance(BACKGROUND_GRACE_MS - 1)
    lifecycle.handleAppStateChange('background')
    timers.advance(1)

    expect(closeConnection).toHaveBeenCalledTimes(1)
  })

  it('network closed -> open reconnects and probes', () => {
    lifecycle.handleNetworkChange('open', 'closed')

    expect(reconnectAndProbe).toHaveBeenCalledTimes(1)
  })

  it('network open -> closed is a no-op', () => {
    lifecycle.handleNetworkChange('closed', 'open')

    expect(reconnectAndProbe).not.toHaveBeenCalled()
  })

  it('network open -> open (no real transition) is a no-op', () => {
    lifecycle.handleNetworkChange('open', 'open')

    expect(reconnectAndProbe).not.toHaveBeenCalled()
  })

  it('dispose cancels a pending grace timer', () => {
    lifecycle.handleAppStateChange('background')
    lifecycle.dispose()
    timers.advance(BACKGROUND_GRACE_MS)

    expect(closeConnection).not.toHaveBeenCalled()
  })

  // Regression for the M07 background/foreground recovery bug (Opus's
  // 2026-09-08 verification): Android can suspend the JS thread for the
  // entire background window, so an already-overdue grace timer's "fire"
  // callback can be in flight on the native bridge by the time `active`
  // calls `clearTimeout` — cancellation loses that race and the callback
  // runs anyway, *after* `active` has already reconnected. The fake timers
  // above always honor `clearTimeout` (unlike the real platform), so this
  // test injects a `clearTimeout` that — like the real bug — does not
  // actually prevent the captured callback from later running, to prove the
  // close is still suppressed once `active` has been processed.
  it('a grace timer that fires after returning to active (clearTimeout lost the race) does not close the reconnected connection', () => {
    const captured: { callback: (() => void) | null } = { callback: null }

    const raceyLifecycle = new AppLifecycle({
      clearTimeout: () => {
        // No-op: simulates clearTimeout losing the race against an
        // already in-flight native "fire" callback.
      },
      closeConnection,
      reconnectAndProbe,
      setTimeout: callback => {
        captured.callback = callback

        return 1
      }
    })

    raceyLifecycle.handleAppStateChange('background')
    raceyLifecycle.handleAppStateChange('active')

    expect(reconnectAndProbe).toHaveBeenCalledTimes(1)
    expect(closeConnection).not.toHaveBeenCalled()

    // The stale timer fires anyway, despite the (ineffective) cancellation.
    captured.callback?.()

    expect(closeConnection).not.toHaveBeenCalled()
  })

  it('a grace timer that fires while still backgrounded still closes (the ordinary, non-racing case)', () => {
    const captured: { callback: (() => void) | null } = { callback: null }

    const raceyLifecycle = new AppLifecycle({
      clearTimeout: () => {},
      closeConnection,
      reconnectAndProbe,
      setTimeout: callback => {
        captured.callback = callback

        return 1
      }
    })

    raceyLifecycle.handleAppStateChange('background')
    captured.callback?.()

    expect(closeConnection).toHaveBeenCalledTimes(1)
  })
})
