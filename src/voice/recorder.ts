/**
 * Voice input: `expo-audio` records m4a, then `transcribeAudio` (api.ts) turns it into text
 * for the composer. `expo-audio` is imported dynamically so this module stays importable
 * (and its exported functions callable in a plain vitest run) without the native module
 * present — same reasoning as `native-notifications.ts`'s `expo-notifications` import.
 *
 * Base64 data-url encoding follows `src/lib/attachments.ts`'s existing convention
 * (`expo-file-system/legacy`'s `readAsStringAsync` + `EncodingType.Base64`) rather than the
 * newer `File` API, since nothing else in this repo uses that yet.
 */

import * as FileSystemLegacy from 'expo-file-system/legacy'

import { transcribeAudio } from './api'

const RECORDING_MIME_TYPE = 'audio/m4a'

// Module-level, not component state: recording spans a mic-button press/release in the
// Composer, which shouldn't be tied to any one component's lifecycle (a screen re-render or
// remount mid-recording must not drop the in-progress `AudioRecorder`).

let activeRecorder: any = null

export function isRecording(): boolean {
  return activeRecorder !== null
}

/** Requests mic permission (if not already granted) and starts recording. Throws if
 *  permission is denied or a recording is already in progress. */
export async function startRecording(): Promise<void> {
  if (activeRecorder) {
    throw new Error('Already recording')
  }

  const Audio = await import('expo-audio')

  const permission = await Audio.getRecordingPermissionsAsync()

  if (permission.status !== 'granted') {
    const requested = await Audio.requestRecordingPermissionsAsync()

    if (requested.status !== 'granted') {
      throw new Error('Microphone permission denied')
    }
  }

  await Audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })

  const recorder = new Audio.AudioRecorder(Audio.RecordingPresets.HIGH_QUALITY)

  await recorder.prepareToRecordAsync()
  recorder.record()
  activeRecorder = recorder
}

/** Stops recording without transcribing — the user cancelled. Safe to call when nothing is
 *  recording (no-op). */
export async function cancelRecording(): Promise<void> {
  if (!activeRecorder) {
    return
  }

  const recorder = activeRecorder

  activeRecorder = null
  await recorder.stop().catch(() => undefined)
}

export interface TranscribeResult {
  provider?: string
  transcript: string
}

/** Stops recording and sends the clip to `/api/audio/transcribe`. Throws if nothing is
 *  recording, the recording produced no file, or the transcription request fails. */
export async function stopRecordingAndTranscribe(): Promise<TranscribeResult> {
  if (!activeRecorder) {
    throw new Error('Not recording')
  }

  const recorder = activeRecorder

  activeRecorder = null
  await recorder.stop()

  const uri: null | string = recorder.uri

  if (!uri) {
    throw new Error('Recording produced no file')
  }

  const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: FileSystemLegacy.EncodingType.Base64 })
  const dataUrl = `data:${RECORDING_MIME_TYPE};base64,${base64}`

  const result = await transcribeAudio(dataUrl, RECORDING_MIME_TYPE)

  return { provider: result.provider, transcript: result.transcript }
}
