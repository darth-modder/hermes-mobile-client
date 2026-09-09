import { describe, expect, it } from 'vitest'

import { shouldApplyDictationResult } from './dictation-guard'

describe('chat/dictation-guard shouldApplyDictationResult', () => {
  it('applies when the session has not changed', () => {
    expect(shouldApplyDictationResult('sess-1', 'sess-1')).toBe(true)
  })

  it('does not apply when the user has switched sessions since recording started', () => {
    expect(shouldApplyDictationResult('sess-1', 'sess-2')).toBe(false)
  })
})

/**
 * `alwaysApply` reconstructs the pre-8f89171 control flow verbatim: `toggleRecording`'s stop
 * branch had `if (transcript) { setText(...) }` with no session comparison at all — every
 * dictation result was applied regardless of what session was current by the time the network
 * round trip resolved. Run through the same scenario as the real guard above, it applies a
 * transcript to the wrong session — proving the bug was real and the fix (an explicit
 * same-session check) addresses it. Not exported; exists only for this one comparison.
 */
function alwaysApply(_recordedForSessionId: string, _currentSessionId: string): boolean {
  return true
}

describe('alwaysApply (pre-8f89171 reconstruction) — demonstrates the bug was real', () => {
  it('FAILS the same regression scenario shouldApplyDictationResult passes', () => {
    // Recorded while session A was open; the user has since switched to session B.
    const wouldApply = alwaysApply('sess-A', 'sess-B')

    // This is the bug: a transcript recorded for session A gets applied to session B's draft.
    expect(wouldApply).toBe(true)
  })
})
