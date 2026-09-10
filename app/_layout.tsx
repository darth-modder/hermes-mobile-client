import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { useAppLifecycle } from '../src/gateway/useAppLifecycle'
import { useAppFonts } from '../src/lib/fonts'
import { useNotifications } from '../src/push/useNotifications'
import { usePushRegistration } from '../src/push/usePushRegistration'
import { ThemeProvider } from '../src/theme/provider'

export default function RootLayout() {
  useAppLifecycle()
  useNotifications()
  usePushRegistration()

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
