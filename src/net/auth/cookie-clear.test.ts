import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clearCookies = vi.fn()

vi.mock('react-native', () => ({
  NativeModules: { Networking: { clearCookies } }
}))

const { clearAllCookies } = await import('./cookie-clear')

describe('clearAllCookies (D27 point 3)', () => {
  beforeEach(() => {
    clearCookies.mockReset()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls NativeModules.Networking.clearCookies', async () => {
    clearCookies.mockImplementation((callback: (result: boolean) => void) => callback(true))

    await clearAllCookies()

    expect(clearCookies).toHaveBeenCalledTimes(1)
  })

  it('resolves even when the native call reports failure — best-effort, never throws', async () => {
    clearCookies.mockImplementation((callback: (result: boolean) => void) => callback(false))

    await expect(clearAllCookies()).resolves.toBeUndefined()
  })

  it('resolves even when the native call throws synchronously — best-effort, never throws', async () => {
    clearCookies.mockImplementation(() => {
      throw new Error('native module unavailable')
    })

    await expect(clearAllCookies()).resolves.toBeUndefined()
  })

  // Opus's round-2 review: a callback that never fires must not hang
  // sign-out forever.
  it('resolves within the timeout when the native callback never fires', async () => {
    vi.useFakeTimers()
    clearCookies.mockImplementation(() => {
      // Deliberately never calls its callback.
    })

    const promise = clearAllCookies()

    await vi.advanceTimersByTimeAsync(3_000)
    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves immediately (well under the timeout) when NativeModules.Networking is missing entirely', async () => {
    clearCookies.mockReset()

    const nativeModules = (await import('react-native')).NativeModules as { Networking?: unknown }
    const original = nativeModules.Networking

    nativeModules.Networking = undefined

    try {
      await expect(clearAllCookies()).resolves.toBeUndefined()
      expect(clearCookies).not.toHaveBeenCalled()
    } finally {
      nativeModules.Networking = original
    }
  })
})
