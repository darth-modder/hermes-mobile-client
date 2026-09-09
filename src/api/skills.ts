/**
 * `/api/skills*` REST helpers — ported from `apps/desktop/src/api/skills.ts`
 * onto `src/net/http.ts` (see `rest.ts`). Backs the "skills" settings screen:
 * the installed list, per-skill enable toggle (exit criterion: "skill toggle
 * persists"), and the built-in optional-skills catalog's install/uninstall.
 * Hub search/preview/scan/update-all and the star-map/learning-node surface
 * are not ported — no named M09 sub-screen covers them; noted in the
 * milestone Deviations.
 */

import type { ActionResponse, OfficialSkillInfo, SkillInfo } from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getSkills(profile?: string): Promise<SkillInfo[]> {
  return restRequest<SkillInfo[]>('/api/skills', { profile })
}

/** Raw SKILL.md text (frontmatter included) for any skill — bundled, hub, or
 *  learned. */
export function getSkillContent(
  name: string,
  profile?: string
): Promise<{ content: string; name: string; path: string }> {
  return restRequest<{ content: string; name: string; path: string }>(
    `/api/skills/content?name=${encodeURIComponent(name)}`,
    { profile }
  )
}

export function setSkillEnabled(
  name: string,
  enabled: boolean,
  profile?: string
): Promise<{ enabled: boolean; name: string; ok: boolean }> {
  return restRequest<{ enabled: boolean; name: string; ok: boolean }>('/api/skills/toggle', {
    body: { enabled, name },
    method: 'PUT',
    profile
  })
}

/** The full built-in optional-skills catalog (fast — a local checkout scan),
 *  with per-profile installed flags. */
export function getOfficialSkills(profile?: string): Promise<{ skills: OfficialSkillInfo[] }> {
  return restRequest<{ skills: OfficialSkillInfo[] }>('/api/skills/hub/official', { profile })
}

export function installSkillFromHub(identifier: string, profile?: string): Promise<ActionResponse> {
  return restRequest<ActionResponse>('/api/skills/hub/install', { body: { identifier }, method: 'POST', profile })
}

export function uninstallSkillFromHub(name: string, profile?: string): Promise<ActionResponse> {
  return restRequest<ActionResponse>('/api/skills/hub/uninstall', { body: { name }, method: 'POST', profile })
}
