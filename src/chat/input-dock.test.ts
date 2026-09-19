import { describe, expect, it } from 'vitest'

import { DOCK_HEIGHT_FRACTION, dockedCardOrder } from './input-dock'

describe('dockedCardOrder', () => {
  it('returns nothing when no request is pending', () => {
    expect(dockedCardOrder({ approval: false, clarify: false, secret: false, sudo: false })).toEqual([])
  })

  it('returns the one pending kind', () => {
    expect(dockedCardOrder({ approval: true, clarify: false, secret: false, sudo: false })).toEqual(['approval'])
    expect(dockedCardOrder({ approval: false, clarify: true, secret: false, sudo: false })).toEqual(['clarify'])
  })

  it('orders multiple pending requests as secret, sudo, approval, clarify — D25.4', () => {
    expect(dockedCardOrder({ approval: true, clarify: true, secret: true, sudo: true })).toEqual([
      'secret',
      'sudo',
      'approval',
      'clarify'
    ])
    expect(dockedCardOrder({ approval: true, clarify: false, secret: false, sudo: true })).toEqual(['sudo', 'approval'])
  })
})

describe('DOCK_HEIGHT_FRACTION', () => {
  it('caps the dock at about half the window height — D25.3', () => {
    expect(DOCK_HEIGHT_FRACTION).toBe(0.5)
  })
})
