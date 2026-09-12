import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  approvePairing,
  getMessagingPlatforms,
  getPairing,
  revokePairing,
  testMessagingPlatform,
  updateMessagingPlatform
} from '../../../src/api/messaging'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { CHANNELS_NO_PENDING_PAIRING, CHANNELS_NO_PLATFORMS } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { $pairingChangeTick, $platformsChangeTick } from '../../../src/store/live-sync'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { MessagingPlatformInfo, PairingUser } from '../../../src/upstream/types/hermes'

const PLATFORMS_KEY = 'messaging-platforms'
const PAIRING_KEY = 'pairing'

// Replicates: docs/desktop-prototypes/a-main/messaging.html (MasterDetail
// platform rail + detail, the pairing pending/approved lists) — collapsed
// into one scrolling list since this screen predates M14's list/detail
// adaptation and a real M09/M10 build isn't worth rewriting for layout
// alone. Labels below come from the vendored `t.messaging` block (D15.4),
// with a couple of generic words cross-reused from elsewhere in en.ts by
// value (t.shell.gatewayMenu.messagingPlatforms for the "Platforms"
// heading, t.settings.connections.testConnection for "Test",
// t.settings.mcp.testing for "Testing…", t.cron.states.running for the
// inline "running" status word — none of `messaging`'s own keys cover
// these). Per the earlier review's other named trap: this screen's own
// header said "Channels" while the drawer already calls the same route
// "Messaging" (t.sidebar.nav.messaging) — now both agree.
/**
 * Channels screen (M10). `/api/messaging/*` + `/api/pairing/*`
 * (src/api/messaging.ts, ported by M09 with no UI for this milestone to
 * build). Two sections: messaging platforms (Telegram/WhatsApp/... —
 * configure env vars, enable, test) and pairing (who may DM the bot — exit
 * criterion "Pairing approve / revoke works"). Both refetch live on their
 * `*.changed` gateway broadcast (src/store/live-sync.ts).
 *
 * Platform onboarding is env-vars-in, same shape as the M09 providers
 * screen — not the desktop's guided per-platform wizard (QR codes, bot
 * father links, phone-number OTP flows). The env var list + Save + Test is
 * enough to configure and verify a platform; guided onboarding is a UI
 * investment no exit criterion asks for.
 */
export default function ChannelsScreen() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined

  const [expanded, setExpanded] = useState<null | string>(null)
  const [envDrafts, setEnvDrafts] = useState<Record<string, string>>({})
  const [testMessages, setTestMessages] = useState<Record<string, string>>({})

  const platformsQuery = useQuery({
    queryFn: () => getMessagingPlatforms(profile),
    queryKey: [PLATFORMS_KEY, profile]
  })

  const pairingQuery = useQuery({ queryFn: () => getPairing(profile), queryKey: [PAIRING_KEY, profile] })

  const invalidatePlatforms = () => void queryClient.invalidateQueries({ queryKey: [PLATFORMS_KEY, profile] })
  const invalidatePairing = () => void queryClient.invalidateQueries({ queryKey: [PAIRING_KEY, profile] })

  const platformsChangeTick = useStore($platformsChangeTick)
  const pairingChangeTick = useStore($pairingChangeTick)
  const skipInitialPlatformsTick = useRef(true)
  const skipInitialPairingTick = useRef(true)

  useEffect(() => {
    if (skipInitialPlatformsTick.current) {
      skipInitialPlatformsTick.current = false

      return
    }

    void queryClient.invalidateQueries({ queryKey: [PLATFORMS_KEY, profile] })
  }, [platformsChangeTick, profile, queryClient])

  useEffect(() => {
    if (skipInitialPairingTick.current) {
      skipInitialPairingTick.current = false

      return
    }

    void queryClient.invalidateQueries({ queryKey: [PAIRING_KEY, profile] })
  }, [pairingChangeTick, profile, queryClient])

  const toggleMutation = useMutation({
    mutationFn: (args: { id: string; enabled: boolean }) =>
      updateMessagingPlatform(args.id, { enabled: args.enabled }, profile),
    onSuccess: invalidatePlatforms
  })

  const saveEnvMutation = useMutation({
    mutationFn: (args: { id: string; env: Record<string, string> }) =>
      updateMessagingPlatform(args.id, { env: args.env }, profile),
    onSuccess: (_result, args) => {
      setEnvDrafts(current => {
        const next = { ...current }

        for (const key of Object.keys(args.env)) {
          delete next[`${args.id}:${key}`]
        }

        return next
      })
      invalidatePlatforms()
    }
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => testMessagingPlatform(id, profile),
    onError: (err, id) => {
      setTestMessages(current => ({ ...current, [id]: err instanceof Error ? err.message : String(err) }))
    },
    onSuccess: (result, id) => {
      setTestMessages(current => ({
        ...current,
        [id]: result.ok ? result.message || 'OK' : `Failed: ${result.message}`
      }))
    }
  })

  const approveMutation = useMutation({
    mutationFn: (user: PairingUser) => approvePairing(user.platform, user.request_id ?? '', profile),
    onSuccess: invalidatePairing
  })

  const revokeMutation = useMutation({
    mutationFn: (user: PairingUser) => revokePairing(user.platform, user.user_id, profile),
    onSuccess: invalidatePairing
  })

  const confirmRevoke = (user: PairingUser) => {
    Alert.alert(t.messaging.revokeTitle, t.messaging.revokeDesc(user.user_name || user.user_id), [
      { style: 'cancel', text: t.common.cancel },
      { onPress: () => revokeMutation.mutate(user), style: 'destructive', text: t.messaging.revoke }
    ])
  }

  const saveEnv = (platform: MessagingPlatformInfo) => {
    const env: Record<string, string> = {}

    for (const envVar of platform.env_vars) {
      const draft = envDrafts[`${platform.id}:${envVar.key}`]

      if (draft?.trim()) {
        env[envVar.key] = draft.trim()
      }
    }

    if (Object.keys(env).length === 0) {
      return
    }

    saveEnvMutation.mutate({ env, id: platform.id })
  }

  const platforms = platformsQuery.data?.platforms ?? []
  const pending = pairingQuery.data?.pending ?? []
  const approved = pairingQuery.data?.approved ?? []

  const refreshing = platformsQuery.isRefetching || pairingQuery.isRefetching

  const onRefresh = () => {
    void platformsQuery.refetch()
    void pairingQuery.refetch()
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={t.sidebar.nav.messaging} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={tokens.mutedForeground} />
        }
      >
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>
          {t.shell.gatewayMenu.messagingPlatforms}
        </Text>
        {platformsQuery.isLoading ? (
          <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} />
        ) : platformsQuery.isError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {platformsQuery.error instanceof Error ? platformsQuery.error.message : String(platformsQuery.error)}
            </Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => void platformsQuery.refetch()}
              style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : platforms.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{CHANNELS_NO_PLATFORMS}</Text>
        ) : null}

        {platforms.map(platform => {
          const isExpanded = expanded === platform.id

          return (
            <View key={platform.id} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : platform.id)}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{platform.name}</Text>
                  <Switch
                    onValueChange={value => toggleMutation.mutate({ enabled: value, id: platform.id })}
                    value={platform.enabled}
                  />
                </View>
                <Text
                  numberOfLines={isExpanded ? undefined : 1}
                  style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}
                >
                  {platform.description}
                </Text>
                <Text style={[styles.rowMeta, { color: tokens.textTertiary }]}>
                  {platform.configured ? t.messaging.credentialsSet : t.messaging.needsSetup}
                  {platform.gateway_running ? ` · ${t.cron.states.running}` : ''}
                  {platform.state ? ` · ${platform.state}` : ''}
                  {platform.error_message ? ` · ${platform.error_message}` : ''}
                </Text>
              </TouchableOpacity>

              {isExpanded ? (
                <View style={[styles.envSection, { borderTopColor: tokens.border }]}>
                  {platform.env_vars.map(envVar => (
                    <View key={envVar.key} style={styles.envRow}>
                      <Text style={[styles.envLabel, { color: tokens.mutedForeground }]}>
                        {envVar.key}
                        {envVar.is_set ? ` (${t.common.set})` : envVar.required ? ` (${t.messaging.required})` : ''}
                      </Text>
                      <TextInput
                        autoCapitalize="none"
                        onChangeText={value =>
                          setEnvDrafts(current => ({ ...current, [`${platform.id}:${envVar.key}`]: value }))
                        }
                        placeholder={envVar.redacted_value || envVar.prompt || envVar.key}
                        placeholderTextColor={tokens.textTertiary}
                        secureTextEntry={envVar.is_password}
                        style={[
                          styles.input,
                          { backgroundColor: tokens.muted, borderColor: tokens.border, color: tokens.foreground }
                        ]}
                        value={envDrafts[`${platform.id}:${envVar.key}`] ?? ''}
                      />
                    </View>
                  ))}
                  {testMessages[platform.id] ? (
                    <Text style={[styles.testMessage, { color: tokens.mutedForeground }]}>
                      {testMessages[platform.id]}
                    </Text>
                  ) : null}
                  <View style={styles.actions}>
                    <TouchableOpacity hitSlop={8} onPress={() => saveEnv(platform)} style={styles.actionButton}>
                      <Text style={[styles.actionText, { color: tokens.primary }]}>
                        {saveEnvMutation.isPending ? t.messaging.saving : t.messaging.saveChanges}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => testMutation.mutate(platform.id)}
                      style={styles.actionButton}
                    >
                      <Text style={[styles.actionText, { color: tokens.primary }]}>
                        {testMutation.isPending && testMutation.variables === platform.id
                          ? t.settings.mcp.testing
                          : t.settings.connections.testConnection}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          )
        })}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>
          {t.messaging.pendingRequests(pending.length)}
        </Text>
        {pairingQuery.isLoading ? (
          <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} />
        ) : pairingQuery.isError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {pairingQuery.error instanceof Error ? pairingQuery.error.message : String(pairingQuery.error)}
            </Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => void pairingQuery.refetch()}
              style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : pending.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{CHANNELS_NO_PENDING_PAIRING}</Text>
        ) : (
          pending.map(user => (
            <View
              key={`${user.platform}:${user.request_id ?? user.user_id}`}
              style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
            >
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{user.user_name || user.user_id}</Text>
              <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {user.platform}
                {typeof user.age_minutes === 'number' ? ` · ${Math.round(user.age_minutes)}m ago` : ''}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity hitSlop={8} onPress={() => approveMutation.mutate(user)} style={styles.actionButton}>
                  <Text style={[styles.actionText, { color: tokens.primary }]}>
                    {approveMutation.isPending && approveMutation.variables === user
                      ? t.messaging.approving
                      : t.messaging.approve}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {approved.length > 0 ? (
          <>
            <Text style={[styles.sectionSubtitle, { color: tokens.mutedForeground }]}>
              {t.messaging.approvedUsers(approved.length)}
            </Text>
            {approved.map(user => (
              <View
                key={`${user.platform}:${user.user_id}`}
                style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
              >
                <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{user.user_name || user.user_id}</Text>
                <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>{user.platform}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity hitSlop={8} onPress={() => confirmRevoke(user)} style={styles.actionButton}>
                    <Text style={[styles.destructiveText, { color: tokens.destructive }]}>{t.messaging.revoke}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    marginRight: 16
  },
  actionText: {
    ...type.label,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    ...type.label,
    fontWeight: '600'
  },
  envLabel: {
    ...type.caption,
    marginBottom: 4
  },
  envRow: {
    marginTop: 8
  },
  envSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 10
  },
  errorBlock: {
    marginTop: 6
  },
  errorText: {
    ...type.caption,
    marginTop: 6
  },
  input: {
    ...type.mono,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowMeta: {
    ...type.caption,
    marginTop: 4
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.control,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  retryText: {
    ...type.label,
    fontWeight: '600'
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 6
  },
  sectionSubtitle: {
    ...type.caption,
    fontWeight: '700',
    marginTop: 12,
    textTransform: 'uppercase'
  },
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginBottom: 12
  },
  testMessage: {
    ...type.caption,
    marginTop: 8
  }
})
