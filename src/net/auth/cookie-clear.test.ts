import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native/Libraries/Network/RCTNetworking', () => ({
  default: { clearCookies: vi.fn((callback: (result: boolean) => void) => callback(true)) }
}))

const RCTNetworking = (await import('react-native/Libraries/Network/RCTNetworking')).default as {
  clearCookies: ReturnType<typeof vi.fn>
}

const { clearAllCookies } = await import('./cookie-clear')

describe('clearAllCookies (D27 point 3)', () => {
  afterEach(() => {
    RCTNetworking.clearCookies.mockClear()
  })

  it('calls RCTNetworking.clearCookies', async () => {
    await clearAllCookies()

    expect(RCTNetworking.clearCookies).toHaveBeenCalledTimes(1)
  })

  it('resolves even when the native call reports failure — best-effort, never throws', async () => {
    RCTNetworking.clearCookies.mockImplementationOnce((callback: (result: boolean) => void) => callback(false))

    await expect(clearAllCookies()).resolves.toBeUndefined()
  })

  it('resolves even when the native call throws synchronously — best-effort, never throws', async () => {
    RCTNetworking.clearCookies.mockImplementationOnce(() => {
      throw new Error('native module unavailable')
    })

    await expect(clearAllCookies()).resolves.toBeUndefined()
  })
})
