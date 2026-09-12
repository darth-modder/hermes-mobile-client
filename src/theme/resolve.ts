/**
 * Ports the desktop's skin -> pixels pipeline (M13 Appendix A) into a single
 * pure function. The desktop never paints a preset colour directly:
 * `apps/desktop/src/themes/context.tsx` (`applyTheme`) writes the preset's
 * colours as CSS custom-property seeds, and `apps/desktop/src/styles.css`
 * derives every surface the app actually paints from those seeds with
 * `color-mix()`. This file reproduces that derivation in JS so the mobile
 * client can compute the same surfaces without a CSS engine.
 *
 * Every formula below is Appendix A of
 * `project-planning/implementation-plan/M13-design-parity-and-usability.md`,
 * which is itself a transcription of `context.tsx:201-285` and
 * `styles.css:184-445`. Follow the appendix's token table (A.5) literally
 * rather than re-deriving from `context.tsx`'s inline `style.setProperty`
 * calls — see the Deviations section of the M13 plan for why the two don't
 * agree on a few fields (`border`, `destructive`, `composerRing` among them)
 * and why A.5 wins.
 */

import { ensureContrast, mix as hexMix, hexToRgb, readableOn } from '../upstream/themes/color'
import type { DesktopTheme, DesktopThemeColors } from '../upstream/themes/types'

export type ThemeMode = 'light' | 'dark'

export interface MobileTokens {
  background: string
  foreground: string
  card: string
  cardForeground: string
  muted: string
  mutedForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  primarySolid: string
  primarySolidForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  /** The stroke-mix formula (A.4), kept under its own name for the surfaces
   *  that use it directly on the desktop: sidebar edge, composer ring,
   *  hairlines. `border`/`input`/`ring` above are the skin's solid palette
   *  values instead (D15.1a) — `applyTheme` overwrites them post-mix. */
  strokePrimary: string
  strokeSecondary: string
  strokeTertiary: string
  strokeQuaternary: string
  midground: string
  midgroundForeground: string
  composerRing: string
  destructive: string
  destructiveForeground: string
  sidebar: string
  sidebarBorder: string
  userBubble: string
  userBubbleBorder: string
  widgetSurface: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textQuaternary: string
  scaffoldText: string
  scaffoldMeta: string
  inlineCodeBackground: string
  inlineCodeForeground: string
  diffAddBackground: string
  diffAddForeground: string
  diffRemoveBackground: string
  diffRemoveForeground: string
  rowHover: string
  rowActive: string
  controlHover: string
  controlActive: string
  /** M14: the accent-over-base fill family (`--ui-bg-primary`…`-quinary`,
   *  A.4) and `--ui-bg-card`, exposed for the new `src/components/ui/*`
   *  primitives (secondary button fill, badges, search field, avatar,
   *  skeleton, card) — computed since M13 but not previously returned. */
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgQuaternary: string
  bgQuinary: string
  bgCard: string
  semantic: {
    red: string
    orange: string
    yellow: string
    green: string
    cyan: string
    blue: string
    purple: string
  }
}

// ─── A.3: color-mix(in srgb, A p%, B) semantics ────────────────────────────

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 }

function hexToRgba(hex: string): Rgba {
  const rgb = hexToRgb(hex)

  if (!rgb) {
    // Vendored `hexToRgb` only accepts 6-digit hex. Every seed on a
    // DesktopTheme is one; an unparseable seed is a themes/presets.ts bug,
    // not something to paper over here.
    throw new Error(`resolveMobileTheme: not a 6-digit hex colour: ${hex}`)
  }

  return { r: rgb[0], g: rgb[1], b: rgb[2], a: 1 }
}

/**
 * `color-mix(in srgb, a p%, b (1-p)%)`: per-channel linear interpolation in
 * sRGB (no gamma step), with the result alpha and colour channels weighted by
 * each input's own alpha (premultiplied) — so `mix(X, transparent, 0.94)` is
 * `X` at alpha 0.94, not `X` faded toward black.
 */
function mix(a: Rgba, b: Rgba, p: number): Rgba {
  const aWeight = a.a * p
  const bWeight = b.a * (1 - p)
  const outAlpha = aWeight + bWeight

  if (outAlpha <= 0) {
    return TRANSPARENT
  }

  return {
    r: (a.r * aWeight + b.r * bWeight) / outAlpha,
    g: (a.g * aWeight + b.g * bWeight) / outAlpha,
    b: (a.b * aWeight + b.b * bWeight) / outAlpha,
    a: outAlpha
  }
}

function clampChannel(n: number): number {
  return Math.round(Math.min(255, Math.max(0, n)))
}

function toHexByte(n: number): string {
  return clampChannel(n).toString(16).padStart(2, '0')
}

/** Opaque results format as `#rrggbb`; translucent ones as `rgba(r, g, b, a)`. */
function fmt(c: Rgba): string {
  const a = Math.round(c.a * 10000) / 10000

  if (a >= 0.9995) {
    return `#${toHexByte(c.r)}${toHexByte(c.g)}${toHexByte(c.b)}`
  }

  return `rgba(${clampChannel(c.r)}, ${clampChannel(c.g)}, ${clampChannel(c.b)}, ${a})`
}

// ─── A.2: per-mode constants ────────────────────────────────────────────────

const MODE_CONSTANTS: Record<
  ThemeMode,
  {
    neutralChrome: string
    neutralSidebar: string
    neutralCard: string
    mixChrome: number
    mixSidebar: number
    mixCard: number
    mixElevated: number
    mixBubble: number
    uiRed: string
    uiGreen: string
    uiCyan: string
  }
> = {
  light: {
    neutralChrome: '#f3f3f3',
    neutralSidebar: '#f3f3f3',
    neutralCard: '#fcfcfc',
    mixChrome: 0.92,
    mixSidebar: 1.0,
    mixCard: 0.22,
    mixElevated: 0.28,
    mixBubble: 0.0,
    uiRed: '#cf2d56',
    uiGreen: '#1f8a65',
    uiCyan: '#4c7f8c'
  },
  dark: {
    neutralChrome: '#0d0d0e',
    neutralSidebar: '#0a0a0b',
    neutralCard: '#161618',
    mixChrome: 0.74,
    mixSidebar: 1.0,
    mixCard: 0.38,
    mixElevated: 0.46,
    mixBubble: 0.46,
    uiRed: '#e75e78',
    uiGreen: '#55a583',
    uiCyan: '#6f9ba6'
  }
}

// Mode-independent (A.2's last row).
const UI_ORANGE = '#db704b'
const UI_YELLOW = '#c08532'
const UI_BLUE = '#0053fd'
const UI_PURPLE = '#9e94d5'

// ─── dark-palette fallback for dark-only presets (midnight, ember, mono, ────
// cyberpunk, slate ship no `darkColors`; `colors` IS their dark palette). ────
// Ported from `context.tsx`'s `synthLightColors` — not itself vendored,
// since only types/color/retint/presets are on the sync allow-list (D14).

function synthLightColors(seed: DesktopThemeColors): DesktopThemeColors {
  const accent = seed.ring || seed.primary
  const soft = hexMix('#ffffff', accent, 0.1)
  const softer = hexMix('#ffffff', accent, 0.06)
  const border = hexMix('#ececef', accent, 0.14)
  const midground = seed.midground ?? accent

  return {
    background: '#ffffff',
    foreground: '#161616',
    card: '#ffffff',
    cardForeground: '#161616',
    muted: softer,
    mutedForeground: hexMix('#6b6b70', accent, 0.16),
    popover: '#ffffff',
    popoverForeground: '#161616',
    primary: accent,
    primaryForeground: readableOn(accent),
    secondary: soft,
    secondaryForeground: hexMix('#2a2a2a', accent, 0.34),
    accent: soft,
    accentForeground: hexMix('#2a2a2a', accent, 0.34),
    border,
    input: hexMix('#e2e2e6', accent, 0.18),
    ring: accent,
    midground,
    midgroundForeground: readableOn(midground),
    destructive: '#b94a3a',
    destructiveForeground: '#ffffff',
    sidebarBackground: hexMix('#fafafa', accent, 0.05),
    sidebarBorder: border,
    userBubble: soft,
    userBubbleBorder: border
  }
}

/** `getBaseColors` in `context.tsx`: which palette a mode actually paints with. */
function baseColorsFor(theme: DesktopTheme, mode: ThemeMode): DesktopThemeColors {
  if (mode === 'dark') {
    return theme.darkColors ?? theme.colors
  }

  return theme.darkColors ? theme.colors : synthLightColors(theme.colors)
}

// ─── A.1: seeds ─────────────────────────────────────────────────────────────

interface Seeds {
  foreground: string
  primary: string
  secondary: string
  accentSoft: string
  midground: string
  backgroundSeed: string
  sidebarSeed: string
  cardSeed: string
  elevatedSeed: string
  bubbleSeed: string
}

function seedsFor(colors: DesktopThemeColors): Seeds {
  return {
    foreground: colors.foreground,
    primary: colors.primary,
    secondary: colors.secondary,
    accentSoft: colors.accent,
    midground: colors.midground ?? colors.ring,
    backgroundSeed: colors.background,
    sidebarSeed: colors.sidebarBackground ?? colors.background,
    cardSeed: colors.card,
    elevatedSeed: colors.popover,
    bubbleSeed: colors.userBubble ?? colors.popover
  }
}

// ─── A.4: surfaces ──────────────────────────────────────────────────────────

function resolveSurfaces(colors: DesktopThemeColors, mode: ThemeMode) {
  const seeds = seedsFor(colors)
  const m = MODE_CONSTANTS[mode]

  const base = hexToRgba(seeds.foreground)
  const accent = hexToRgba(seeds.midground)

  const bgChrome = mix(hexToRgba(seeds.backgroundSeed), hexToRgba(m.neutralChrome), m.mixChrome)
  const bgSidebar = mix(hexToRgba(seeds.sidebarSeed), hexToRgba(m.neutralSidebar), m.mixSidebar)
  const bgEditor = mix(hexToRgba(seeds.cardSeed), hexToRgba(m.neutralCard), m.mixCard)
  const bgElevated = mix(hexToRgba(seeds.elevatedSeed), hexToRgba(m.neutralCard), m.mixElevated)

  const bgPrimary = mix(accent, mix(base, TRANSPARENT, 0.1), 0.16)
  const bgSecondary = mix(accent, mix(base, TRANSPARENT, 0.07), 0.11)
  const bgTertiary = mix(accent, mix(base, TRANSPARENT, 0.05), 0.08)
  const bgQuaternary = mix(accent, mix(base, TRANSPARENT, 0.04), 0.05)
  const bgQuinary = mix(accent, mix(base, TRANSPARENT, 0.03), 0.03)
  // `--ui-bg-card` (styles.css:280): its own one-off pair, not part of the
  // primary…quinary family above.
  const bgCard = mix(accent, mix(base, TRANSPARENT, 0.04), 0.04)

  const rowHover = mix(accent, mix(base, TRANSPARENT, 0.03), 0.04)
  const rowActive = mix(accent, mix(base, TRANSPARENT, 0.05), 0.08)
  const controlHover = mix(accent, mix(base, TRANSPARENT, 0.04), 0.06)
  const controlActive = mix(accent, mix(base, TRANSPARENT, 0.05), 0.08)

  const textPrimary = mix(base, TRANSPARENT, 0.94)
  const textSecondary = mix(base, TRANSPARENT, 0.74)
  const textTertiary = mix(base, TRANSPARENT, 0.54)
  const textQuaternary = mix(base, TRANSPARENT, 0.36)
  const scaffoldText = mix(base, TRANSPARENT, 0.64)
  const scaffoldMeta = mix(base, TRANSPARENT, 0.44)

  const strokePrimary = mix(accent, mix(base, TRANSPARENT, 0.1), 0.24)
  const strokeSecondary = mix(accent, mix(base, TRANSPARENT, 0.07), 0.16)
  const strokeTertiary = mix(accent, mix(base, TRANSPARENT, 0.05), 0.1)
  const strokeQuaternary = mix(accent, mix(base, TRANSPARENT, 0.03), 0.06)

  const chatBubble = mix(hexToRgba(seeds.bubbleSeed), hexToRgba(m.neutralCard), m.mixBubble)

  const inlineCodeSeed = hexToRgba(mode === 'dark' ? '#ffffff' : '#141414')
  const inlineCodeBg = mix(inlineCodeSeed, TRANSPARENT, mode === 'dark' ? 0.07 : 0.05)
  const inlineCodeFg = mix(inlineCodeSeed, TRANSPARENT, 0.88)

  const uiGreen = hexToRgba(m.uiGreen)
  const uiRed = hexToRgba(m.uiRed)
  const black = hexToRgba('#000000')
  const white = hexToRgba('#ffffff')

  const diffAddBg = mix(uiGreen, TRANSPARENT, 0.12)
  const diffAddFg = mode === 'dark' ? mix(uiGreen, white, 0.62) : mix(uiGreen, black, 0.7)
  const diffRemoveBg = mix(uiRed, TRANSPARENT, 0.12)
  const diffRemoveFg = mode === 'dark' ? mix(uiRed, white, 0.62) : mix(uiRed, black, 0.7)

  return {
    seeds,
    base,
    accent,
    bgChrome,
    bgSidebar,
    bgEditor,
    bgElevated,
    bgPrimary,
    bgSecondary,
    bgTertiary,
    bgQuaternary,
    bgQuinary,
    bgCard,
    rowHover,
    rowActive,
    controlHover,
    controlActive,
    textPrimary,
    textSecondary,
    textTertiary,
    textQuaternary,
    scaffoldText,
    scaffoldMeta,
    strokePrimary,
    strokeSecondary,
    strokeTertiary,
    strokeQuaternary,
    chatBubble,
    inlineCodeBg,
    inlineCodeFg,
    diffAddBg,
    diffAddFg,
    diffRemoveBg,
    diffRemoveFg
  }
}

// ─── A.5: the tokens the app consumes ───────────────────────────────────────

export function resolveMobileTheme(theme: DesktopTheme, mode: ThemeMode): MobileTokens {
  const colors = baseColorsFor(theme, mode)
  const s = resolveSurfaces(colors, mode)
  const m = MODE_CONSTANTS[mode]

  const popover = mix(s.bgElevated, TRANSPARENT, 0.96)
  const widgetSurface = mode === 'dark' ? mix(s.bgEditor, hexToRgba('#000000'), 0.88) : s.bgEditor
  const midgroundForeground = colors.midgroundForeground ?? readableOn(s.seeds.midground)
  const primarySolid = ensureContrast(colors.primary, '#fcfcfc', 4.5)

  return {
    background: fmt(s.bgChrome),
    foreground: fmt(s.textPrimary),
    card: fmt(s.bgEditor),
    cardForeground: fmt(s.textPrimary),
    // D15.1a: applyTheme (context.tsx:249-256) overwrites these four with the
    // skin's solid palette values after the color-mix() defaults.
    muted: colors.muted,
    mutedForeground: fmt(s.textTertiary),
    popover: fmt(popover),
    popoverForeground: fmt(s.textPrimary),
    primary: s.seeds.primary,
    primaryForeground: '#fcfcfc',
    primarySolid,
    primarySolidForeground: '#fcfcfc',
    secondary: s.seeds.secondary,
    secondaryForeground: fmt(s.textSecondary),
    accent: s.seeds.accentSoft,
    accentForeground: fmt(s.textPrimary),
    border: colors.border,
    input: colors.input,
    ring: colors.ring,
    strokePrimary: fmt(s.strokePrimary),
    strokeSecondary: fmt(s.strokeSecondary),
    strokeTertiary: fmt(s.strokeTertiary),
    strokeQuaternary: fmt(s.strokeQuaternary),
    midground: s.seeds.midground,
    midgroundForeground,
    composerRing: fmt(s.base),
    destructive: '#cf2d56',
    destructiveForeground: '#ffffff',
    sidebar: fmt(s.bgSidebar),
    sidebarBorder: fmt(s.strokeSecondary),
    userBubble: fmt(s.chatBubble),
    userBubbleBorder: fmt(s.strokeTertiary),
    widgetSurface: fmt(widgetSurface),
    textPrimary: fmt(s.textPrimary),
    textSecondary: fmt(s.textSecondary),
    textTertiary: fmt(s.textTertiary),
    textQuaternary: fmt(s.textQuaternary),
    scaffoldText: fmt(s.scaffoldText),
    scaffoldMeta: fmt(s.scaffoldMeta),
    inlineCodeBackground: fmt(s.inlineCodeBg),
    inlineCodeForeground: fmt(s.inlineCodeFg),
    diffAddBackground: fmt(s.diffAddBg),
    diffAddForeground: fmt(s.diffAddFg),
    diffRemoveBackground: fmt(s.diffRemoveBg),
    diffRemoveForeground: fmt(s.diffRemoveFg),
    rowHover: fmt(s.rowHover),
    rowActive: fmt(s.rowActive),
    controlHover: fmt(s.controlHover),
    controlActive: fmt(s.controlActive),
    bgPrimary: fmt(s.bgPrimary),
    bgSecondary: fmt(s.bgSecondary),
    bgTertiary: fmt(s.bgTertiary),
    bgQuaternary: fmt(s.bgQuaternary),
    bgQuinary: fmt(s.bgQuinary),
    bgCard: fmt(s.bgCard),
    semantic: {
      red: m.uiRed,
      orange: UI_ORANGE,
      yellow: UI_YELLOW,
      green: m.uiGreen,
      cyan: m.uiCyan,
      blue: UI_BLUE,
      purple: UI_PURPLE
    }
  }
}
