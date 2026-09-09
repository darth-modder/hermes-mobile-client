/**
 * Pure guard for whether a dictation result (or its transcription error) recorded for one
 * session should still be applied — extracted from Composer.tsx for the bug fixed in 8f89171.
 *
 * Composer is a single persistent instance reused across session switches (its
 * `storedSessionId` prop changes rather than the component remounting — see the effect that
 * resets `text`/`attachments` on that change). `stopRecordingAndTranscribe()` clears the
 * recorder before its network round-trip even starts, so `isRecording()` alone can't tell,
 * once that round trip resolves, whether the user has since switched to a different session.
 * The pre-fix code had no check at all: `if (transcript) { setText(...) }` unconditionally,
 * so a transcript recorded for session A could land in session B's composer if the user
 * switched during the network wait.
 */

export function shouldApplyDictationResult(recordedForSessionId: string, currentSessionId: string): boolean {
  return recordedForSessionId === currentSessionId
}
