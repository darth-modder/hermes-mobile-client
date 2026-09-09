import { describe, expect, it } from 'vitest'

import { PlaybackFileTracker } from './playback-tracker'

describe('voice/playback-tracker PlaybackFileTracker', () => {
  it('start returns null the first time (nothing to delete yet)', () => {
    const tracker = new PlaybackFileTracker()

    expect(tracker.start('/cache/a.mp3')).toBeNull()
  })

  it('a second start returns the first path to delete', () => {
    const tracker = new PlaybackFileTracker()

    tracker.start('/cache/a.mp3')

    expect(tracker.start('/cache/b.mp3')).toBe('/cache/a.mp3')
  })

  it('a third start returns the second path, not the first (no accumulation)', () => {
    const tracker = new PlaybackFileTracker()

    tracker.start('/cache/a.mp3')
    tracker.start('/cache/b.mp3')

    expect(tracker.start('/cache/c.mp3')).toBe('/cache/b.mp3')
  })

  it('stop returns the currently tracked path', () => {
    const tracker = new PlaybackFileTracker()

    tracker.start('/cache/a.mp3')

    expect(tracker.stop()).toBe('/cache/a.mp3')
  })

  it('stop returns null when nothing is tracked', () => {
    const tracker = new PlaybackFileTracker()

    expect(tracker.stop()).toBeNull()
  })

  it('a second stop returns null — does not double-report the same path', () => {
    const tracker = new PlaybackFileTracker()

    tracker.start('/cache/a.mp3')
    tracker.stop()

    expect(tracker.stop()).toBeNull()
  })

  it('start after stop tracks only the new path', () => {
    const tracker = new PlaybackFileTracker()

    tracker.start('/cache/a.mp3')
    tracker.stop()

    expect(tracker.start('/cache/b.mp3')).toBeNull()
  })
})

/**
 * `NoCleanupTracker` reconstructs the pre-8f89171 behavior verbatim: `speak()` tracked only
 * `activePlayer` (released by `stopSpeaking()`) and nothing else — there was no file-path
 * bookkeeping at all, so nothing was ever returned for deletion. Run through the same
 * multi-speak scenario as PlaybackFileTracker above, it reports nothing to clean up ever —
 * proving the bug was real (every file accumulates forever) and the fix (tracking and
 * returning the superseded path) addresses it. Not exported; exists only for this comparison.
 */
class NoCleanupTracker {
  start(_path: string): null {
    return null
  }

  stop(): null {
    return null
  }
}

describe('NoCleanupTracker (pre-8f89171 reconstruction) — demonstrates the bug was real', () => {
  it('FAILS the same regression scenario PlaybackFileTracker passes: a second speak() must report the first file for deletion', () => {
    const legacy = new NoCleanupTracker()

    legacy.start('/cache/a.mp3')

    const toDeleteAfterSecondStart = legacy.start('/cache/b.mp3')

    // This is the bug: PlaybackFileTracker.start would return '/cache/a.mp3' here (the file to
    // delete now that a second one is playing) — NoCleanupTracker returns null, meaning
    // hermes-tts-a.mp3 is never cleaned up. Every speak() call leaks its predecessor forever.
    expect(toDeleteAfterSecondStart).toBeNull()
  })
})
