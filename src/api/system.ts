/**
 * `/api/audio/elevenlabs/voices`, `/api/audio/tts-lease` — a deliberately
 * narrow port of `apps/desktop/src/api/system.ts` onto `src/net/http.ts`
 * (see `rest.ts`). Everything else in the upstream file is out of scope for
 * M09:
 *
 * - `runDoctor`/`runSecurityAudit`/`runBackup`/`runDebugShare`,
 *   `updateHermes`/`checkHermesUpdate`/`restartGateway` are exactly the
 *   "updates" AGENTS.md names under "Machine features don't exist here" —
 *   backend bootstrap/update is a machine-bound concern this app never
 *   surfaces, on the phone OR by remote-control of the server host.
 * - `getMemoryStatus`/`resetMemory`/`getCuratorStatus`/`setCuratorPaused`/
 *   `runCurator`/`getMemoryProviderConfig`/`saveMemoryProviderConfig`/
 *   `startMemoryProviderOAuth`/`getMemoryProviderOAuthStatus` and
 *   `getGhAuthStatus`/`getActionStatus` have no named M09 sub-screen — none
 *   of "providers, models, mcp, skills, plugins, profiles, connections,
 *   notifications, voice" is a memory or curator screen.
 * - `transcribeAudio`/`speakText`/their timeout formulas already exist as
 *   `src/voice/api.ts` (M11) — porting them again here would just be a
 *   second copy of the same two endpoints.
 *
 * What's left — TTS voice listing and the lease warm-up call — extends the
 * "voice" settings screen M11 already built (`app/(main)/settings/voice.tsx`).
 */

import type { AudioTtsLeaseResponse, ElevenLabsVoicesResponse } from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getElevenLabsVoices(profile?: string): Promise<ElevenLabsVoicesResponse> {
  return restRequest<ElevenLabsVoicesResponse>('/api/audio/elevenlabs/voices', { profile })
}

/**
 * Tell the backend a speech-output toggle flipped so it can warm the TTS
 * engine (`active: true`) or release it once no surface needs it
 * (`active: false`). `lease` names the toggle — this app uses
 * `"android:composer"` for the composer's speaker button.
 */
export function setTtsLease(lease: string, active: boolean): Promise<AudioTtsLeaseResponse> {
  return restRequest<AudioTtsLeaseResponse>('/api/audio/tts-lease', {
    body: { active, lease },
    method: 'POST',
    // Acquiring a lease pre-loads the configured TTS engine — a model load
    // and, on a fresh install, a voice download — well past the 15s default.
    timeoutMs: 180_000
  })
}
