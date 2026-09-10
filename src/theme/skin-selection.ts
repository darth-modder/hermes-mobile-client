// Which skin is selected and which mode it renders in — the pure, storage-
// backed half of src/theme/provider.tsx, split out so it's importable (and
// testable) without pulling in React/react-native. See provider.tsx's header
// for why this codebase has no `.tsx` component tests: everything that can
// be pure logic lives in a plain `.ts` module, same as the gateway reducers.

import { atom } from 'nanostores'

import { persistString, storedString } from '../lib/storage'
import { BUILTIN_THEME_LIST, BUILTIN_THEMES, DEFAULT_SKIN_NAME, nousTheme } from '../upstream/themes/presets'
import type { DesktopTheme } from '../upstream/themes/types'

import type { ThemeMode } from './resolve'

export type ModeOverride = 'dark' | 'light' | 'system'

const SKIN_KEY = 'theme.skin-name'
const MODE_KEY = 'theme.mode-override'

function loadPersistedSkinName(): string {
  return storedString(SKIN_KEY) ?? DEFAULT_SKIN_NAME
}

function loadPersistedModeOverride(): ModeOverride {
  const raw = storedString(MODE_KEY)

  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

/** The user's current skin pick — a local choice OR the last name `skin.changed` applied. */
export const $skinName = atom<string>(loadPersistedSkinName())

/** 'system' (default) tracks the device; 'light'/'dark' is a Settings override. */
export const $modeOverride = atom<ModeOverride>(loadPersistedModeOverride())

export function setSkinName(name: string): void {
  $skinName.set(name)
  persistString(SKIN_KEY, name)
}

export function setModeOverride(mode: ModeOverride): void {
  $modeOverride.set(mode)
  persistString(MODE_KEY, mode === 'system' ? null : mode)
}

/** Built-in first (hand-ported palette), then a backend-pushed custom skin, then nous. */
export function resolveSkinTheme(name: string, backendSkins: Record<string, DesktopTheme>): DesktopTheme {
  return BUILTIN_THEMES[name] ?? backendSkins[name] ?? nousTheme
}

/** Device scheme + persisted override -> the mode actually rendered. */
export function resolveEffectiveMode(override: ModeOverride, systemScheme: string | null | undefined): ThemeMode {
  if (override === 'light' || override === 'dark') {
    return override
  }

  return systemScheme === 'dark' ? 'dark' : 'light'
}

/** Every skin the appearance screen should list: the eleven built-ins plus any backend-pushed ones. */
export function listAllSkins(backendSkins: Record<string, DesktopTheme>): DesktopTheme[] {
  return [...BUILTIN_THEME_LIST, ...Object.values(backendSkins)]
}
