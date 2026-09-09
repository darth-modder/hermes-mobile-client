/**
 * `/api/audio/*` REST calls (upstream `hermes_cli/web_routers/audio.py`) — same auth-branch
 * pattern as `src/api/sessions.ts` and `src/push/api.ts`.
 *
 * Timeout formulas ported from `apps/desktop/src/api/system.ts`
 * (`audioTranscribeRequestTimeoutMs`, `audioSpeakRequestTimeoutMs`): both endpoints block on
 * provider round-trips (STT/TTS) plus file/base64 handling, which regularly exceeds
 * `src/net/http.ts`'s 15s default — a multi-minute recording or a long reply would otherwise
 * abort mid-request. Scaled by payload size so a short clip still fails fast.
 */

import { getActiveConnection } from '../connections/registry'
import { getConnectionOAuth, getConnectionToken } from '../connections/secure'
import { httpRequest, type HttpRequestOptions } from '../net/http'
import type { AudioSpeakResponse, AudioTranscriptionResponse } from '../upstream/types/hermes'

const AUDIO_TRANSCRIBE_MIN_REQUEST_TIMEOUT_MS = 180_000
const AUDIO_TRANSCRIBE_MAX_REQUEST_TIMEOUT_MS = 600_000
const AUDIO_TRANSCRIBE_TIMEOUT_MS_PER_CHAR = 0.1

const AUDIO_SPEAK_MIN_REQUEST_TIMEOUT_MS = 180_000
const AUDIO_SPEAK_MAX_REQUEST_TIMEOUT_MS = 600_000
const AUDIO_SPEAK_TIMEOUT_MS_PER_CHAR = 35

export function audioTranscribeRequestTimeoutMs(dataUrl: string): number {
  const estimated = Math.max(
    AUDIO_TRANSCRIBE_MIN_REQUEST_TIMEOUT_MS,
    Math.ceil(dataUrl.length * AUDIO_TRANSCRIBE_TIMEOUT_MS_PER_CHAR)
  )

  return Math.min(AUDIO_TRANSCRIBE_MAX_REQUEST_TIMEOUT_MS, estimated)
}

export function audioSpeakRequestTimeoutMs(text: string): number {
  const estimated = Math.max(
    AUDIO_SPEAK_MIN_REQUEST_TIMEOUT_MS,
    Math.ceil(text.length * AUDIO_SPEAK_TIMEOUT_MS_PER_CHAR)
  )

  return Math.min(AUDIO_SPEAK_MAX_REQUEST_TIMEOUT_MS, estimated)
}

async function restAuth(): Promise<Pick<HttpRequestOptions, 'credentials' | 'token'>> {
  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  if (connection.authMode === 'token') {
    const token = await getConnectionToken(connection.id)

    return { token: token ?? undefined }
  }

  if (connection.authMode === 'oauth') {
    const oauth = await getConnectionOAuth(connection.id)

    return { token: oauth?.accessToken }
  }

  return { credentials: 'include' }
}

/** `POST /api/audio/transcribe`. `dataUrl` is `data:<mime>;base64,<...>`. */
export async function transcribeAudio(dataUrl: string, mimeType: string): Promise<AudioTranscriptionResponse> {
  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  const auth = await restAuth()

  return httpRequest<AudioTranscriptionResponse>(connection.baseUrl, '/api/audio/transcribe', {
    ...auth,
    body: { data_url: dataUrl, mime_type: mimeType },
    method: 'POST',
    timeoutMs: audioTranscribeRequestTimeoutMs(dataUrl)
  })
}

/** `POST /api/audio/speak` — returns synthesized audio as a base64 data URL. */
export async function speakText(text: string): Promise<AudioSpeakResponse> {
  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  const auth = await restAuth()

  return httpRequest<AudioSpeakResponse>(connection.baseUrl, '/api/audio/speak', {
    ...auth,
    body: { text },
    method: 'POST',
    timeoutMs: audioSpeakRequestTimeoutMs(text)
  })
}
