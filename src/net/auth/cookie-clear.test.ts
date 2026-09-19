import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clearCookiesViaTurboModules = vi.fn()
const clearCookiesViaNativeModules = vi.fn()
const turboModuleRegistryGet = vi.fn()

vi.mock('react-native', () => ({
  NativeModules: { Networking: { clearCookies: clearCookiesViaNativeModules } },
  TurboModuleRegistry: { get: turboModuleRegistryGet }
}))

const { clearAllCookies } = await import('./cookie-clear')

describe('clearAllCookies (D27 point 3)', () => {
  beforeEach(() => {
    clearCookiesViaTurboModules.mockReset()
    clearCookiesViaNativeModules.mockReset()
    turboModuleRegistryGet.mockReset()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Opus's round-3 review: on the New Architecture / bridgeless mode,
  // NativeModules.Networking is not guaranteed even when the module is
  // genuinely registered — TurboModuleRegistry is the reliable path there,
  // so it's tried first.
  describe('module resolution — TurboModuleRegistry first, NativeModules as a fallback', () => {
    it('prefers TurboModuleRegistry.get when it resolves the module', async () => {
      turboModuleRegistryGet.mockReturnValue({ clearCookies: clearCookiesViaTurboModules })
      clearCookiesViaTurboModules.mockImplementation((callback: (result: boolean) => void) => callback(true))

      await clearAllCookies()

      expect(turboModuleRegistryGet).toHaveBeenCalledWith('Networking')
      expect(clearCookiesViaTurboModules).toHaveBeenCalledTimes(1)
      expect(clearCookiesViaNativeModules).not.toHaveBeenCalled()
    })

    it('falls back to NativeModules.Networking when TurboModuleRegistry does not resolve it', async () => {
      turboModuleRegistryGet.mockReturnValue(null)
      clearCookiesViaNativeModules.mockImplementation((callback: (result: boolean) => void) => callback(true))

      await clearAllCookies()

      expect(clearCookiesViaNativeModules).toHaveBeenCalledTimes(1)
      expect(clearCookiesViaTurboModules).not.toHaveBeenCalled()
    })

    it('resolves immediately, calling neither, when neither path has the module', async () => {
      turboModuleRegistryGet.mockReturnValue(null)

      const nativeModules = (await import('react-native')).NativeModules as { Networking?: unknown }
      const original = nativeModules.Networking

      nativeModules.Networking = undefined

      try {
        await expect(clearAllCookies()).resolves.toBeUndefined()
        expect(clearCookiesViaTurboModules).not.toHaveBeenCalled()
        expect(clearCookiesViaNativeModules).not.toHaveBeenCalled()
      } finally {
        nativeModules.Networking = original
      }
    })

    it('also falls back to NativeModules when TurboModuleRegistry.get throws (an older RN with no such export shape)', async () => {
      turboModuleRegistryGet.mockImplementation(() => {
        throw new Error('TurboModuleRegistry unavailable')
      })
      clearCookiesViaNativeModules.mockImplementation((callback: (result: boolean) => void) => callback(true))

      await expect(clearAllCookies()).resolves.toBeUndefined()
      expect(clearCookiesViaNativeModules).toHaveBeenCalledTimes(1)
    })
  })

  it('resolves even when the native call reports failure — best-effort, never throws', async () => {
    turboModuleRegistryGet.mockReturnValue({ clearCookies: clearCookiesViaTurboModules })
    clearCookiesViaTurboModules.mockImplementation((callback: (result: boolean) => void) => callback(false))

    await expect(clearAllCookies()).resolves.toBeUndefined()
  })

  it('resolves even when the native call throws synchronously — best-effort, never throws', async () => {
    turboModuleRegistryGet.mockReturnValue({ clearCookies: clearCookiesViaTurboModules })
    clearCookiesViaTurboModules.mockImplementation(() => {
      throw new Error('native module unavailable')
    })

    await expect(clearAllCookies()).resolves.toBeUndefined()
  })

  // Opus's round-2 review: a callback that never fires must not hang
  // sign-out forever.
  it('resolves within the timeout when the native callback never fires', async () => {
    vi.useFakeTimers()
    turboModuleRegistryGet.mockReturnValue({ clearCookies: clearCookiesViaTurboModules })
    clearCookiesViaTurboModules.mockImplementation(() => {
      // Deliberately never calls its callback.
    })

    const promise = clearAllCookies()

    await vi.advanceTimersByTimeAsync(3_000)
    await expect(promise).resolves.toBeUndefined()
  })
})
