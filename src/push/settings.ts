/** Whether this device should be registered for remote push at all — a separate switch from
 *  `native-notifications.ts`'s local-notification kind prefs. Defaults on, mirroring that
 *  module's own default. Turning it off unregisters the device (see usePushRegistration.ts)
 *  rather than merely skipping future registration, so a backend never keeps pushing to a
 *  device the user explicitly opted out on. */

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '../lib/storage'

const STORAGE_KEY = 'hermes:push-enabled'

export const $pushEnabled = atom<boolean>(storedBoolean(STORAGE_KEY, true))

export function setPushEnabled(enabled: boolean): void {
  $pushEnabled.set(enabled)
  persistBoolean(STORAGE_KEY, enabled)
}
