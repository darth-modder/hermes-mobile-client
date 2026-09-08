import { describe, expect, it } from 'vitest'

import { splitMarkdownBlocks } from './markdown-blocks'

describe('splitMarkdownBlocks', () => {
  it('splits on blank lines', () => {
    expect(splitMarkdownBlocks('first\n\nsecond\n\nthird')).toEqual(['first\n', 'second\n', 'third'])
  })

  it('never splits inside a fenced code block, even one containing a blank line', () => {
    const text = 'before\n\n```js\nconst x = 1\n\nconst y = 2\n```\n\nafter'
    const blocks = splitMarkdownBlocks(text)

    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toContain('const x = 1')
    expect(blocks[1]).toContain('const y = 2')
    expect(blocks[1].trim().startsWith('```js')).toBe(true)
  })

  it('drops blank-only segments', () => {
    expect(splitMarkdownBlocks('a\n\n\n\nb')).toEqual(['a\n', 'b'])
  })

  it('returns the whole text as one block when there are no blank lines', () => {
    expect(splitMarkdownBlocks('just one paragraph')).toEqual(['just one paragraph'])
  })

  it('returns an empty array for empty input', () => {
    expect(splitMarkdownBlocks('')).toEqual([])
  })
})
