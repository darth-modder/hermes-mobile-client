// Covers the "ask in context, ask once" gate: notification-permission.ts.
// expo-notifications and react-native-mmkv are mocked, same pattern as
// native-notifications.test.ts and register.test.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPermissionsAsync = vi.fn(async () => ({ canAskAgain: true, status: 'undetermined' }))
const requestPermissionsAsync = vi.fn(async () => ({ canAskAgain: true, status: 'granted' }))

vi.mock('expo-notifications', () => ({ getPermissionsAsync, requestPermissionsAsync }))

const mmkvBacking = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mmkvBacking.get(key),
    remove: (key: string) => mmkvBacking.delete(key),
    set: (key: string, value: string) => {
      mmkvBacking.set(key, value)
    }
  })
}))

const {
  ensureNotificationPermissionRequested,
  getNotificationPermissionStatus,
  hasRequestedNotificationPermission,
  requestNotificationPermission
} = await import('./notification-permission')

const REPO_ROOT = join(__dirname, '..', '..')

describe('notification-permission', () => {
  beforeEach(() => {
    mmkvBacking.clear()
    getPermissionsAsync.mockClear()
    requestPermissionsAsync.mockClear()
    getPermissionsAsync.mockResolvedValue({ canAskAgain: true, status: 'undetermined' })
    requestPermissionsAsync.mockResolvedValue({ canAskAgain: true, status: 'granted' })
  })

  describe('hasRequestedNotificationPermission', () => {
    it('is false before anything has asked', () => {
      expect(hasRequestedNotificationPermission()).toBe(false)
    })
  })

  describe('ensureNotificationPermissionRequested — ask once', () => {
    it('checks and requests on the first call when not yet granted', async () => {
      await ensureNotificationPermissionRequested()

      expect(getPermissionsAsync).toHaveBeenCalledTimes(1)
      expect(requestPermissionsAsync).toHaveBeenCalledTimes(1)
      expect(hasRequestedNotificationPermission()).toBe(true)
    })

    it('does not check or request again on a second call', async () => {
      await ensureNotificationPermissionRequested()
      getPermissionsAsync.mockClear()
      requestPermissionsAsync.mockClear()

      await ensureNotificationPermissionRequested()

      expect(getPermissionsAsync).not.toHaveBeenCalled()
      expect(requestPermissionsAsync).not.toHaveBeenCalled()
    })

    it('does not request when already granted, but still marks asked', async () => {
      getPermissionsAsync.mockResolvedValueOnce({ canAskAgain: true, status: 'granted' })

      await ensureNotificationPermissionRequested()

      expect(requestPermissionsAsync).not.toHaveBeenCalled()
      expect(hasRequestedNotificationPermission()).toBe(true)
    })

    it('does not throw and still marks asked when the user declines (denied path)', async () => {
      requestPermissionsAsync.mockResolvedValueOnce({ canAskAgain: true, status: 'denied' })

      await expect(ensureNotificationPermissionRequested()).resolves.toBeUndefined()
      expect(hasRequestedNotificationPermission()).toBe(true)
    })

    it('never asks again after a decline, even across separate calls', async () => {
      requestPermissionsAsync.mockResolvedValueOnce({ canAskAgain: true, status: 'denied' })
      await ensureNotificationPermissionRequested()

      getPermissionsAsync.mockClear()
      requestPermissionsAsync.mockClear()
      await ensureNotificationPermissionRequested()
      await ensureNotificationPermissionRequested()

      expect(getPermissionsAsync).not.toHaveBeenCalled()
      expect(requestPermissionsAsync).not.toHaveBeenCalled()
    })

    it('is best-effort: a native failure does not throw, and still marks asked', async () => {
      getPermissionsAsync.mockRejectedValueOnce(new Error('no native module'))

      await expect(ensureNotificationPermissionRequested()).resolves.toBeUndefined()
      expect(hasRequestedNotificationPermission()).toBe(true)
    })
  })

  describe('requestNotificationPermission — the Settings screen action', () => {
    it('always calls through to the OS, regardless of prior asked state', async () => {
      await ensureNotificationPermissionRequested()
      requestPermissionsAsync.mockClear()

      await requestNotificationPermission()

      expect(requestPermissionsAsync).toHaveBeenCalledTimes(1)
    })

    it('marks asked', async () => {
      expect(hasRequestedNotificationPermission()).toBe(false)

      await requestNotificationPermission()

      expect(hasRequestedNotificationPermission()).toBe(true)
    })
  })

  describe('getNotificationPermissionStatus — a read, not a request', () => {
    it('never marks asked and never requests', async () => {
      await getNotificationPermissionStatus()

      expect(requestPermissionsAsync).not.toHaveBeenCalled()
      expect(hasRequestedNotificationPermission()).toBe(false)
    })
  })

  // Regression guard for the bug this file fixes: the permission request
  // must not happen at app-mount (useNotifications.ts), before a gateway is
  // even connected. Source-scan, not a render test — this codebase has no
  // .tsx/.ts hook render tests (useNotifications.ts's own header explains
  // why: it's native-plumbing-only).
  it('useNotifications.ts no longer requests permission at mount', () => {
    const source = readFileSync(join(REPO_ROOT, 'src/push/useNotifications.ts'), 'utf-8')

    expect(source).not.toContain('requestPermissionsAsync')
  })
})
