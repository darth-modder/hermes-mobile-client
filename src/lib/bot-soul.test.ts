import { describe, expect, it } from 'vitest'

import { botHandle, ensureMessagingProtocol, hasMessagingProtocol, messagingProtocolSection } from './bot-soul'

describe('botHandle (data.ts:957-963 port)', () => {
  it('remaps the primary profile name to "hermes"', () => {
    expect(botHandle('default')).toBe('hermes')
    expect(botHandle('DEFAULT')).toBe('hermes')
  })

  it('leaves every other name unchanged', () => {
    expect(botHandle('researcher')).toBe('researcher')
  })
})

describe('hasMessagingProtocol (soul.ts:68-73 port)', () => {
  it('detects the section heading', () => {
    expect(hasMessagingProtocol('# Bot\n\n## Messaging other agents\n\nblah')).toBe(true)
  })

  it('is false for a soul with no such section', () => {
    expect(hasMessagingProtocol('# Bot\n\nJust a persona.')).toBe(false)
    expect(hasMessagingProtocol(null)).toBe(false)
    expect(hasMessagingProtocol(undefined)).toBe(false)
  })
})

describe('messagingProtocolSection (soul.ts:16-65 port)', () => {
  it('lists teammates excluding the bot itself', () => {
    const section = messagingProtocolSection('researcher', [
      { description: 'Code review bot', name: 'coder' },
      { description: 'Deep research bot', name: 'researcher' }
    ])

    expect(section).toContain('- `coder` — Code review bot')
    expect(section).not.toContain('- `researcher`')
  })

  it('says "(none yet)" with no teammates', () => {
    const section = messagingProtocolSection('researcher', [])

    expect(section).toContain('- (none yet)')
  })

  it('uses the handle remap in the command block and prefix', () => {
    const section = messagingProtocolSection('default', [])

    expect(section).toContain('Message from 🤖 hermes (@hermes)')
    expect(section).not.toContain('@default')
  })
})

describe('ensureMessagingProtocol (soul.ts:79-93 port)', () => {
  it('appends the section to a soul that lacks it, when the backend does not inject it', () => {
    const result = ensureMessagingProtocol('# Researcher\n\nBe thorough.', 'researcher', [], false)

    expect(result).toContain('# Researcher')
    expect(result).toContain('## Messaging other agents')
  })

  it('is a no-op when the backend injects the protocol (bot_mode_protocol: true)', () => {
    const result = ensureMessagingProtocol('# Researcher\n\nBe thorough.', 'researcher', [], true)

    expect(result).toBe('# Researcher\n\nBe thorough.')
    expect(result).not.toContain('Messaging other agents')
  })

  it('never duplicates an existing section, even when botModeProtocol is false', () => {
    const withSection = '# Researcher\n\n## Messaging other agents\n\nalready here'
    const result = ensureMessagingProtocol(withSection, 'researcher', [], false)

    expect(result).toBe(withSection)
  })

  it('handles an empty soul (a brand-new bot with no custom identity text)', () => {
    const result = ensureMessagingProtocol('', 'researcher', [], false)

    expect(result).toBe(messagingProtocolSection('researcher', []))
  })
})
