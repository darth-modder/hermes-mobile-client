import { useStore } from '@nanostores/react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { type BotProfile, listBots } from '../../../src/api/bots'
import { Composer } from '../../../src/chat/Composer'
import { ConnectionBanner } from '../../../src/chat/ConnectionBanner'
import { NotificationBanner } from '../../../src/chat/NotificationBanner'
import { SessionHeader } from '../../../src/chat/SessionHeader'
import { Transcript } from '../../../src/chat/Transcript'
import { BotSettingsSheet } from '../../../src/components/BotSettingsSheet'
import { createSession, resumeSession } from '../../../src/gateway/session-connection'
import { t } from '../../../src/lib/t'
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
 * Also replicates docs/desktop-prototypes/e-overlays/gateway-connecting.html
 * (the "Connection banner" half of that mapping row only — see
 * ConnectionBanner's own header for why the full-screen boot mask isn't
 * built) and docs/desktop-prototypes/e-overlays/boot-failure.html (the
 * `error` branch below, restyled from that prototype's card — see its
 * comment for the field-by-field mapping and what mobile has no equivalent
 * for).
 *
 * No session-list screen exists yet (M07), so `id: "new"` is also today's
 * only entry point into a fresh conversation — it creates one and replaces
 * this route with the real stored id so back/forward and a later resume
 * both address it the normal way.
 */
export default function SessionScreen() {
  const router = useRouter()
  const tokens = useTheme()

  const { botId, botName, id, title } = useLocalSearchParams<{
    botId?: string
    botName?: string
    id: string
    title?: string
  }>()

  const [error, setError] = useState<null | string>(null)
  const [ready, setReady] = useState(false)
  const startedFor = useRef<string | null>(null)
  const [botSettingsOpen, setBotSettingsOpen] = useState(false)
  const [botRoster, setBotRoster] = useState<BotProfile[] | null>(null)

  const openBotSettings = useCallback(() => {
    setBotSettingsOpen(true)

    if (botRoster === null) {
      void listBots()
        .then(result => setBotRoster(result.profiles))
        .catch(() => setBotRoster([]))
    }
  }, [botRoster])

  const botProfile = botId ? botRoster?.find(p => p.name === botId) : undefined

  const openSession = useCallback(() => {
    if (!id) {
      return
    }

    setError(null)
    setReady(false)

    const open = id === 'new' ? createSession() : resumeSession(id, title, botId)

    open
      .then(storedId => {
        if (id === 'new') {
          router.replace({ params: { id: storedId }, pathname: '/(main)/sessions/[id]' })
        } else {
          setReady(true)
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
  }, [botId, id, router, title])

  useEffect(() => {
    if (!id || startedFor.current === id) {
      return
    }

    startedFor.current = id
    openSession()
    // openSession is intentionally left out: it's recreated every render
    // (router/id-derived) and re-running it here on every one of those
    // recreations would defeat the startedFor guard this effect exists for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (id !== 'new') {
      setReady(true)
    }
  }, [id])

  const session = useStore($sessionStates)[id === 'new' ? '' : id]

  if (error) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.center, { backgroundColor: tokens.background }]}>
        <View style={[styles.failureCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={[styles.failureTitle, { color: tokens.foreground }]}>{t.desktop.resumeStrandedTitle}</Text>
          <Text style={[styles.failureDesc, { color: tokens.mutedForeground }]}>{t.desktop.resumeStrandedBody}</Text>
          <View style={[styles.failureErrorBox, { backgroundColor: tokens.muted, borderColor: tokens.destructive }]}>
            <Text style={[styles.failureErrorText, { color: tokens.destructive }]}>{error}</Text>
          </View>
          <View style={styles.failureActions}>
            <TouchableOpacity
              accessibilityLabel={t.desktop.resumeRetry}
              accessibilityRole="button"
              onPress={openSession}
              style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.desktop.resumeRetry}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t.boot.failure.gatewaySettings}
              accessibilityRole="button"
              onPress={() => router.replace('/(main)/settings/connections')}
              style={[styles.retryButton, { backgroundColor: tokens.secondary }]}
            >
              <Text style={[styles.retryText, { color: tokens.secondaryForeground }]}>
                {t.boot.failure.gatewaySettings}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
      <SessionHeader botName={botName} onSettingsPress={botId ? openBotSettings : undefined} storedSessionId={id} />
      <ConnectionBanner />
      <NotificationBanner />
      <Transcript messages={session.messages} storedSessionId={id} />
      <Composer storedSessionId={id} />
      {botProfile ? (
        <BotSettingsSheet
          onClose={() => setBotSettingsOpen(false)}
          profile={botProfile}
          roster={botRoster ?? []}
          visible={botSettingsOpen}
        />
      ) : null}
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
  failureActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  failureCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 12,
    maxWidth: 480,
    padding: 16,
    width: '100%'
  },
  failureDesc: {
    ...type.bodySmall
  },
  failureErrorBox: {
    borderRadius: radius.control,
    borderWidth: 1,
    padding: 10
  },
  failureErrorText: {
    ...type.mono
  },
  failureTitle: {
    ...type.body,
    fontWeight: '600'
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
