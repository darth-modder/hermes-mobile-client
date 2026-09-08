// Covers the pure policy in native-notifications.ts: shouldFire's attention
// vs. completion-kind gating, prefs persistence, and throttle dedupe.
// expo-notifications is mocked (same pattern as session-connection.test.ts's
// expo-secure-store mock) so the "actually dispatches" leg is testable too,
// without a real native module.

import { AppState } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const scheduleNotificationAsync = vi.fn(async () => 'notification-id')

vi.mock('expo-notifications', () => ({ scheduleNotificationAsync }))

const mmkvBacking = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mmkvBacking.get(key),
    set: (key: string, value: string) => {
      mmkvBacking.set(key, value)
    },
    remove: (key: string) => mmkvBacking.delete(key)
  })
}))

const {
  $nativeNotifyPrefs,
  ANDROID_NOTIFICATION_CHANNEL_ID,
  dispatchNativeNotification,
  setNativeNotifyEnabled,
  setNativeNotifyKind
} = await import('./native-notifications')

const { $activeRuntimeSessionId, $runtimeToStored } = await import('../store/session-states')

describe('native-notifications', () => {
  beforeEach(() => {
    mmkvBacking.clear()
    scheduleNotificationAsync.mockClear()
    setNativeNotifyEnabled(true)

    for (const kind of ['approval', 'input', 'turnDone', 'turnError', 'backgroundDone', 'credits', 'plugin'] as const) {
      setNativeNotifyKind(kind, true)
    }

    AppState.currentState = 'active'
    $activeRuntimeSessionId.set(null)
    $runtimeToStored.set({})
  })

  it('defaults to enabled with every kind on', () => {
    expect($nativeNotifyPrefs.get()).toEqual({
      enabled: true,
      kinds: {
        approval: true,
        backgroundDone: true,
        credits: true,
        input: true,
        plugin: true,
        turnDone: true,
        turnError: true
      }
    })
  })

  it('an attention kind (approval) fires while backgrounded even for the active session', async () => {
    AppState.currentState = 'background'
    $activeRuntimeSessionId.set('rt-1')
    $runtimeToStored.set({ 'rt-1': 'sid-1' })

    const fired = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-1', title: 'x' })

    expect(fired).toBe(true)
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1)
  })

  // A bare `trigger: null` fires immediately but on no particular channel,
  // so Android silently falls back to expo-notifications' own default
  // "Miscellaneous" channel instead of the app's registered hermes-default
  // one (importance/sound/badge all ignored) — found live, on-device.
  it('schedules on the app-registered Android channel, not the default trigger', async () => {
    await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-channel', title: 'x' })

    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: { channelId: ANDROID_NOTIFICATION_CHANNEL_ID } })
    )
  })

  it('an attention kind (input) fires while foregrounded if it is for a non-active session', async () => {
    AppState.currentState = 'active'
    $activeRuntimeSessionId.set('rt-1')
    $runtimeToStored.set({ 'rt-1': 'sid-1' })

    const fired = await dispatchNativeNotification({ kind: 'input', sessionId: 'sid-2', title: 'x' })

    expect(fired).toBe(true)
  })

  it('an attention kind does not fire while foregrounded on its own active session', async () => {
    AppState.currentState = 'active'
    $activeRuntimeSessionId.set('rt-1')
    $runtimeToStored.set({ 'rt-1': 'sid-1' })

    const fired = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-1', title: 'x' })

    expect(fired).toBe(false)
    expect(scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('a completion kind only fires for the active session while backgrounded', async () => {
    AppState.currentState = 'background'
    $activeRuntimeSessionId.set('rt-1')
    $runtimeToStored.set({ 'rt-1': 'sid-1' })

    expect(await dispatchNativeNotification({ kind: 'turnDone', sessionId: 'sid-2', title: 'x' })).toBe(false)
    expect(await dispatchNativeNotification({ kind: 'turnDone', sessionId: 'sid-1', title: 'x' })).toBe(true)
  })

  it('a disabled kind never fires', async () => {
    AppState.currentState = 'background'
    setNativeNotifyKind('approval', false)

    const fired = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-1', title: 'x' })

    expect(fired).toBe(false)
    expect(scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('the global off switch overrides every kind', async () => {
    AppState.currentState = 'background'
    setNativeNotifyEnabled(false)

    const fired = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-1', title: 'x' })

    expect(fired).toBe(false)
  })

  // Distinct, test-unique session ids below: `lastFiredAt` is a module-level
  // map with no test-only reset (it's private, self-evicting production
  // state), so reusing a session id another test already fired for could
  // spuriously throttle here too if the tests run within the same window.

  it('throttles a repeat of the same kind+session within the window', async () => {
    AppState.currentState = 'background'

    const first = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-throttle-1', title: 'x' })
    const second = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-throttle-1', title: 'x' })

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1)
  })

  it('does not throttle across different sessions', async () => {
    AppState.currentState = 'background'

    const first = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-throttle-2', title: 'x' })
    const second = await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-throttle-3', title: 'x' })

    expect(first).toBe(true)
    expect(second).toBe(true)
  })

  it('persists prefs across reads', () => {
    setNativeNotifyKind('approval', false)
    expect(mmkvBacking.get('hermes:native-notifications')).toContain('"approval":false')
  })
})
