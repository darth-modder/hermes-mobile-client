/**
 * The mobile ThemeProvider: which skin is active, which mode it renders in,
 * and the resolved token object every screen reads via `useTheme()`.
 *
 * No React Context — this codebase keeps state in nanostores atoms and reads
 * them with hooks (AGENTS.md "State": "Small nanostores atoms over component
 * state"), the same shape as `useAppLifecycle`/`usePushRegistration` mounted
 * directly in `app/_layout.tsx`. `<ThemeProvider>` itself only needs to be
 * mounted ONCE (it drives the status bar and the Android root/nav-bar
 * background as side effects); `useTheme()` is safe to call from anywhere.
 *
 * Skin source of truth: `src/theme/backend-skin.ts` (`$backendSkins`,
 * `$pendingSkinApply`), fed by `gateway.ready` / `skin.changed` in
 * `src/gateway/session-connection.ts`. Which skin name is actually selected
 * right now, and the light/dark mode override, live in
 * `src/theme/skin-selection.ts` (split out so that pure logic stays testable
 * without pulling in React — see that file's header).
 */

import { useStore } from '@nanostores/react'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { type ReactNode, useEffect, useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { $backendSkins, $pendingSkinApply } from './backend-skin'
import { type MobileTokens, resolveMobileTheme, type ThemeMode } from './resolve'
import { $modeOverride, $skinName, resolveEffectiveMode, resolveSkinTheme, setSkinName } from './skin-selection'

export type { MobileTokens, ThemeMode } from './resolve'
export type { ModeOverride } from './skin-selection'
export { listAllSkins, setModeOverride, setSkinName } from './skin-selection'

export function useThemeMode(): ThemeMode {
  const override = useStore($modeOverride)
  const systemScheme = useColorScheme()

  return resolveEffectiveMode(override, systemScheme)
}

/** The resolved token object — every screen's one source of colour. */
export function useTheme(): MobileTokens {
  const skinName = useStore($skinName)
  const backendSkins = useStore($backendSkins)
  const mode = useThemeMode()

  const theme = resolveSkinTheme(skinName, backendSkins)

  return useMemo(() => resolveMobileTheme(theme, mode), [theme, mode])
}

/**
 * Mount once, near the root (`app/_layout.tsx`). Drains a backend-requested
 * skin switch (`skin.changed`) into the persisted current pick, and paints
 * the status bar + Android root/navigation-bar background from the resolved
 * tokens. Renders `children` unchanged — it has no visual output of its own
 * beyond the status bar.
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const pendingSkinApply = useStore($pendingSkinApply)
  const tokens = useTheme()
  const mode = useThemeMode()

  useEffect(() => {
    if (pendingSkinApply) {
      setSkinName(pendingSkinApply)
      $pendingSkinApply.set(null)
    }
  }, [pendingSkinApply])

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(tokens.background)
  }, [tokens.background])

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {children}
    </>
  )
}
