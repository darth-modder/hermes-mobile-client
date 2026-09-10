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

  it('marks a machine-bound command unavailable (AGENTS.md: pet overlay, embedded browser, the server-side mic)', () => {
    expect(mobileCommandSurface('/pet')).toEqual({ kind: 'unavailable', reason: 'machine-bound' })
    expect(mobileCommandSurface('/browser')).toEqual({ kind: 'unavailable', reason: 'machine-bound' })
    expect(mobileCommandSurface('/wake')).toEqual({ kind: 'unavailable', reason: 'machine-bound' })
  })

  it('marks a command with no mobile screen to route to unavailable as no-mobile-ui', () => {
    expect(mobileCommandSurface('/branch')).toEqual({ kind: 'unavailable', reason: 'no-mobile-ui' })
    expect(mobileCommandSurface('/memory-graph')).toEqual({ kind: 'unavailable', reason: 'no-mobile-ui' })
  })

  it('falls through to exec for a command it does not special-case (skills, quick commands, plugins)', () => {
    expect(mobileCommandSurface('/some-skill')).toEqual({ kind: 'exec' })
  })

  // M13 Step 8 (task D): one test per command routed to a screen that now exists.
  it('routes /new (and its alias /reset) to a fresh session draft', () => {
    const expected = { kind: 'navigate', route: { params: { id: 'new' }, pathname: '/(main)/sessions/[id]' } }

    expect(mobileCommandSurface('/new')).toEqual(expected)
    expect(mobileCommandSurface('/reset')).toEqual(expected)
  })

  it('routes /resume, /sessions and /switch to the session list (the picker surface all three alias to on desktop)', () => {
    const expected = { kind: 'navigate', route: '/(main)/session-list' }

    expect(mobileCommandSurface('/resume')).toEqual(expected)
    expect(mobileCommandSurface('/sessions')).toEqual(expected)
    expect(mobileCommandSurface('/switch')).toEqual(expected)
  })

  it('routes /model to Settings > Models', () => {
    expect(mobileCommandSurface('/model')).toEqual({ kind: 'navigate', route: '/(main)/settings/models' })
  })

  it('routes /profile to Settings > Profiles', () => {
    expect(mobileCommandSurface('/profile')).toEqual({ kind: 'navigate', route: '/(main)/settings/profiles' })
  })

  it('routes /skills to Settings > Skills', () => {
    expect(mobileCommandSurface('/skills')).toEqual({ kind: 'navigate', route: '/(main)/settings/skills' })
  })

  it('routes /skin to the appearance screen (not in the task list, but M13 built exactly this screen)', () => {
    expect(mobileCommandSurface('/skin')).toEqual({ kind: 'navigate', route: '/(main)/settings/appearance' })
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
