/**
 * "Ask in context, ask once" gate for the OS notification-permission
 * prompt. Previously requested unconditionally at app-mount
 * (useNotifications.ts), before a gateway was even connected and before
 * the app could produce a single notification — a screen the user hasn't
 * done anything on yet, which is exactly what Play's own guidance says not
 * to do.
 *
 * Moved here and called from session-connection.ts's `submitPrompt`, at the
 * first turn any session starts. That is the earliest point a background
 * approval/input notification could ever become relevant
 * (native-notifications.ts's `shouldFire`/`ATTENTION_KINDS`: a notification
 * only fires once a request is blocking a session that is backgrounded or
 * not the one on screen, both of which require a turn to already be
 * running) — and, unlike that later moment, it happens while the app is
 * still in the foreground, which is the only time Android will actually
 * show the system dialog at all.
 *
 * `hasRequestedNotificationPermission` is persisted separately from
 * `$nativeNotifyPrefs`/`$pushEnabled` (both app-level preferences, on by
 * default) because "have we ever asked the OS" is a different fact from
 * either. Android itself stops showing its own dialog after two declines
 * regardless of what this app does, so calling `requestPermissionsAsync`
 * a third time is a silent no-op from the OS's side, not a re-ask — this
 * flag exists so the app doesn't even try, and so it never asks twice from
 * two different turns racing at startup.
 */
import { persistBoolean, storedBoolean } from '../lib/storage'

const ASKED_KEY = 'hermes:notification-permission-asked'

export function hasRequestedNotificationPermission(): boolean {
  return storedBoolean(ASKED_KEY, false)
}

function markRequested(): void {
  persistBoolean(ASKED_KEY, true)
}

export interface NotificationPermissionStatus {
  canAskAgain: boolean
  status: 'denied' | 'granted' | 'undetermined'
}

/** Live OS permission state, for Settings to reflect reality. Never marks
 *  the "have we asked" flag — a read, not a request. */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const Notifications = await import('expo-notifications')
  const { canAskAgain, status } = await Notifications.getPermissionsAsync()

  return { canAskAgain, status }
}

/** The Settings screen's own explicit "Enable notifications" action — the
 *  user asking again is itself a fresh context, so this always calls
 *  through to the OS (Android still enforces its own two-decline cutoff;
 *  this function does not track or limit that itself). */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  markRequested()

  const Notifications = await import('expo-notifications')
  const { canAskAgain, status } = await Notifications.requestPermissionsAsync()

  return { canAskAgain, status }
}

/**
 * Fire-and-forget from the first `prompt.submit` of any session. No-ops
 * immediately (no import, no native call) once already asked. Best-effort
 * on failure, matching `native-notifications.ts`'s own dispatch catch: a
 * permission prompt that can't run (no native module present, e.g. under
 * test) is not worth surfacing as an app-level error.
 */
export async function ensureNotificationPermissionRequested(): Promise<void> {
  if (hasRequestedNotificationPermission()) {
    return
  }

  markRequested()

  try {
    const Notifications = await import('expo-notifications')
    const { status } = await Notifications.getPermissionsAsync()

    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync()
    }
  } catch {
    // Best-effort — see file header.
  }
}
