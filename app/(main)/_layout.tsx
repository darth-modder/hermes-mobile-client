import { Stack } from 'expo-router'

import { AppDrawer } from '../../src/components/AppDrawer'

export default function MainLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <AppDrawer />
    </>
  )
}
