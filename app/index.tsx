import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { getActiveConnection } from '../src/connections/registry'

/**
 * No session-list screen exists yet (M07), so there is nothing useful to
 * show here beyond routing onward: straight into a new chat if a connection
 * is already configured, otherwise to the connect flow.
 */
export default function HomeScreen() {
  const router = useRouter()

  useEffect(() => {
    const connection = getActiveConnection()

    router.replace(connection ? { params: { id: 'new' }, pathname: '/(main)/sessions/[id]' } : '/connect')
  }, [router])

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#8a8a99" size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0b0b0f',
    flex: 1,
    justifyContent: 'center'
  }
})
