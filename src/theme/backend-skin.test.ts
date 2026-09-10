import { beforeEach, describe, expect, it, vi } from 'vitest'

// react-native-mmkv wraps a native binding that doesn't exist under vitest
// (Node) — same mock as src/lib/storage.test.ts.
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

const { $backendSkins, $pendingSkinApply, __resetBackendSkinSync, ingestBackendSkin, skinToDesktopTheme } =
  await import('./backend-skin')

const CUSTOM_SKIN = {
  name: 'my-custom-skin',
  colors: {
    background: '#101014',
    ui_text: '#e8e8ec',
    ui_accent: '#7c5cff',
    ui_error: '#ff5c5c'
  }
}

describe('skinToDesktopTheme', () => {
  it('returns null for a skin with no name or no colors', () => {
    expect(skinToDesktopTheme({})).toBeNull()
    expect(skinToDesktopTheme({ name: 'x' })).toBeNull()
    expect(skinToDesktopTheme({ name: '', colors: { background: '#000000' } })).toBeNull()
  })

  it('converts a minimal skin into a usable DesktopTheme', () => {
    const theme = skinToDesktopTheme(CUSTOM_SKIN)

    expect(theme).not.toBeNull()
    expect(theme?.name).toBe('my-custom-skin')
    expect(theme?.label).toBe('My-custom-skin')
    expect(theme?.colors.background).toBe('#101014')
    expect(theme?.colors.foreground).toBe('#e8e8ec')
    // colors and darkColors are the same single-mode palette (a skin is one-mode).
    expect(theme?.darkColors).toEqual(theme?.colors)
  })
})

describe('ingestBackendSkin', () => {
  beforeEach(() => {
    backing.clear()
    __resetBackendSkinSync()
  })

  it('seeding (apply: false) records the baseline without requesting a repaint', () => {
    ingestBackendSkin(CUSTOM_SKIN, { apply: false })

    expect($pendingSkinApply.get()).toBeNull()
    // Still registers the converted theme so it's available immediately.
    expect($backendSkins.get()['my-custom-skin']).toBeDefined()
  })

  it('apply: true on a name change requests a repaint', () => {
    ingestBackendSkin(CUSTOM_SKIN, { apply: true })

    expect($pendingSkinApply.get()).toBe('my-custom-skin')
  })

  it('a repeat apply of the same already-applied name is a no-op', () => {
    ingestBackendSkin(CUSTOM_SKIN, { apply: true })
    expect($pendingSkinApply.get()).toBe('my-custom-skin')

    $pendingSkinApply.set(null) // provider drains it
    ingestBackendSkin(CUSTOM_SKIN, { apply: true })

    expect($pendingSkinApply.get()).toBeNull()
  })

  it('a seed-only baseline still applies on the first genuine skin.changed', () => {
    ingestBackendSkin(CUSTOM_SKIN, { apply: false })
    expect($pendingSkinApply.get()).toBeNull()

    ingestBackendSkin(CUSTOM_SKIN, { apply: true })
    expect($pendingSkinApply.get()).toBe('my-custom-skin')
  })

  it('a built-in name is a valid apply target but is never registered as a custom theme', () => {
    ingestBackendSkin({ name: 'ember' }, { apply: true })

    expect($pendingSkinApply.get()).toBe('ember')
    expect($backendSkins.get().ember).toBeUndefined()
  })

  it('"default" applies as the mobile client\'s own default skin name', () => {
    ingestBackendSkin({ name: 'default' }, { apply: true })

    expect($pendingSkinApply.get()).toBe('nous')
  })

  it('an unnamed skin is ignored entirely', () => {
    ingestBackendSkin({}, { apply: true })
    ingestBackendSkin(null, { apply: true })
    ingestBackendSkin(undefined, { apply: true })

    expect($pendingSkinApply.get()).toBeNull()
    expect($backendSkins.get()).toEqual({})
  })
})
