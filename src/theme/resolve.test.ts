// Pins resolveMobileTheme's output for the `nous` skin, both modes, against
// the worked values in M13 Appendix A.6 (background, card, foreground, and
// border — the last computed by mix() and checked by eye there as "a 1px
// border, faintly blue on white"). The rest of each object is pinned too so a
// later edit to the port can't silently drift (Appendix A.6's own framing).

import { describe, expect, it } from 'vitest'

import { nousTheme } from '../upstream/themes/presets'

import { resolveMobileTheme } from './resolve'

describe('resolveMobileTheme', () => {
  it('matches Appendix A.6 for nous light', () => {
    const tokens = resolveMobileTheme(nousTheme, 'light')

    // The four values Appendix A.6 works by hand.
    expect(tokens.background).toBe('#fefefe')
    expect(tokens.card).toBe('#fbfbfc')
    expect(tokens.foreground).toBe('rgba(31, 35, 40, 0.94)')
    expect(tokens.border).toBe('rgba(8, 70, 196, 0.2188)')

    // Everything else, pinned.
    expect(tokens).toEqual({
      background: '#fefefe',
      foreground: 'rgba(31, 35, 40, 0.94)',
      card: '#fbfbfc',
      cardForeground: 'rgba(31, 35, 40, 0.94)',
      muted: 'rgba(11, 65, 175, 0.126)',
      mutedForeground: 'rgba(31, 35, 40, 0.54)',
      popover: 'rgba(253, 253, 253, 0.96)',
      popoverForeground: 'rgba(31, 35, 40, 0.94)',
      primary: '#0053fd',
      primaryForeground: '#fcfcfc',
      primarySolid: '#0053fd',
      primarySolidForeground: '#fcfcfc',
      secondary: '#deeaff',
      secondaryForeground: 'rgba(31, 35, 40, 0.74)',
      accent: '#e3edff',
      accentForeground: 'rgba(31, 35, 40, 0.94)',
      border: 'rgba(8, 70, 196, 0.2188)',
      input: 'rgba(7, 71, 202, 0.316)',
      ring: 'rgba(7, 71, 202, 0.316)',
      midground: '#0053fd',
      midgroundForeground: '#ffffff',
      composerRing: '#1f2328',
      destructive: '#cf2d56',
      destructiveForeground: '#ffffff',
      sidebar: '#f6f8fa',
      sidebarBorder: 'rgba(8, 70, 196, 0.2188)',
      userBubble: '#fcfcfc',
      userBubbleBorder: 'rgba(10, 68, 187, 0.145)',
      widgetSurface: '#fbfbfc',
      textPrimary: 'rgba(31, 35, 40, 0.94)',
      textSecondary: 'rgba(31, 35, 40, 0.74)',
      textTertiary: 'rgba(31, 35, 40, 0.54)',
      textQuaternary: 'rgba(31, 35, 40, 0.36)',
      scaffoldText: 'rgba(31, 35, 40, 0.64)',
      scaffoldMeta: 'rgba(31, 35, 40, 0.44)',
      inlineCodeBackground: 'rgba(20, 20, 20, 0.05)',
      inlineCodeForeground: 'rgba(20, 20, 20, 0.88)',
      diffAddBackground: 'rgba(31, 138, 101, 0.12)',
      diffAddForeground: '#166147',
      diffRemoveBackground: 'rgba(207, 45, 86, 0.12)',
      diffRemoveForeground: '#911f3c',
      rowHover: 'rgba(13, 63, 164, 0.0688)',
      rowActive: 'rgba(11, 65, 175, 0.126)',
      controlHover: 'rgba(12, 65, 171, 0.0976)',
      controlActive: 'rgba(11, 65, 175, 0.126)',
      semantic: {
        red: '#cf2d56',
        orange: '#db704b',
        yellow: '#c08532',
        green: '#1f8a65',
        cyan: '#4c7f8c',
        blue: '#0053fd',
        purple: '#9e94d5'
      }
    })
  })

  it('matches the same formulas for nous dark', () => {
    const tokens = resolveMobileTheme(nousTheme, 'dark')

    expect(tokens).toEqual({
      background: '#0d1015',
      foreground: 'rgba(230, 237, 243, 0.94)',
      card: '#0e0f12',
      cardForeground: 'rgba(230, 237, 243, 0.94)',
      muted: 'rgba(131, 170, 250, 0.126)',
      mutedForeground: 'rgba(230, 237, 243, 0.54)',
      popover: 'rgba(22, 24, 29, 0.96)',
      popoverForeground: 'rgba(230, 237, 243, 0.94)',
      primary: '#4a84fe',
      primaryForeground: '#fcfcfc',
      primarySolid: '#3b6acb',
      primarySolidForeground: '#fcfcfc',
      secondary: '#1d2e4f',
      secondaryForeground: 'rgba(230, 237, 243, 0.74)',
      accent: '#17243a',
      accentForeground: 'rgba(230, 237, 243, 0.94)',
      border: 'rgba(116, 160, 251, 0.2188)',
      input: 'rgba(112, 157, 251, 0.316)',
      ring: 'rgba(112, 157, 251, 0.316)',
      midground: '#4a84fe',
      midgroundForeground: '#161616',
      composerRing: '#e6edf3',
      destructive: '#cf2d56',
      destructiveForeground: '#ffffff',
      sidebar: '#010409',
      sidebarBorder: 'rgba(116, 160, 251, 0.2188)',
      userBubble: '#0f1621',
      userBubbleBorder: 'rgba(122, 165, 251, 0.145)',
      widgetSurface: '#0c0d10',
      textPrimary: 'rgba(230, 237, 243, 0.94)',
      textSecondary: 'rgba(230, 237, 243, 0.74)',
      textTertiary: 'rgba(230, 237, 243, 0.54)',
      textQuaternary: 'rgba(230, 237, 243, 0.36)',
      scaffoldText: 'rgba(230, 237, 243, 0.64)',
      scaffoldMeta: 'rgba(230, 237, 243, 0.44)',
      inlineCodeBackground: 'rgba(20, 20, 20, 0.05)',
      inlineCodeForeground: 'rgba(20, 20, 20, 0.88)',
      diffAddBackground: 'rgba(85, 165, 131, 0.12)',
      diffAddForeground: '#96c7b2',
      diffRemoveBackground: 'rgba(231, 94, 120, 0.12)',
      diffRemoveForeground: '#f09bab',
      rowHover: 'rgba(139, 176, 249, 0.0688)',
      rowActive: 'rgba(131, 170, 250, 0.126)',
      controlHover: 'rgba(134, 172, 250, 0.0976)',
      controlActive: 'rgba(131, 170, 250, 0.126)',
      semantic: {
        red: '#e75e78',
        orange: '#db704b',
        yellow: '#c08532',
        green: '#55a583',
        cyan: '#6f9ba6',
        blue: '#0053fd',
        purple: '#9e94d5'
      }
    })
  })
})
