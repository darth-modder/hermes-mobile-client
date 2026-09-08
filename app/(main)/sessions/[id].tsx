import { useStore } from '@nanostores/react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Composer } from '../../../src/chat/Composer'
import { SessionHeader } from '../../../src/chat/SessionHeader'
import { Transcript } from '../../../src/chat/Transcript'
import { createSession, resumeSession } from '../../../src/gateway/session-connection'
import { $sessionStates } from '../../../src/store/session-states'

/**
 * The chat screen. No session-list screen exists yet (M07), so `id: "new"`
 * is also today's only entry point into a fresh conversation — it creates
 * one and replaces this route with the real stored id so back/forward and a
 * later resume both address it the normal way.
 */
export default function SessionScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [error, setError] = useState<null | string>(null)
  const [ready, setReady] = useState(false)
  const startedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!id || startedFor.current === id) {
      return
    }

    startedFor.current = id
    setError(null)
    setReady(false)

    const open = id === 'new' ? createSession() : resumeSession(id)

    open
      .then(storedId => {
        if (id === 'new') {
          router.replace({ params: { id: storedId }, pathname: '/(main)/sessions/[id]' })
        } else {
          setReady(true)
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
  }, [id, router])

  useEffect(() => {
    if (id !== 'new') {
      setReady(true)
    }
  }, [id])

  const session = useStore($sessionStates)[id === 'new' ? '' : id]

  if (error) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.replace('/connect')} style={styles.retryButton}>
          <Text style={styles.retryText}>Back to connections</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (!ready || id === 'new' || !session) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.center}>
        <ActivityIndicator color="#8a8a99" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <SessionHeader storedSessionId={id} />
      <Transcript messages={session.messages} storedSessionId={id} />
      <Composer storedSessionId={id} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: '#0b0b0f',
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  errorText: {
    color: '#e06c75',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  }
})
