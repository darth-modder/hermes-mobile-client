// Covers the pure policy in native-notifications.ts: shouldFire's attention
// vs. completion-kind gating, prefs persistence, and throttle dedupe.
// expo-notifications is mocked (same pattern as session-connection.test.ts's
// expo-secure-store mock) so the "actually dispatches" leg is testable too,
// without a real native module.

import { AppState } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const scheduleNotificationAsync = vi.fn(async (_request: Record<string, unknown>) => 'notification-id')
const dismissNotificationAsync = vi.fn(async () => undefined)
const dismissAllNotificationsAsync = vi.fn(async () => undefined)

vi.mock('expo-notifications', () => ({
  dismissAllNotificationsAsync,
  dismissNotificationAsync,
  scheduleNotificationAsync
}))

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
  dismissAllNativeNotifications,
  dismissNativeNotification,
  dispatchNativeNotification,
  setNativeNotifyEnabled,
  setNativeNotifyKind
} = await import('./native-notifications')

const { $activeRuntimeSessionId, $runtimeToStored } = await import('../store/session-states')

describe('native-notifications', () => {
  beforeEach(() => {
    mmkvBacking.clear()
    scheduleNotificationAsync.mockClear()
    dismissNotificationAsync.mockClear()
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

// D26/D31: an approval/sudo/secret/input notification whose underlying
// request has since cleared — answered here, answered from another client,
// expired, or the turn ended — must not linger in the tray with stale info
// (found live: a stale notification sat next to a since-Rejected approval,
// and a second approval arriving while it was still there got no
// notification of its own). D31 replaced the in-memory
// requestId -> OS-identifier map with the request id AS the OS identifier
// (passed to scheduleNotificationAsync), so dismissal needs no prior
// in-process bookkeeping — the bug was exactly that bookkeeping: a JS reload
// (M06's spontaneous-reload finding) wiped the map, orphaning any
// notification scheduled before it, which then could never be dismissed and
// a re-post of the same request piled up a duplicate instead of replacing it.
describe('dismissNativeNotification: dismissal by request id, no lookup required (D26/D31)', () => {
  beforeEach(() => {
    mmkvBacking.clear()
    scheduleNotificationAsync.mockClear()
    dismissNotificationAsync.mockClear()
    setNativeNotifyEnabled(true)

    for (const kind of ['approval', 'input', 'turnDone', 'turnError', 'backgroundDone', 'credits', 'plugin'] as const) {
      setNativeNotifyKind(kind, true)
    }

    AppState.currentState = 'background'
  })

  it('schedules the notification with the request id as its own OS identifier', async () => {
    await dispatchNativeNotification({ kind: 'approval', requestId: 'req-1', sessionId: 'sid-dismiss-1', title: 'x' })

    expect(scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'req-1' }))
  })

  it('answering in the app dismisses the notification by request id directly', async () => {
    await dispatchNativeNotification({ kind: 'approval', requestId: 'req-2', sessionId: 'sid-dismiss-2', title: 'x' })
    await dismissNativeNotification('req-2')

    expect(dismissNotificationAsync).toHaveBeenCalledWith('req-2')
  })

  // The core D31 fix: previously the in-memory map was the only record of
  // "a notification exists for this request," so a dismiss with no matching
  // map entry (map wiped by a JS reload, or called from a fresh process)
  // silently did nothing — the real bug this pins closed.
  it('dismissal works with no prior in-process state — no dispatch in this process, still dismissed', async () => {
    await dismissNativeNotification('never-dispatched-this-process')

    expect(dismissNotificationAsync).toHaveBeenCalledWith('never-dispatched-this-process')
  })

  // Two different sessions (not the throttle-relevant repeat of the same
  // kind+session, which "throttles a repeat" above already covers) so this
  // pins the identifier behavior on its own: the same request id always
  // produces the same OS identifier, which is what makes a re-post replace
  // rather than duplicate — the exact defect a spontaneous JS reload exposed
  // live (the same server event re-delivered after reload, twice in the tray).
  it('the same request id always resolves to the same OS identifier, across separate dispatches', async () => {
    await dispatchNativeNotification({
      kind: 'approval',
      requestId: 'req-replace',
      sessionId: 'sid-replace-a',
      title: 'first'
    })
    await dispatchNativeNotification({
      kind: 'approval',
      requestId: 'req-replace',
      sessionId: 'sid-replace-b',
      title: 'second'
    })

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(2)
    expect(scheduleNotificationAsync.mock.calls[0][0]).toEqual(expect.objectContaining({ identifier: 'req-replace' }))
    expect(scheduleNotificationAsync.mock.calls[1][0]).toEqual(expect.objectContaining({ identifier: 'req-replace' }))
  })

  it('dismissing one request id does not touch a different one', async () => {
    await dispatchNativeNotification({
      kind: 'approval',
      requestId: 'req-first',
      sessionId: 'sid-dismiss-3',
      title: 'x'
    })
    await dispatchNativeNotification({
      kind: 'approval',
      requestId: 'req-second',
      sessionId: 'sid-dismiss-4',
      title: 'x'
    })
    await dismissNativeNotification('req-first')

    expect(dismissNotificationAsync).toHaveBeenCalledTimes(1)
    expect(dismissNotificationAsync).toHaveBeenCalledWith('req-first')
  })

  it('never throws when the underlying dismiss rejects — best-effort, same as scheduling', async () => {
    dismissNotificationAsync.mockRejectedValueOnce(new Error('native module unavailable'))

    await expect(dismissNativeNotification('req-1')).resolves.toBeUndefined()
  })

  it('a dispatch with no requestId schedules with no explicit identifier (OS auto-generates one)', async () => {
    await dispatchNativeNotification({ kind: 'approval', sessionId: 'sid-no-request-id', title: 'x' })

    expect('identifier' in scheduleNotificationAsync.mock.calls[0][0]).toBe(false)
  })
})

// D27/D31: sign-out's own clear needs every pending-request notification
// gone, including one scheduled before the current app process started —
// which is exactly why this calls the platform's own dismiss-all rather than
// looping known request ids (there's no map of "known" ones any more).
describe('dismissAllNativeNotifications: sign-out clears the whole tray (D27)', () => {
  beforeEach(() => {
    mmkvBacking.clear()
    scheduleNotificationAsync.mockClear()
    dismissNotificationAsync.mockClear()
    dismissAllNotificationsAsync.mockClear()
    setNativeNotifyEnabled(true)

    for (const kind of ['approval', 'input', 'turnDone', 'turnError', 'backgroundDone', 'credits', 'plugin'] as const) {
      setNativeNotifyKind(kind, true)
    }

    AppState.currentState = 'background'
  })

  it('calls dismissAllNotificationsAsync', async () => {
    await dismissAllNativeNotifications()

    expect(dismissAllNotificationsAsync).toHaveBeenCalledTimes(1)
  })

  // D31: unlike the old map-backed dismiss, a per-request dismiss no longer
  // depends on any state dismissAllNativeNotifications could clear — calling
  // it after dismissAll is redundant (the OS notification is already gone)
  // but still goes through, not silently suppressed.
  it('a per-request dismiss called after dismissAll still reaches the OS, harmlessly', async () => {
    await dispatchNativeNotification({
      kind: 'approval',
      requestId: 'req-x',
      sessionId: 'sid-dismiss-all-1',
      title: 'x'
    })
    await dismissAllNativeNotifications()
    dismissNotificationAsync.mockClear()
    await dismissNativeNotification('req-x')

    expect(dismissNotificationAsync).toHaveBeenCalledWith('req-x')
  })

  it('never throws when dismissAllNotificationsAsync itself rejects — best-effort, same as the single-id dismiss', async () => {
    dismissAllNotificationsAsync.mockRejectedValueOnce(new Error('native module unavailable'))

    await expect(dismissAllNativeNotifications()).resolves.toBeUndefined()
  })
})
