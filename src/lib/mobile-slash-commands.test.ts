import { describe, expect, it } from 'vitest'

import {
  filterSlashPalette,
  isMobileCommandAvailable,
  mobileCommandArgumentMode,
  mobileCommandSurface
} from './mobile-slash-commands'

describe('mobileCommandSurface', () => {
  it('routes a mobile-fulfilled command to its dedicated RPC', () => {
    expect(mobileCommandSurface('/stop')).toEqual({ kind: 'rpc', rpc: 'session.interrupt' })
    expect(mobileCommandSurface('/compress')).toEqual({ kind: 'rpc', rpc: 'session.compress' })
    expect(mobileCommandSurface('/title')).toEqual({ kind: 'rpc', rpc: 'session.title' })
    expect(mobileCommandSurface('/btw')).toEqual({ kind: 'rpc', rpc: 'prompt.btw' })
  })

  it('resolves an alias to its canonical command', () => {
    expect(mobileCommandSurface('/compact')).toEqual({ kind: 'rpc', rpc: 'session.compress' })
  })

  it('is case-insensitive and tolerates a missing leading slash', () => {
    expect(mobileCommandSurface('STOP')).toEqual({ kind: 'rpc', rpc: 'session.interrupt' })
    expect(mobileCommandSurface('Compress')).toEqual({ kind: 'rpc', rpc: 'session.compress' })
  })

  it('marks a terminal-only command unavailable', () => {
    expect(mobileCommandSurface('/mouse')).toEqual({ kind: 'unavailable', reason: 'terminal' })
  })

  it('marks the approval-card commands unavailable as messaging', () => {
    expect(mobileCommandSurface('/approve')).toEqual({ kind: 'unavailable', reason: 'messaging' })
    expect(mobileCommandSurface('/deny')).toEqual({ kind: 'unavailable', reason: 'messaging' })
  })

  it('marks a desktop-picker command unavailable as no-mobile-ui', () => {
    expect(mobileCommandSurface('/model')).toEqual({ kind: 'unavailable', reason: 'no-mobile-ui' })
    expect(mobileCommandSurface('/resume')).toEqual({ kind: 'unavailable', reason: 'no-mobile-ui' })
  })

  it('falls through to exec for a command it does not special-case (skills, quick commands, plugins)', () => {
    expect(mobileCommandSurface('/some-skill')).toEqual({ kind: 'exec' })
  })
})

describe('mobileCommandArgumentMode', () => {
  it('reports text mode for commands that take free-form arguments', () => {
    expect(mobileCommandArgumentMode('/title')).toBe('text')
    expect(mobileCommandArgumentMode('/btw')).toBe('text')
  })

  it('is undefined for a command with no argument-mode hint', () => {
    expect(mobileCommandArgumentMode('/stop')).toBeUndefined()
  })
})

describe('isMobileCommandAvailable', () => {
  it('is false for anything classified unavailable, true otherwise', () => {
    expect(isMobileCommandAvailable('/mouse')).toBe(false)
    expect(isMobileCommandAvailable('/stop')).toBe(true)
    expect(isMobileCommandAvailable('/some-skill')).toBe(true)
  })
})

describe('filterSlashPalette', () => {
  it('drops pane-only rows but always keeps skills', () => {
    const rows = filterSlashPalette([
      { display: '/mouse', kind: 'command', meta: '', text: '/mouse' },
      { display: '/stop', kind: 'command', meta: '', text: '/stop' },
      { display: '/deploy', kind: 'skill', meta: '', text: '/deploy' }
    ])

    expect(rows.map(row => row.text)).toEqual(['/stop', '/deploy'])
  })
})
