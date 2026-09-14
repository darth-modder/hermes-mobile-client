import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { logRegistryState } from '../src/connections/registry'
import { useAppLifecycle } from '../src/gateway/useAppLifecycle'
import { useAppFonts } from '../src/lib/fonts'
import { useNotifications } from '../src/push/useNotifications'
import { usePushRegistration } from '../src/push/usePushRegistration'
import { ThemeProvider } from '../src/theme/provider'

export default function RootLayout() {
  useAppLifecycle()
  useNotifications()
  usePushRegistration()

  // M15 round 5 task 0: a trustworthy storage readback, logged once at
  // startup — see registry.ts's `logRegistryState` header for why this
  // replaced raw MMKV byte-scanning as the way to check this state.
  useEffect(() => {
    logRegistryState()
  }, [])

  const fontsLoaded = useAppFonts()

  // One QueryClient for the app's lifetime — the settings screens (M09) are
  // the first REST-backed callers; created lazily (useState initializer,
  // never re-created across re-renders) so it survives navigation the same
  // way the nanostores atoms elsewhere in this app do.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))

  if (!fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
