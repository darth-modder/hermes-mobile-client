import { describe, expect, it } from 'vitest'

import { compactNumber } from './format'

// Ported verbatim from apps/desktop/src/lib/format.ts — same boundary cases
// its own header comment names.
describe('compactNumber', () => {
  it('formats small values as-is', () => {
    expect(compactNumber(0)).toBe('0')
    expect(compactNumber(999)).toBe('999')
  })

  it('formats thousands with one decimal, dropping a trailing .0', () => {
    expect(compactNumber(1000)).toBe('1k')
    expect(compactNumber(1230)).toBe('1.2k')
    expect(compactNumber(10000)).toBe('10k')
  })

  it('formats millions the same way', () => {
    expect(compactNumber(1_500_000)).toBe('1.5M')
  })

  it('promotes right at the boundary instead of showing "1000k"/"1000"', () => {
    expect(compactNumber(999_950)).toBe('1M')
    expect(compactNumber(999.5)).toBe('1k')
  })

  it('treats null/undefined/negative/non-finite as 0', () => {
    expect(compactNumber(null)).toBe('0')
    expect(compactNumber(undefined)).toBe('0')
    expect(compactNumber(-5)).toBe('0')
    expect(compactNumber(Number.NaN)).toBe('0')
  })
})
