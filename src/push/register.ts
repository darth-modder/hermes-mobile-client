/**
 * Pure state/gating for Expo push registration — kept framework-free (no `expo-notifications`
 * or `expo-constants` import) so it's testable under plain vitest, mirroring the
 * native-notifications.ts / useNotifications.ts split elsewhere in `src/push`. The actual
 * native wiring (permission, `getExpoPushTokenAsync`, rotation listener) lives in
 * `usePushRegistration.ts`.
 */

import { readJson, writeJson } from '../lib/storage'

const STORAGE_KEY = 'hermes:push-registration'

export interface PushRegistrationState {
  deviceId: null | string
  token: null | string
}

const EMPTY_STATE: PushRegistrationState = { deviceId: null, token: null }

export function readPushRegistration(): PushRegistrationState {
  return readJson<PushRegistrationState>(STORAGE_KEY) ?? EMPTY_STATE
}

export function writePushRegistration(state: PushRegistrationState): void {
  writeJson(STORAGE_KEY, state)
}

export function clearPushRegistration(): void {
  writeJson(STORAGE_KEY, null)
}

/**
 * `extra.eas.projectId` from `app.config.ts`, as read off whatever object
 * `Constants.expoConfig?.extra` hands back — kept generic (not an `expo-constants` import) so
 * this stays testable without the native module present. Absent until the user runs
 * `eas init` and commits the resulting id (D11: only the user creates the Expo
 * account/project — Sonnet gates on its absence rather than creating one). Every caller must
 * treat a null result as "push registration is disabled here", never as an error.
 */
export function pushProjectId(expoConfigExtra: unknown): null | string {
  if (!expoConfigExtra || typeof expoConfigExtra !== 'object') {
    return null
  }

  const eas = (expoConfigExtra as Record<string, unknown>).eas

  if (!eas || typeof eas !== 'object') {
    return null
  }

  const projectId = (eas as Record<string, unknown>).projectId

  return typeof projectId === 'string' && projectId ? projectId : null
}

/** Whether a freshly-fetched Expo push token needs to be (re-)sent to the backend — a new
 *  token, or no device id on file yet (first registration, or a prior unregister). */
export function needsReRegistration(state: PushRegistrationState, freshToken: string): boolean {
  return state.token !== freshToken || !state.deviceId
}
