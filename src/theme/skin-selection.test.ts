import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same react-native-mmkv mock as src/lib/storage.test.ts / backend-skin.test.ts.
const backing = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => backing.get(key),
    set: (key: string, value: string) => {
      backing.set(key, value)
    },
    remove: (key: string) => backing.delete(key)
  })
}))

const { $modeOverride, $skinName, listAllSkins, resolveEffectiveMode, resolveSkinTheme, setModeOverride, setSkinName } =
  await import('./skin-selection')

const { BUILTIN_THEME_LIST, nousTheme } = await import('../upstream/themes/presets')

describe('resolveSkinTheme', () => {
  it('picks a built-in by name', () => {
    expect(resolveSkinTheme('ember', {}).name).toBe('ember')
  })

  it('falls back to a backend-pushed skin when not a built-in', () => {
    const custom = { ...nousTheme, name: 'custom' }

    expect(resolveSkinTheme('custom', { custom })).toBe(custom)
  })

  it('falls back to nous for an unknown name', () => {
    expect(resolveSkinTheme('does-not-exist', {})).toBe(nousTheme)
  })
})

describe('resolveEffectiveMode', () => {
  it('an explicit override wins regardless of the system scheme', () => {
    expect(resolveEffectiveMode('dark', 'light')).toBe('dark')
    expect(resolveEffectiveMode('light', 'dark')).toBe('light')
  })

  it('"system" follows the device scheme', () => {
    expect(resolveEffectiveMode('system', 'dark')).toBe('dark')
    expect(resolveEffectiveMode('system', 'light')).toBe('light')
  })

  it('"system" with no reported scheme (or "unspecified") defaults to light', () => {
    expect(resolveEffectiveMode('system', null)).toBe('light')
    expect(resolveEffectiveMode('system', undefined)).toBe('light')
    expect(resolveEffectiveMode('system', 'unspecified')).toBe('light')
  })
})

describe('listAllSkins', () => {
  it('lists every built-in plus any backend-pushed skins', () => {
    const custom = { ...nousTheme, name: 'custom' }
    const all = listAllSkins({ custom })

    expect(all).toHaveLength(BUILTIN_THEME_LIST.length + 1)
    expect(all).toContainEqual(custom)
  })
})

describe('persisted skin + mode', () => {
  beforeEach(() => {
    backing.clear()
  })

  it('setSkinName updates the store and persists', () => {
    setSkinName('ember')
    expect($skinName.get()).toBe('ember')
    expect(backing.get('theme.skin-name')).toBe('ember')
  })

  it('setModeOverride persists an explicit choice and clears the key for "system"', () => {
    setModeOverride('dark')
    expect($modeOverride.get()).toBe('dark')
    expect(backing.get('theme.mode-override')).toBe('dark')

    setModeOverride('system')
    expect($modeOverride.get()).toBe('system')
    expect(backing.has('theme.mode-override')).toBe(false)
  })
})
