/**
 * Voice output: `POST /api/audio/speak` (api.ts) returns synthesized audio as a base64 data
 * URL; per the M11 task line this gets written to a temp file and played from there, rather
 * than handed to the player as a raw `data:` URI (matches `src/lib/attachments.ts`'s own
 * write-then-reference convention for the same base64-over-REST shape).
 */

import * as FileSystemLegacy from 'expo-file-system/legacy'

import { speakText } from './api'
import { base64FromDataUrl, extensionForMime } from './audio-format'

let activePlayer: any = null
let activeFilePath: null | string = null

/** Stops and releases whatever this module last started playing, if anything, and deletes its
 *  temp file — otherwise every `speak()` call leaves a `hermes-tts-*` file behind permanently
 *  (nothing else in this module ever cleaned them up). Safe to call with nothing playing
 *  (no-op). The player is released before the delete, so this never removes a file still
 *  backing an active player. */
export function stopSpeaking(): void {
  if (activePlayer) {
    activePlayer.remove()
    activePlayer = null
  }

  if (activeFilePath) {
    const path = activeFilePath

    activeFilePath = null
    FileSystemLegacy.deleteAsync(path, { idempotent: true }).catch(() => undefined)
  }
}

/** Synthesizes `text` server-side and plays the reply. Throws if the backend request fails;
 *  swallows a failure to remove the previous player (best-effort cleanup). */
export async function speak(text: string): Promise<void> {
  const result = await speakText(text)

  const cacheDirectory = FileSystemLegacy.cacheDirectory

  if (!cacheDirectory) {
    throw new Error('No writable cache directory available')
  }

  const path = `${cacheDirectory}hermes-tts-${Date.now()}.${extensionForMime(result.mime_type)}`

  await FileSystemLegacy.writeAsStringAsync(path, base64FromDataUrl(result.data_url), {
    encoding: FileSystemLegacy.EncodingType.Base64
  })

  stopSpeaking()

  const Audio = await import('expo-audio')

  const player = Audio.createAudioPlayer(path)

  activePlayer = player
  activeFilePath = path
  player.play()
}
