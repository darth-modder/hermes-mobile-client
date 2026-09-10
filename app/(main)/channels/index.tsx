import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import { $pairingChangeTick, $platformsChangeTick } from '../../../src/store/live-sync'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import type { MessagingPlatformInfo, PairingUser } from '../../../src/upstream/types/hermes'

const PLATFORMS_KEY = 'messaging-platforms'
const PAIRING_KEY = 'pairing'

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

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title="Channels" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Platforms</Text>
        {platformsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {platformsQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {platformsQuery.error instanceof Error ? platformsQuery.error.message : String(platformsQuery.error)}
          </Text>
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
                  {platform.configured ? 'Configured' : 'Not configured'}
                  {platform.gateway_running ? ' · running' : ''}
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
                        {envVar.is_set ? ' (set)' : envVar.required ? ' (required)' : ''}
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
                    <TouchableOpacity onPress={() => saveEnv(platform)} style={styles.actionButton}>
                      <Text style={[styles.actionText, { color: tokens.primary }]}>
                        {saveEnvMutation.isPending ? 'Saving…' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => testMutation.mutate(platform.id)} style={styles.actionButton}>
                      <Text style={[styles.actionText, { color: tokens.primary }]}>
                        {testMutation.isPending && testMutation.variables === platform.id ? 'Testing…' : 'Test'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          )
        })}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Pairing</Text>
        {pairingQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {pairingQuery.error instanceof Error ? pairingQuery.error.message : String(pairingQuery.error)}
          </Text>
        ) : null}

        {pending.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No pending pairing requests.</Text>
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
                <TouchableOpacity onPress={() => approveMutation.mutate(user)} style={styles.actionButton}>
                  <Text style={[styles.actionText, { color: tokens.primary }]}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {approved.length > 0 ? (
          <>
            <Text style={[styles.sectionSubtitle, { color: tokens.mutedForeground }]}>Approved</Text>
            {approved.map(user => (
              <View
                key={`${user.platform}:${user.user_id}`}
                style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
              >
                <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{user.user_name || user.user_id}</Text>
                <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>{user.platform}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => revokeMutation.mutate(user)} style={styles.actionButton}>
                    <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Revoke</Text>
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
    fontSize: 13,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  card: {
    borderRadius: 10,
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
    fontSize: 13,
    fontWeight: '600'
  },
  envLabel: {
    fontSize: 11,
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
  errorText: {
    fontSize: 12,
    marginTop: 6
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowMeta: {
    fontSize: 11,
    marginTop: 4
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 6
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginBottom: 12
  },
  testMessage: {
    fontSize: 12,
    marginTop: 8
  }
})
