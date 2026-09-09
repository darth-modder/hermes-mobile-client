/**
 * Pure bookkeeping for the "at most one active TTS file at a time" invariant — extracted from
 * tts.ts for the bug fixed in 8f89171: every `speak()` call wrote a new
 * `hermes-tts-<timestamp>.<ext>` file to the cache directory and nothing ever deleted it
 * (`stopSpeaking()` only released the `AudioPlayer`), so a long session using the speaker
 * button repeatedly leaked one file per call, forever.
 *
 * Kept free of any filesystem/`expo-audio` import so the "what should get deleted, and when"
 * decision is testable without touching the real filesystem — tts.ts calls
 * `FileSystemLegacy.deleteAsync` with whatever this returns.
 */

export class PlaybackFileTracker {
  private currentPath: null | string = null

  /** Call right before starting playback of `path`. Returns the previous path to delete, if
   *  any (null the first time, or if nothing was tracked) — the caller deletes it only after
   *  releasing whatever player was using it. */
  start(path: string): null | string {
    const previous = this.currentPath

    this.currentPath = path

    return previous
  }

  /** Call when playback stops with nothing new starting. Returns the path to delete, if any,
   *  and clears tracking so a second call returns null instead of double-deleting. */
  stop(): null | string {
    const previous = this.currentPath

    this.currentPath = null

    return previous
  }
}
