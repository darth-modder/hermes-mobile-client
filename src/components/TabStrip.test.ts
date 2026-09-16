// M15 round 16, group E task 1: the tab-strip edge race. Round 15's `onEnd`-only guard let a
// single injected swipe advance the active tab by two instead of the one step `SWIPE_THRESHOLD_PX`
// crossed once should produce. These two pure functions are the whole decision — `isInEdgeBand`
// gates whether the gesture should act at all (also enforced structurally by `hitSlop`, TabStrip.tsx),
// `stepFor` is the only place a translation becomes an index delta — so a unit test on them is a
// unit test on the fix itself, not just on the plumbing around it.
import { describe, expect, test } from 'vitest'

import { EDGE_GUARD_PX, isInEdgeBand, stepFor, SWIPE_THRESHOLD_PX } from './tab-strip-gesture'

describe('isInEdgeBand', () => {
  test('a touch starting at x=0 is in the band', () => {
    expect(isInEdgeBand(0)).toBe(true)
  })

  test('a touch starting just under the guard is in the band', () => {
    expect(isInEdgeBand(EDGE_GUARD_PX - 1)).toBe(true)
  })

  test('a touch starting exactly at the guard is not in the band', () => {
    expect(isInEdgeBand(EDGE_GUARD_PX)).toBe(false)
  })

  test('a touch well past the guard is not in the band', () => {
    expect(isInEdgeBand(EDGE_GUARD_PX + 200)).toBe(false)
  })
})

describe('stepFor — at most one tab per gesture, whatever the translation', () => {
  test('a small translation below the threshold does not step', () => {
    expect(stepFor(0)).toBe(0)
    expect(stepFor(SWIPE_THRESHOLD_PX)).toBe(0)
    expect(stepFor(-SWIPE_THRESHOLD_PX)).toBe(0)
  })

  test('a leftward swipe just past the threshold steps forward by exactly one', () => {
    expect(stepFor(-SWIPE_THRESHOLD_PX - 1)).toBe(1)
  })

  test('a rightward swipe just past the threshold steps back by exactly one', () => {
    expect(stepFor(SWIPE_THRESHOLD_PX + 1)).toBe(-1)
  })

  test('a leftward swipe many multiples past the threshold still steps by exactly one', () => {
    expect(stepFor(-SWIPE_THRESHOLD_PX * 10)).toBe(1)
  })

  test('a rightward swipe many multiples past the threshold still steps by exactly one', () => {
    expect(stepFor(SWIPE_THRESHOLD_PX * 10)).toBe(-1)
  })

  test('an extreme translation (a full screen width) still steps by exactly one', () => {
    expect(stepFor(-2400)).toBe(1)
    expect(stepFor(2400)).toBe(-1)
  })
})
