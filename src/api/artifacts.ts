/**
 * Artifact loading + share-sheet plumbing for M10's Artifacts screen.
 * `getSessionMessages` is `GET /api/sessions/{id}/messages`
 * (`hermes_cli/web_routers/sessions.py`), reusing the M09 `rest.ts` pattern;
 * `loadRecentArtifacts` walks the same number of recent sessions the
 * desktop's own Artifacts page scans (`listAllProfileSessions(30, 1)`) and
 * runs `collectArtifactsForSession` (src/lib/artifacts.ts) over each.
 *
 * `shareArtifact` is the exit criterion ("Artifact share opens the system
 * share sheet with the file"): resolve the artifact's bytes — inline for a
 * `data:image/` value, `/api/files/download` for anything else — into a
 * local cache file via `expo-file-system/legacy` (mirrors
 * `src/voice/tts.ts`'s write-then-reference convention), then
 * `expo-sharing`'s `shareAsync`. A bare web link with no local bytes shares
 * as text via React Native's own `Share` API instead — still the system
 * share sheet, just no file underneath.
 *
 * Auth on the download leg: token/OAuth connections carry an `Authorization:
 * Bearer` header, which `FileSystem.downloadAsync` accepts directly. A
 * gated password connection's session lives in a cookie jar that
 * `downloadAsync` (a native download, not the app's `fetch`) does not
 * automatically attach — documented as a known gap in the milestone
 * Deviations rather than plumbed here, since M10's live verification (D12,
 * a throwaway token-mode server) never exercises that leg.
 */

import * as FileSystemLegacy from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Share } from 'react-native'

import type { ArtifactRecord } from '../lib/artifacts'
import { collectArtifactsForSession } from '../lib/artifacts'
import type { SessionMessagesResponse } from '../upstream/types/hermes'

import { requireActiveConnection, restAuthFor, restRequest } from './rest'
import { listSessions } from './sessions'

/** `GET /api/sessions/{id}/messages` — defaults to the latest page (matches
 *  the server's own default: an omitted `limit` loads the newest 500). */
export function getSessionMessages(sessionId: string, profile?: string): Promise<SessionMessagesResponse> {
  return restRequest<SessionMessagesResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, { profile })
}

export interface LoadArtifactsResult {
  artifacts: ArtifactRecord[]
  failedSessions: number
  scannedSessions: number
}

/** Scans the `sessionLimit` most recently active sessions for artifacts,
 *  newest first. Best-effort per session: one unreadable transcript (huge,
 *  archived, permission-scoped) doesn't fail the whole scan. */
export async function loadRecentArtifacts(sessionLimit = 30, profile?: string): Promise<LoadArtifactsResult> {
  const { sessions } = await listSessions({ limit: sessionLimit, order: 'recent', profile })

  const artifacts: ArtifactRecord[] = []
  let failedSessions = 0

  for (const session of sessions) {
    try {
      const { messages } = await getSessionMessages(session.id, profile)

      artifacts.push(...collectArtifactsForSession(session, messages))
    } catch {
      failedSessions += 1
    }
  }

  artifacts.sort((a, b) => b.timestamp - a.timestamp)

  return { artifacts, failedSessions, scannedSessions: sessions.length }
}

/** Absolute `/api/files/download` URL for a server-side path artifact. */
function downloadUrlFor(path: string): string {
  const connection = requireActiveConnection()
  const url = new URL('/api/files/download', connection.baseUrl)

  url.searchParams.set('path', path)

  return url.toString()
}

function extensionFromValue(value: string, fallback: string): string {
  const match = /\.([a-z0-9]{1,8})(?:\?.*)?$/i.exec(value)

  return match ? match[1] : fallback
}

function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')

  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
}

/** Downloads (or decodes) `artifact`'s bytes into the cache dir and returns
 *  the local `file://` uri, or `null` when there are no bytes to fetch (a
 *  bare link) — the caller falls back to a text share in that case. */
async function materializeArtifactFile(artifact: ArtifactRecord): Promise<null | string> {
  const cacheDirectory = FileSystemLegacy.cacheDirectory

  if (!cacheDirectory) {
    throw new Error('No writable cache directory available')
  }

  const destination = `${cacheDirectory}hermes-artifact-${Date.now()}-${extensionFromValue(artifact.label, 'bin')}`

  if (artifact.value.startsWith('data:image/')) {
    await FileSystemLegacy.writeAsStringAsync(destination, base64FromDataUrl(artifact.value), {
      encoding: FileSystemLegacy.EncodingType.Base64
    })

    return destination
  }

  if (artifact.kind === 'link') {
    // A bare web link (no recognized local/server path) — nothing to
    // download; the caller shares the URL as text instead.
    return null
  }

  const sourceUrl = /^https?:\/\//.test(artifact.value) ? artifact.value : downloadUrlFor(artifact.value)
  const headers: Record<string, string> = {}

  if (!/^https?:\/\//.test(artifact.value)) {
    // Only the server-relative (managed-file) leg needs this app's own
    // connection auth — an already-absolute http(s) artifact URL (e.g. a
    // model-generated image hosted elsewhere) carries whatever auth it needs
    // itself.
    const connection = requireActiveConnection()
    const auth = await restAuthFor(connection)

    if (auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }
  }

  const result = await FileSystemLegacy.downloadAsync(sourceUrl, destination, { headers })

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed: HTTP ${result.status}`)
  }

  return result.uri
}

/** Opens the system share sheet for `artifact` — a real file when bytes
 *  could be fetched, plain text (the URL) otherwise. */
export async function shareArtifact(artifact: ArtifactRecord): Promise<void> {
  const localUri = await materializeArtifactFile(artifact)

  if (!localUri) {
    await Share.share({ message: artifact.value })

    return
  }

  const canShare = await Sharing.isAvailableAsync()

  if (!canShare) {
    throw new Error('Sharing is not available on this device')
  }

  await Sharing.shareAsync(localUri)
}
