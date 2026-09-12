import { useStore } from '@nanostores/react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Composer } from '../../../src/chat/Composer'
import { NotificationBanner } from '../../../src/chat/NotificationBanner'
import { SessionHeader } from '../../../src/chat/SessionHeader'
import { Transcript } from '../../../src/chat/Transcript'
import { createSession, resumeSession } from '../../../src/gateway/session-connection'
import { $sessionStates } from '../../../src/store/session-states'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

/**
 * Replicates: docs/mobile-prototypes/chat.html (conversation view only —
 * the approval/clarify/attach/palette/dictation/model/effort views and
 * every `Field:`-tagged addition in that prototype are M15's; see M14
 * Deviations). Adaptation rules applied: thread full width with 16 dp
 * gutters, block gap 12 dp (turn-vs-block gap collapsed to one value, see
 * Deviations); message bubble `radius.card`, max width 86%, pad 14×10;
 * SessionHeader at 56 dp; composer controls 48 dp (already M13); structure
 * of the composer and the approval/clarify/sudo/secret cards is
 * device-verified and unchanged, restyle only.
 *
 * No session-list screen exists yet (M07), so `id: "new"` is also today's
 * only entry point into a fresh conversation — it creates one and replaces
 * this route with the real stored id so back/forward and a later resume
 * both address it the normal way.
 */
export default function SessionScreen() {
  const router = useRouter()
  const tokens = useTheme()
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
      <SafeAreaView edges={['top', 'bottom']} style={[styles.center, { backgroundColor: tokens.background }]}>
        <Text style={[styles.errorText, { color: tokens.destructive }]}>{error}</Text>
        <TouchableOpacity
          onPress={() => router.replace('/connect')}
          style={[styles.retryButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>Back to connections</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (!ready || id === 'new' || !session) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.center, { backgroundColor: tokens.background }]}>
        <ActivityIndicator color={tokens.mutedForeground} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <SessionHeader storedSessionId={id} />
      <NotificationBanner />
      <Transcript messages={session.messages} storedSessionId={id} />
      <Composer storedSessionId={id} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  container: {
    flex: 1
  },
  errorText: {
    ...type.bodySmall,
    marginBottom: 16,
    textAlign: 'center'
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryText: {
    ...type.bodySmall,
    fontWeight: '600'
  }
})
