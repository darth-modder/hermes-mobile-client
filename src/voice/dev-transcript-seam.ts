/**
 * `__DEV__`-only transcript source for device-testing hold-to-dictate
 * (M15 round 9, task 2's plan).
 *
 * Dictation on this project is gateway STT — `recorder.ts` captures m4a and
 * `POST /api/audio/transcribe` turns it into text on the host. The emulator's
 * virtual microphone cannot be fed real speech (M11-push-and-voice.md:384-395:
 * no `adb emu` mic command, no WAV-input flag), so a real recording is silence
 * and the transcript comes back empty — which makes the auto-send half of
 * hold-to-dictate untestable on the emulator through the real path alone.
 *
 * This seam substitutes *only* the value the transcription call would have
 * returned. Permission, native capture and the recorder stop all still run for
 * real; what changes is that the text arriving at `Composer`'s callback is
 * fixed instead of Whisper's. It proves the hold threshold, the release
 * decision, the escape, and that `prompt.submit` reaches the wire with exactly
 * that text. It proves nothing about recognition itself — that stays M11's
 * open item.
 *
 * The gate is here rather than at the caller so no route, screen or future
 * caller can switch it on in a shipped build: `setDevTranscriptOverride` is a
 * no-op unless `__DEV__` is true. The `typeof` check matches
 * `connections/registry.ts:194` — the global is absent under plain Node/vitest.
 */

let override: null | string = null

function devBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__
}

/** Sets (or with `null` clears) the fixed transcript. No-op outside `__DEV__`. */
export function setDevTranscriptOverride(text: null | string): void {
  if (!devBuild()) {
    return
  }

  override = text
}

/** The fixed transcript, or `null` when the real transcription should run. */
export function devTranscriptOverride(): null | string {
  if (!devBuild()) {
    return null
  }

  return override
}
