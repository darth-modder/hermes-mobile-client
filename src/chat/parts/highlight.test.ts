import { describe, expect, it } from 'vitest'

import { highlightCode } from './highlight'

describe('highlightCode', () => {
  it('tokenizes a known language into classed runs', () => {
    const tokens = highlightCode('const x = 1', 'javascript')

    expect(tokens.length).toBeGreaterThan(1)
    expect(tokens.some(t => t.className.includes('hljs-keyword'))).toBe(true)
    expect(tokens.map(t => t.text).join('')).toBe('const x = 1')
  })

  it('falls back to one plain run for an unknown language', () => {
    expect(highlightCode('whatever', 'not-a-real-language')).toEqual([{ className: [], text: 'whatever' }])
  })

  it('falls back to one plain run when no language is given', () => {
    expect(highlightCode('whatever', undefined)).toEqual([{ className: [], text: 'whatever' }])
  })
})
