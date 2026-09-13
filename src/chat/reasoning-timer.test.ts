import { describe, expect, it } from 'vitest'

import { formatElapsed, thoughtLabel } from './reasoning-timer'

// M14 close-out round 3, task 1: the four-state label, unit-tested directly
// as a pure function. `useElapsedSeconds`/`useMeasuredDuration` (the timer
// plumbing thoughtLabel's caller feeds it from) are NOT unit-tested here —
// this project's vitest config only stubs react-native (src/test/
// react-native-stub.ts, exports Platform/NativeModules/AppState only) and has
// no React test renderer, the same pre-existing limitation labels.test.ts's
// own header documents for .tsx component tests generally. Verified instead
// on-device: a live turn, leave-and-re-enter, and a cold relaunch (see the
// M14 doc's task 1 entry for pasted labels and dp dumps from each).
describe('formatElapsed', () => {
  it('renders sub-minute durations as seconds', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(5)).toBe('5s')
    expect(formatElapsed(59)).toBe('59s')
  })

  it('renders minute-plus durations as m:ss', () => {
    expect(formatElapsed(60)).toBe('1:00')
    expect(formatElapsed(65)).toBe('1:05')
    expect(formatElapsed(125)).toBe('2:05')
  })
})

describe('thoughtLabel', () => {
  it('reads "Thinking" while still streaming, regardless of any measured duration', () => {
    expect(thoughtLabel(true, null)).toBe('Thinking')
    expect(thoughtLabel(true, 12)).toBe('Thinking')
  })

  it('reads "Thought" when finished with no measured duration (never watched running)', () => {
    expect(thoughtLabel(false, null)).toBe('Thought')
  })

  it('reads "Thought briefly" when finished in under 1 second', () => {
    expect(thoughtLabel(false, 0)).toBe('Thought briefly')
  })

  it('reads "Thought for {duration}" otherwise', () => {
    expect(thoughtLabel(false, 1)).toBe('Thought for 1s')
    expect(thoughtLabel(false, 47)).toBe('Thought for 47s')
    expect(thoughtLabel(false, 125)).toBe('Thought for 2:05')
  })
})
