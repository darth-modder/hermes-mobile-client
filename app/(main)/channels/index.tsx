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
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader title="Channels" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Platforms</Text>
        {platformsQuery.isLoading ? <ActivityIndicator color="#8a8a99" style={styles.spinner} /> : null}
        {platformsQuery.isError ? (
          <Text style={styles.errorText}>
            {platformsQuery.error instanceof Error ? platformsQuery.error.message : String(platformsQuery.error)}
          </Text>
        ) : null}

        {platforms.map(platform => {
          const isExpanded = expanded === platform.id

          return (
            <View key={platform.id} style={styles.card}>
              <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : platform.id)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.rowTitle}>{platform.name}</Text>
                  <Switch
                    onValueChange={value => toggleMutation.mutate({ enabled: value, id: platform.id })}
                    value={platform.enabled}
                  />
                </View>
                <Text numberOfLines={isExpanded ? undefined : 1} style={styles.rowSubtitle}>
                  {platform.description}
                </Text>
                <Text style={styles.rowMeta}>
                  {platform.configured ? 'Configured' : 'Not configured'}
                  {platform.gateway_running ? ' · running' : ''}
                  {platform.state ? ` · ${platform.state}` : ''}
                  {platform.error_message ? ` · ${platform.error_message}` : ''}
                </Text>
              </TouchableOpacity>

              {isExpanded ? (
                <View style={styles.envSection}>
                  {platform.env_vars.map(envVar => (
                    <View key={envVar.key} style={styles.envRow}>
                      <Text style={styles.envLabel}>
                        {envVar.key}
                        {envVar.is_set ? ' (set)' : envVar.required ? ' (required)' : ''}
                      </Text>
                      <TextInput
                        autoCapitalize="none"
                        onChangeText={value =>
                          setEnvDrafts(current => ({ ...current, [`${platform.id}:${envVar.key}`]: value }))
                        }
                        placeholder={envVar.redacted_value || envVar.prompt || envVar.key}
                        placeholderTextColor="#5a5a66"
                        secureTextEntry={envVar.is_password}
                        style={styles.input}
                        value={envDrafts[`${platform.id}:${envVar.key}`] ?? ''}
                      />
                    </View>
                  ))}
                  {testMessages[platform.id] ? (
                    <Text style={styles.testMessage}>{testMessages[platform.id]}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <TouchableOpacity onPress={() => saveEnv(platform)} style={styles.actionButton}>
                      <Text style={styles.actionText}>{saveEnvMutation.isPending ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => testMutation.mutate(platform.id)} style={styles.actionButton}>
                      <Text style={styles.actionText}>
                        {testMutation.isPending && testMutation.variables === platform.id ? 'Testing…' : 'Test'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          )
        })}

        <Text style={styles.sectionTitle}>Pairing</Text>
        {pairingQuery.isError ? (
          <Text style={styles.errorText}>
            {pairingQuery.error instanceof Error ? pairingQuery.error.message : String(pairingQuery.error)}
          </Text>
        ) : null}

        {pending.length === 0 ? (
          <Text style={styles.sectionHint}>No pending pairing requests.</Text>
        ) : (
          pending.map(user => (
            <View key={`${user.platform}:${user.request_id ?? user.user_id}`} style={styles.card}>
              <Text style={styles.rowTitle}>{user.user_name || user.user_id}</Text>
              <Text style={styles.rowSubtitle}>
                {user.platform}
                {typeof user.age_minutes === 'number' ? ` · ${Math.round(user.age_minutes)}m ago` : ''}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => approveMutation.mutate(user)} style={styles.actionButton}>
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {approved.length > 0 ? (
          <>
            <Text style={styles.sectionSubtitle}>Approved</Text>
            {approved.map(user => (
              <View key={`${user.platform}:${user.user_id}`} style={styles.card}>
                <Text style={styles.rowTitle}>{user.user_name || user.user_id}</Text>
                <Text style={styles.rowSubtitle}>{user.platform}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => revokeMutation.mutate(user)} style={styles.actionButton}>
                    <Text style={styles.destructiveText}>Revoke</Text>
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
    color: '#1f6feb',
    fontSize: 13,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  card: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
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
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    color: '#e06c75',
    fontSize: 13,
    fontWeight: '600'
  },
  envLabel: {
    color: '#8a8a99',
    fontSize: 11,
    marginBottom: 4
  },
  envRow: {
    marginTop: 8
  },
  envSection: {
    borderTopColor: '#2a2a33',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 10
  },
  errorText: {
    color: '#e06c75',
    fontSize: 12,
    marginTop: 6
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowMeta: {
    color: '#5a5a66',
    fontSize: 11,
    marginTop: 4
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowTitle: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  sectionHint: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 6
  },
  sectionSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    textTransform: 'uppercase'
  },
  sectionTitle: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginBottom: 12
  },
  testMessage: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 8
  }
})
