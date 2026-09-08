/**
 * M07's "foreground notifications" task line, ported from upstream's
 * `apps/desktop/src/store/native-notifications.ts` (Electron `Notification`)
 * to `expo-notifications`. Kept the same shape (kinds, attention set,
 * throttle, persisted per-kind prefs) so a future settings screen (M09) can
 * port the desktop preferences UI without a second redesign.
 *
 * Scope cut vs. upstream: the plugin door (`ctx.os.notify`,
 * `dispatchPluginNativeNotification`) is not ported — plugins have no UI
 * surface on mobile (AGENTS.md: "machine features don't exist here"). Only
 * `approval` and `input` are dispatched from anywhere in this app today (the
 * four blocking-input effects the reducer already emits —
 * `session-stream/types.ts`'s `Effect` union has no `turnDone` / `turnError`
 * / `backgroundDone` / `credits` effect yet), so the other four kinds exist
 * in the type for shape parity but have no caller. That matches this
 * milestone's own exit criterion: "an approval for a non-active session
 * shows a local notification whose tap opens that session."
 */

import { atom } from 'nanostores'
import { AppState } from 'react-native'

import { readJson, writeJson } from '../lib/storage'
import { $activeRuntimeSessionId, $runtimeToStored } from '../store/session-states'

export type NativeNotificationKind =
  'approval' | 'backgroundDone' | 'credits' | 'input' | 'plugin' | 'turnDone' | 'turnError'

export const NATIVE_NOTIFICATION_KINDS: readonly NativeNotificationKind[] = [
  'approval',
  'input',
  'turnDone',
  'turnError',
  'backgroundDone',
  'credits',
  'plugin'
]

// Blocking prompts — surface even while focused if they're for another session.
const ATTENTION_KINDS = new Set<NativeNotificationKind>(['approval', 'input'])

export interface NativeNotificationPrefs {
  enabled: boolean
  kinds: Record<NativeNotificationKind, boolean>
}

const STORAGE_KEY = 'hermes:native-notifications'

// Registered by useNotifications.ts's setNotificationChannelAsync call (the
// Android O+ channel this app actually configures — importance, sound,
// badge). Owned here, the "pure policy" module, rather than there, so the
// two can't drift: without passing this on the trigger below, a scheduled
// notification silently falls back to expo-notifications' own default
// "Miscellaneous" channel instead of this one (found live, on-device).
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'hermes-default'

const DEFAULT_PREFS: NativeNotificationPrefs = {
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
}

function readPrefs(): NativeNotificationPrefs {
  const parsed = readJson<Partial<NativeNotificationPrefs>>(STORAGE_KEY)

  if (!parsed) {
    return DEFAULT_PREFS
  }

  const kinds = { ...DEFAULT_PREFS.kinds }

  for (const kind of NATIVE_NOTIFICATION_KINDS) {
    const value = parsed.kinds?.[kind]

    if (typeof value === 'boolean') {
      kinds[kind] = value
    }
  }

  return {
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_PREFS.enabled,
    kinds
  }
}

export const $nativeNotifyPrefs = atom<NativeNotificationPrefs>(readPrefs())

function writePrefs(next: NativeNotificationPrefs) {
  $nativeNotifyPrefs.set(next)
  writeJson(STORAGE_KEY, next)
}

export function setNativeNotifyEnabled(enabled: boolean): void {
  writePrefs({ ...$nativeNotifyPrefs.get(), enabled })
}

export function setNativeNotifyKind(kind: NativeNotificationKind, on: boolean): void {
  const prev = $nativeNotifyPrefs.get()

  writePrefs({ ...prev, kinds: { ...prev.kinds, [kind]: on } })
}

// De-dupe replayed events for the same kind+session. Self-evicting: entries
// older than the window are pruned on every dispatch, so the map can't grow.
const THROTTLE_MS = 1000
const lastFiredAt = new Map<string, number>()

function throttled(key: string, now: number): boolean {
  for (const [k, at] of lastFiredAt) {
    if (now - at >= THROTTLE_MS) {
      lastFiredAt.delete(k)
    }
  }

  if (lastFiredAt.has(key)) {
    return true
  }

  lastFiredAt.set(key, now)

  return false
}

// "Backgrounded" = the user isn't looking at Hermes at all. RN's AppState has
// no desktop-style "visible but unfocused" state, so unlike the desktop port
// (document.hidden || !document.hasFocus()) this is just `!== 'active'`.
function isBackgrounded(): boolean {
  return AppState.currentState !== 'active'
}

/** The stored session id currently bound "on screen" — mirrors the reducer's
 *  own placeholder-key convention (an unbound runtime id is its own stored
 *  id) since this app has no separate "currently viewed" tracker: M06/M07's
 *  one-active-connection model means the active runtime session already IS
 *  the one screen the user can be looking at. */
function activeStoredSessionId(): null | string {
  const activeRuntimeId = $activeRuntimeSessionId.get()

  if (!activeRuntimeId) {
    return null
  }

  return $runtimeToStored.get()[activeRuntimeId] ?? activeRuntimeId
}

function shouldFire(kind: NativeNotificationKind, sessionId?: null | string): boolean {
  if (ATTENTION_KINDS.has(kind)) {
    return isBackgrounded() || (Boolean(sessionId) && sessionId !== activeStoredSessionId())
  }

  // Completion kinds: only the active session, only while away. No caller
  // exists for these yet (see the file doc comment) but the gate is ported
  // now so adding one later doesn't also require re-deriving this rule.
  return isBackgrounded() && Boolean(sessionId) && sessionId === activeStoredSessionId()
}

export interface NativeNotificationInput {
  kind: NativeNotificationKind
  title: string
  body?: string
  sessionId?: null | string
}

/**
 * Returns true when the notification passed every guard and was handed to
 * `expo-notifications`. `Notifications` is imported lazily (dynamic import)
 * so this module — and everything that merely reads `$nativeNotifyPrefs` —
 * stays importable from a plain vitest run without the native module
 * present (mirrors this project's existing MMKV-laziness pattern in
 * `src/lib/storage.ts`).
 */
export async function dispatchNativeNotification(input: NativeNotificationInput): Promise<boolean> {
  const prefs = $nativeNotifyPrefs.get()

  if (!prefs.enabled || !prefs.kinds[input.kind]) {
    return false
  }

  if (!shouldFire(input.kind, input.sessionId)) {
    return false
  }

  if (throttled(`${input.kind}:${input.sessionId ?? ''}`, Date.now())) {
    return false
  }

  try {
    const Notifications = await import('expo-notifications')

    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.sessionId ? { storedSessionId: input.sessionId } : {}
      },
      // A bare `null` trigger fires immediately but on no particular
      // channel, so Android falls back to expo-notifications' own
      // "Miscellaneous" channel — the app's own hermes-default channel
      // (importance, sound, badge) is silently ignored. `channelId` is the
      // one field `ChannelAwareTriggerInput` adds over `null`: still fires
      // immediately, just on the right channel.
      trigger: { channelId: ANDROID_NOTIFICATION_CHANNEL_ID }
    })
  } catch {
    // Best-effort: a notification that fails to schedule (permission denied,
    // no native module in this environment) is not worth surfacing as an
    // app-level error — the in-app toast/prompt UI is the primary path.
    return false
  }

  return true
}
