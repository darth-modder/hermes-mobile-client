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
import { Platform } from 'react-native'

import { transcribeAudio } from './api'

const RECORDING_MIME_TYPE = 'audio/m4a'

// Module-level, not component state: recording spans a mic-button press/release in the
// Composer, which shouldn't be tied to any one component's lifecycle (a screen re-render or
// remount mid-recording must not drop the in-progress `AudioRecorder`).

let activeRecorder: any = null

export function isRecording(): boolean {
  return activeRecorder !== null
}

/**
 * `expo-audio`'s own `useAudioRecorder` hook (not used here — this module is deliberately
 * hook-free so start/stop can be called from plain event handlers) does two things this direct
 * construction must replicate:
 *
 * 1. The constructible `AudioRecorder` class lives at `AudioModule.AudioRecorder` — `AudioModule`
 *    is the native module's default export, re-exported as a value from `expo-audio`'s index.
 *    `index.d.ts` re-exports `AudioModule.types` with `export type *`, so `AudioRecorder` is
 *    visible to TypeScript at the top level but does not actually exist there at runtime; found
 *    live, on-device (`Could not start recording — undefined cannot be used as a constructor`).
 * 2. `RecordingPresets.HIGH_QUALITY` nests platform-specific overrides under `.android`/`.ios`
 *    (e.g. `android: { outputFormat: 'mpeg4', audioEncoder: 'aac' }`) that the hook flattens
 *    onto the top-level options object before construction (`createRecordingOptions`, not part
 *    of the package's public API, so reimplemented here rather than reached into
 *    `expo-audio/build/utils/options`) — passing the preset as-is would silently drop them.
 */
function platformRecordingOptions(preset: Record<string, unknown>): Record<string, unknown> {
  const common = {
    bitRate: preset.bitRate,
    extension: preset.extension,
    isMeteringEnabled: preset.isMeteringEnabled ?? false,
    numberOfChannels: preset.numberOfChannels,
    sampleRate: preset.sampleRate
  }

  if (Platform.OS === 'android') {
    return { ...common, directory: preset.directory, ...(preset.android as object | undefined) }
  }

  if (Platform.OS === 'ios') {
    return { ...common, directory: preset.directory, ...(preset.ios as object | undefined) }
  }

  return { ...common, ...(preset.web as object | undefined) }
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

  const options = platformRecordingOptions(Audio.RecordingPresets.HIGH_QUALITY as unknown as Record<string, unknown>)
  const recorder = new Audio.AudioModule.AudioRecorder(options)

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
