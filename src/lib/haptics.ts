// M13 Step 6/D: expo-haptics wiring for send, approve, reject and errors
// (docs/PARITY.md's "Haptics and sound" gap — the reducer's `haptic`/`sound`
// effects were accepted and ignored since M06, no dependency pulled in yet).
// `sound` stays a no-op: the desktop's own notification chimes have no asset
// this app ships, and nothing in the plan calls for adding one.
//
// Best-effort: a haptic failing (emulator with no vibration motor, a device
// with haptics disabled in system settings) must never surface as an error
// or block the action it's confirming.

import * as Haptics from 'expo-haptics'

function fireAndForget(promise: Promise<void>): void {
  promise.catch(() => undefined)
}

/** A message send/submit landed — light tap. */
export function hapticSubmit(): void {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** The assistant's reply started streaming (reducer effect, `session-stream/
 *  message-stream.ts`). */
export function hapticStreamStart(): void {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** An approval/clarify/sudo/secret choice that grants (once/session/always,
 *  or a submitted value). */
export function hapticApprove(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

/** A deny/reject/skip choice. */
export function hapticReject(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
}

/** Any error notification (wired once, in src/store/notifications.ts, so
 *  every `notify({ kind: 'error', ... })` call site gets this for free). */
export function hapticError(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
}
