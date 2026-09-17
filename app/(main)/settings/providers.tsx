import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deleteCustomEndpoint,
  deleteEnvVar,
  disconnectOAuthProvider,
  getCustomEndpoints,
  getEnvVars,
  listOAuthProviders,
  setEnvVar
} from '../../../src/api/config'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  PROVIDERS_ACTIVE_ENDPOINT_SUFFIX,
  PROVIDERS_CLI_HINT,
  PROVIDERS_NO_CUSTOM_ENDPOINTS,
  PROVIDERS_NO_OAUTH,
  PROVIDERS_NOT_CONNECTED,
  providersDeleteEndpointConfirmTitle
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'
import type { EnvVarInfo } from '../../../src/upstream/types/hermes'

function EnvVarRow({
  entry,
  name,
  onDelete,
  onSet,
  saving
}: {
  entry: EnvVarInfo
  name: string
  onDelete: () => void
  onSet: (value: string) => void
  saving: boolean
}) {
  const tokens = useTheme()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  return (
    <View style={[styles.row, { borderBottomColor: tokens.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{name}</Text>
        <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
          {entry.description || (entry.is_set ? (entry.redacted_value ?? 'set') : 'not set')}
        </Text>
      </View>
      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            autoFocus
            onChangeText={setValue}
            placeholder="value"
            placeholderTextColor={tokens.mutedForeground}
            secureTextEntry={entry.is_password}
            style={[styles.editInput, { borderBottomColor: tokens.primary, color: tokens.foreground }]}
            value={value}
          />
          <TouchableOpacity
            disabled={saving || !value}
            hitSlop={10}
            onPress={() => {
              onSet(value)
              setEditing(false)
              setValue('')
            }}
          >
            <Text style={[styles.actionText, { color: tokens.primary }]}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.rowActions}>
          <TouchableOpacity hitSlop={10} onPress={() => setEditing(true)}>
            <Text style={[styles.actionText, { color: tokens.primary }]}>
              {entry.is_set ? t.settings.envActions.replace : t.settings.envActions.set}
            </Text>
          </TouchableOpacity>
          {entry.is_set ? (
            <TouchableOpacity hitSlop={10} onPress={onDelete} style={styles.clearButton}>
              <Text style={[styles.destructiveText, { color: tokens.destructive }]}>{t.settings.envActions.clear}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  )
}

// Replicates: docs/desktop-prototypes/a-main/settings.html's `data-view=
// "providers-accounts"`, `data-view="providers-keys"` and `data-view=
// "providers-custom"` panels (no dedicated mobile-prototype view exists for
// Providers, per the M14 mapping's desktop fallback). Section order follows
// the desktop nav rail's own Providers sub-items (Accounts, API keys,
// Custom Endpoints), so "OAuth providers" moves first and is relabelled to
// the desktop's own "Accounts" (t.settings.nav.providerAccounts) — same
// feature (provider sign-in/status), different heading. Section titles and
// the Save/Replace/Set/Clear/Disconnect/Delete action labels, and every
// confirm-dialog title, come from the vendored en.ts (D15.4) — provider
// disconnect and API-key removal reuse t.settings.providers.removeConfirm/
// t.settings.toolsets.removeConfirm rather than a hand-typed "X?" title.
// The custom-endpoint delete confirm and a handful of status/empty strings
// have no vendored counterpart at all (checked) and live in
// src/lib/strings.mobile.ts instead.
//
/**
 * Providers settings screen (M09): env-var-keyed provider credentials and
 * OpenAI-compatible custom endpoints. Provider-OAuth connect (a device-code
 * flow) is not wired here — see `src/api/config.ts`'s header — so the OAuth
 * section is status + disconnect only.
 */
export default function ProvidersSettings() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const profile = useStore($activeProfile) || undefined

  const envQuery = useQuery({ queryFn: () => getEnvVars(profile), queryKey: ['env-vars', profile] })
  const oauthQuery = useQuery({ queryFn: () => listOAuthProviders(), queryKey: ['oauth-providers'] })
  const endpointsQuery = useQuery({ queryFn: () => getCustomEndpoints(), queryKey: ['custom-endpoints'] })

  const setEnvMutation = useMutation({
    mutationFn: (args: { key: string; value: string }) => setEnvVar(args.key, args.value, profile),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['env-vars', profile] })
  })

  const deleteEnvMutation = useMutation({
    mutationFn: (key: string) => deleteEnvVar(key, profile),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['env-vars', profile] })
  })

  const disconnectMutation = useMutation({
    mutationFn: (providerId: string) => disconnectOAuthProvider(providerId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['oauth-providers'] })
  })

  const deleteEndpointMutation = useMutation({
    mutationFn: (id: string) => deleteCustomEndpoint(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['custom-endpoints'] })
  })

  const confirmDeleteEnvVar = (name: string) => {
    Alert.alert(t.settings.toolsets.removeConfirm(name), undefined, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => deleteEnvMutation.mutate(name), style: 'destructive', text: t.settings.envActions.clear }
    ])
  }

  const confirmDisconnect = (providerId: string, providerName: string) => {
    Alert.alert(t.settings.providers.removeConfirm(providerName), undefined, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => disconnectMutation.mutate(providerId),
        style: 'destructive',
        text: t.settings.providers.disconnect
      }
    ])
  }

  const confirmDeleteEndpoint = (id: string, name: string) => {
    Alert.alert(providersDeleteEndpointConfirmTitle(name), undefined, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => deleteEndpointMutation.mutate(id), style: 'destructive', text: t.common.delete }
    ])
  }

  const refreshing = envQuery.isRefetching || oauthQuery.isRefetching || endpointsQuery.isRefetching

  const onRefresh = () => {
    void envQuery.refetch()
    void oauthQuery.refetch()
    void endpointsQuery.refetch()
  }

  const envEntries = Object.entries(envQuery.data ?? {}).filter(([, entry]) => !entry.channel_managed)

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.nav.providers }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={tokens.mutedForeground} />
        }
      >
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.settings.nav.providerAccounts}</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{PROVIDERS_CLI_HINT}</Text>
        {oauthQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {oauthQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {oauthQuery.error instanceof Error ? oauthQuery.error.message : String(oauthQuery.error)}
            </Text>
            <TouchableOpacity hitSlop={10} onPress={() => void oauthQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {(oauthQuery.data?.providers ?? []).map(provider => (
          <View key={provider.id} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{provider.name}</Text>
              <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {provider.status.logged_in ? t.settings.providers.connected : PROVIDERS_NOT_CONNECTED}
              </Text>
            </View>
            {provider.status.logged_in && provider.disconnectable !== false ? (
              <TouchableOpacity hitSlop={10} onPress={() => confirmDisconnect(provider.id, provider.name)}>
                <Text style={[styles.destructiveText, { color: tokens.destructive }]}>
                  {t.settings.providers.disconnect}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        {oauthQuery.data?.providers.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{PROVIDERS_NO_OAUTH}</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.settings.nav.providerApiKeys}</Text>
        {envQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {envQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {envQuery.error instanceof Error ? envQuery.error.message : String(envQuery.error)}
            </Text>
            <TouchableOpacity hitSlop={10} onPress={() => void envQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {envEntries.map(([name, entry]) => (
          <EnvVarRow
            entry={entry}
            key={name}
            name={name}
            onDelete={() => confirmDeleteEnvVar(name)}
            onSet={value => setEnvMutation.mutate({ key: name, value })}
            saving={setEnvMutation.isPending}
          />
        ))}
        {envQuery.data && envEntries.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
            {t.settings.providers.noProviderKeys}
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>
          {t.settings.nav.providerCustomEndpoints}
        </Text>
        {endpointsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {endpointsQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {endpointsQuery.error instanceof Error ? endpointsQuery.error.message : String(endpointsQuery.error)}
            </Text>
            <TouchableOpacity hitSlop={10} onPress={() => void endpointsQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {(endpointsQuery.data?.endpoints ?? []).map(endpoint => (
          <View key={endpoint.id} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>
                {endpoint.name}
                {endpoint.is_current ? ` ${PROVIDERS_ACTIVE_ENDPOINT_SUFFIX}` : ''}
              </Text>
              <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {endpoint.base_url} · {endpoint.model}
              </Text>
            </View>
            <TouchableOpacity hitSlop={10} onPress={() => confirmDeleteEndpoint(endpoint.id, endpoint.name)}>
              <Text style={[styles.destructiveText, { color: tokens.destructive }]}>{t.common.delete}</Text>
            </TouchableOpacity>
          </View>
        ))}
        {endpointsQuery.data?.endpoints.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{PROVIDERS_NO_CUSTOM_ENDPOINTS}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionText: {
    ...type.label,
    fontWeight: '600'
  },
  clearButton: {
    marginLeft: 12
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
  editInput: {
    ...type.label,
    borderBottomWidth: 1,
    flex: 1,
    marginRight: 10,
    paddingVertical: 2
  },
  editRow: {
    alignItems: 'center',
    flexDirection: 'row',
    width: 180
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 6
  },
  retryText: {
    ...type.label,
    fontWeight: '600'
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  rowActions: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  errorText: {
    ...type.caption,
    marginBottom: 8
  },
  rowText: {
    flex: 1,
    paddingRight: 12
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 6
  },
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  }
})
