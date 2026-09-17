import { afterEach, describe, expect, it } from 'vitest'

import { devRoutesEnabled, isDevBuild } from './dev-build'

// `__DEV__` is genuinely absent under vitest (Node, no Metro), which is the
// case worth pinning: a bare `__DEV__` reference would throw a ReferenceError
// rather than read as falsy, so the `typeof` half of the guard is load-bearing
// and not defensive noise. `globalThis` is typed loosely here because the
// global is declared as a `const boolean` by react-native's types — assigning
// to it is exactly what production code must never do, and only a test has any
// business faking it.
const globals = globalThis as Record<string, unknown>

afterEach(() => {
  delete globals.__DEV__
})

describe('isDevBuild', () => {
  it('is false when __DEV__ is not defined at all (plain Node, and any bundler that drops it)', () => {
    expect('__DEV__' in globals).toBe(false)
    expect(isDevBuild()).toBe(false)
  })

  it('is false in a release build, where __DEV__ is defined as false', () => {
    globals.__DEV__ = false

    expect(isDevBuild()).toBe(false)
  })

  it('is true in a development build', () => {
    globals.__DEV__ = true

    expect(isDevBuild()).toBe(true)
  })
})

describe('devRoutesEnabled — the app/dev/_layout.tsx gate', () => {
  it('blocks app/dev/* when __DEV__ is absent', () => {
    expect(devRoutesEnabled()).toBe(false)
  })

  it('blocks app/dev/* in a release build', () => {
    globals.__DEV__ = false

    expect(devRoutesEnabled()).toBe(false)
  })

  it('allows app/dev/* in a development build', () => {
    globals.__DEV__ = true

    expect(devRoutesEnabled()).toBe(true)
  })

  it('tracks isDevBuild exactly, so the two can never disagree', () => {
    for (const value of [undefined, false, true]) {
      if (value === undefined) {
        delete globals.__DEV__
      } else {
        globals.__DEV__ = value
      }

      expect(devRoutesEnabled()).toBe(isDevBuild())
    }
  })
})
