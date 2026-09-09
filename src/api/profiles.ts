/**
 * `/api/profiles*` REST helpers — ported from `apps/desktop/src/api/profiles.ts`
 * onto `src/net/http.ts` (see `rest.ts`). Backs the "profiles" settings
 * screen: list / create / rename / delete. Soul editing and archive
 * export/import (`getProfileSoul`, `updateProfileSoul`,
 * `getProfileSetupCommand`, `exportProfileArchive`, `importProfileArchive`)
 * are not ported — no named M09 sub-screen covers them and none is a
 * profile-*switching* exit criterion; noted in the milestone Deviations.
 */

import type { ProfileCreatePayload, ProfilesResponse } from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getProfiles(): Promise<ProfilesResponse> {
  return restRequest<ProfilesResponse>('/api/profiles')
}

export function createProfile(body: ProfileCreatePayload): Promise<{ name: string; ok: boolean; path: string }> {
  return restRequest<{ name: string; ok: boolean; path: string }>('/api/profiles', { body, method: 'POST' })
}

export function renameProfile(name: string, newName: string): Promise<{ name: string; ok: boolean; path: string }> {
  return restRequest<{ name: string; ok: boolean; path: string }>(`/api/profiles/${encodeURIComponent(name)}`, {
    body: { new_name: newName },
    method: 'PATCH'
  })
}

export function deleteProfile(name: string): Promise<{ ok: boolean; path: string }> {
  const normalized = name.trim()

  if (!normalized) {
    return Promise.reject(new Error('Profile name required'))
  }

  if (normalized.toLowerCase() === 'default') {
    return Promise.reject(new Error('The default profile cannot be deleted.'))
  }

  return restRequest<{ ok: boolean; path: string }>(`/api/profiles/${encodeURIComponent(normalized)}`, {
    method: 'DELETE'
  })
}
