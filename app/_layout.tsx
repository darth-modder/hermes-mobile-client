import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { useAppLifecycle } from '../src/gateway/useAppLifecycle'
import { useNotifications } from '../src/push/useNotifications'
import { usePushRegistration } from '../src/push/usePushRegistration'

export default function RootLayout() {
  useAppLifecycle()
  useNotifications()
  usePushRegistration()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
