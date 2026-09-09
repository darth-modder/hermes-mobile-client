/**
 * The active Hermes profile (M09 task: "Profile switching scopes REST
 * (`?profile=`) and `session.create.profile`"). Empty string means "the
 * connection's default profile" — matches `src/api/profiles.ts`'s own
 * "default" convention and keeps `?profile=` un-set for the common
 * single-profile case (see `src/net/http.ts`: `options.profile` is only
 * appended when truthy).
 *
 * Scoped per connection, not global: switching connections (M09's
 * connections screen) resets this back to "default" — a profile name from
 * one backend has no meaning on another.
 */

import { atom } from 'nanostores'

import { persistString, storedString } from '../lib/storage'

const STORAGE_KEY = 'hermes:active-profile'

export const $activeProfile = atom<string>(storedString(STORAGE_KEY) ?? '')

/** `undefined` (not `''`) for "no override" — the shape every `src/api/*.ts`
 *  helper's optional `profile?: string` parameter expects. */
export function getActiveProfile(): string | undefined {
  const value = $activeProfile.get()

  return value || undefined
}

export function setActiveProfile(name: string): void {
  const normalized = name.trim()

  $activeProfile.set(normalized)
  persistString(STORAGE_KEY, normalized || null)
}
