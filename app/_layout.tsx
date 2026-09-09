import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { useAppLifecycle } from '../src/gateway/useAppLifecycle'
import { useNotifications } from '../src/push/useNotifications'
import { usePushRegistration } from '../src/push/usePushRegistration'

export default function RootLayout() {
  useAppLifecycle()
  useNotifications()
  usePushRegistration()

  // One QueryClient for the app's lifetime — the settings screens (M09) are
  // the first REST-backed callers; created lazily (useState initializer,
  // never re-created across re-renders) so it survives navigation the same
  // way the nanostores atoms elsewhere in this app do.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
