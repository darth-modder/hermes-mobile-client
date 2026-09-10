/**
 * Hermes skin -> DesktopTheme converter, and the "fold a live skin sync into
 * local state" logic that drives it — ported from
 * `apps/desktop/src/themes/skin.ts` (`skinToDesktopTheme`) and
 * `apps/desktop/src/themes/backend-sync.ts` (`ingestBackendSkin`,
 * `$backendThemes`, `$pendingSkinApply`). Neither desktop file is on the sync
 * allow-list (only `types`/`color`/`retint`/`presets` are, D14), so this is a
 * port, not an import — built from the vendored `color.ts` helpers and the
 * vendored `HermesSkin`/`SkinColors` types (`src/upstream/shared/skin.ts`,
 * already vendored since M02), the same way the desktop's own converter is.
 *
 * A "skin" is the CLI/TUI theme unit: a YAML file in `$HERMES_HOME/skins/`
 * (or a built-in) resolved by `hermes_cli/skin_engine.py` and pushed to every
 * surface over JSON-RPC (`gateway.ready`, `skin.changed`, `config.get skin`).
 * Skins carry terminal-oriented keys; this seeds the mobile model from the
 * load-bearing few (background, foreground, accent, error) and derives every
 * other surface by mixing toward bg/fg, same as the desktop's "naive token
 * converter" strategy.
 */

import { atom } from 'nanostores'

import { readJson, writeJson } from '../lib/storage'
import type { HermesSkin, SkinColors } from '../upstream/shared/skin'
import { ensureContrast, luminance, mix, normalizeHex, readableOn } from '../upstream/themes/color'
import { BUILTIN_THEMES, DEFAULT_SKIN_NAME } from '../upstream/themes/presets'
import { type DesktopTheme, type DesktopThemeColors, isValidTheme } from '../upstream/themes/types'

const ACCENT_MIN_CONTRAST = 4.5

/** First normalizable hex among `keys`, alpha flattened over `backdrop`. */
function pick(colors: SkinColors, keys: string[], backdrop: string): string | null {
  for (const key of keys) {
    const value = normalizeHex(colors[key], backdrop)

    if (value) {
      return value
    }
  }

  return null
}

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Convert a resolved skin into a `DesktopTheme`, or null when it carries no
 * usable colours (a broken/empty skin never registers junk). Mirrors
 * `skinToDesktopTheme` in `apps/desktop/src/themes/skin.ts` line for line.
 */
export function skinToDesktopTheme(skin: HermesSkin): DesktopTheme | null {
  const name = (skin.name ?? '').trim()
  const colors = skin.colors

  if (!name || !colors || typeof colors !== 'object') {
    return null
  }

  const seededBg = pick(colors, ['background', 'status_bar_bg'], '#000000')
  const foregroundSeed = pick(colors, ['ui_text', 'banner_text', 'status_bar_text'], seededBg ?? '#000000')

  const background = seededBg ?? (foregroundSeed && luminance(foregroundSeed) > 0.5 ? '#141414' : '#f7f7f8')
  const dark = luminance(background) < 0.4
  const foreground = foregroundSeed ?? (dark ? '#e6e6e6' : '#161616')

  const accentSeed =
    pick(colors, ['ui_accent', 'banner_accent', 'banner_title'], background) ?? mix(foreground, background, 0.55)

  const sidebar = mix(background, foreground, dark ? 0.02 : 0.012)
  const accent = ensureContrast(accentSeed, sidebar, ACCENT_MIN_CONTRAST)

  const border =
    pick(colors, ['ui_border', 'banner_border'], background) ?? mix(background, foreground, dark ? 0.16 : 0.14)

  const mutedForeground =
    pick(colors, ['banner_dim', 'session_border'], background) ?? mix(foreground, background, 0.45)

  const destructive = pick(colors, ['ui_error'], background) ?? '#e25563'

  const palette: DesktopThemeColors = {
    background,
    foreground,
    card: mix(background, foreground, dark ? 0.04 : 0.025),
    cardForeground: foreground,
    muted: mix(background, foreground, dark ? 0.06 : 0.04),
    mutedForeground,
    popover: mix(background, foreground, dark ? 0.08 : 0.05),
    popoverForeground: foreground,
    primary: accent,
    primaryForeground: readableOn(accent),
    secondary: mix(accent, background, dark ? 0.72 : 0.86),
    secondaryForeground: foreground,
    accent: mix(accent, background, dark ? 0.82 : 0.88),
    accentForeground: foreground,
    border,
    input: pick(colors, ['completion_menu_bg'], background) ?? mix(background, foreground, dark ? 0.1 : 0.06),
    ring: accent,
    midground: accent,
    midgroundForeground: readableOn(accent),
    composerRing: accent,
    destructive,
    destructiveForeground: readableOn(destructive),
    sidebarBackground: sidebar,
    sidebarBorder: border,
    userBubble: mix(background, accent, dark ? 0.18 : 0.12),
    userBubbleBorder: border
  }

  return {
    name,
    label: titleCase(name),
    description: 'Hermes skin',
    colors: palette,
    darkColors: palette
  }
}

// ─── Live sync (ported from backend-sync.ts, MMKV instead of localStorage) ──

const BACKEND_SKINS_KEY = 'theme.backend-skins-v1'

function readCachedBackendSkins(): Record<string, DesktopTheme> {
  const stored = readJson<Record<string, unknown>>(BACKEND_SKINS_KEY) ?? {}

  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, DesktopTheme] => !BUILTIN_THEMES[entry[0]] && isValidTheme(entry[1])
    )
  )
}

/** Skins pushed by the backend, keyed by name. Merged into the appearance screen's list. */
export const $backendSkins = atom<Record<string, DesktopTheme>>(readCachedBackendSkins())

$backendSkins.listen(skins => writeJson(BACKEND_SKINS_KEY, skins))

/** One-shot skin name the provider should switch to (it clears this after applying). */
export const $pendingSkinApply = atom<string | null>(null)

let lastSynced: { applied: boolean; name: string } | null = null

/** Test-only: reset the module's apply guard + registry between cases. */
export function __resetBackendSkinSync(): void {
  lastSynced = null
  $backendSkins.set({})
  $pendingSkinApply.set(null)
}

/**
 * Fold a resolved skin into local state. `apply: false` (connect-time seed,
 * `gateway.ready`) only records the baseline so a fresh connect never stomps
 * a persisted user pick; `apply: true` (`skin.changed`) repaints on a name
 * change. Built-in names keep the mobile client's own hand-ported palette
 * but can still be applied. Mirrors `ingestBackendSkin` in
 * `apps/desktop/src/themes/backend-sync.ts`.
 */
export function ingestBackendSkin(skin: HermesSkin | null | undefined, { apply }: { apply: boolean }): void {
  const rawName = (skin && typeof skin === 'object' ? (skin.name ?? '') : '').trim()

  if (!rawName) {
    return
  }

  if (rawName !== 'default' && !BUILTIN_THEMES[rawName]) {
    const theme = skinToDesktopTheme(skin as HermesSkin)

    if (!theme) {
      return
    }

    const current = $backendSkins.get()

    if (JSON.stringify(current[rawName]) !== JSON.stringify(theme)) {
      $backendSkins.set({ ...current, [rawName]: theme })
    }
  }

  // `default` is "no opinion" on the palette: the mobile client keeps its
  // own default (nous), same as the desktop.
  const name = rawName === 'default' ? DEFAULT_SKIN_NAME : rawName

  if (!apply) {
    if (lastSynced?.name !== name || !lastSynced.applied) {
      lastSynced = { applied: false, name }
    }

    return
  }

  if (name !== lastSynced?.name || !lastSynced.applied) {
    lastSynced = { applied: true, name }
    $pendingSkinApply.set(name)
  }
}
