import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppLifecycle } from './lifecycle'

describe('AppLifecycle', () => {
  let reconnectAndProbe: ReturnType<typeof vi.fn<() => Promise<void>>>
  let lifecycle: AppLifecycle

  beforeEach(() => {
    reconnectAndProbe = vi.fn<() => Promise<void>>(async () => {})
    lifecycle = new AppLifecycle({ reconnectAndProbe })
  })

  it('returning to active reconnects and probes', () => {
    lifecycle.handleAppStateChange('active')

    expect(reconnectAndProbe).toHaveBeenCalledTimes(1)
  })

  it('an active -> background transition calls nothing (D10: the client-side grace is withdrawn)', () => {
    lifecycle.handleAppStateChange('background')

    expect(reconnectAndProbe).not.toHaveBeenCalled()
  })

  it('inactive also calls nothing', () => {
    lifecycle.handleAppStateChange('inactive')

    expect(reconnectAndProbe).not.toHaveBeenCalled()
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

  it('dispose does not throw', () => {
    expect(() => lifecycle.dispose()).not.toThrow()
  })
})
