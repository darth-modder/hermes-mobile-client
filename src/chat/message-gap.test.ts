import { describe, expect, it } from 'vitest'

import { messageGap } from './message-gap'

describe('messageGap', () => {
  it('is null at the top of the thread (no older message)', () => {
    expect(messageGap({ role: 'user' }, undefined)).toBeNull()
  })

  it('is "turn" when the role changes from the older message (opens a turn)', () => {
    expect(messageGap({ role: 'assistant' }, { role: 'user' })).toBe('turn')
    expect(messageGap({ role: 'user' }, { role: 'assistant' })).toBe('turn')
  })

  it('is "block" for consecutive same-role messages (inside one turn)', () => {
    expect(messageGap({ role: 'assistant' }, { role: 'assistant' })).toBe('block')
    expect(messageGap({ role: 'user' }, { role: 'user' })).toBe('block')
  })
})
