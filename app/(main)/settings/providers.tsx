import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
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
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
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
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.actionText, { color: tokens.primary }]}>{entry.is_set ? 'Change' : 'Set'}</Text>
          </TouchableOpacity>
          {entry.is_set ? (
            <TouchableOpacity onPress={onDelete} style={styles.clearButton}>
              <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  )
}

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

  const envEntries = Object.entries(envQuery.data ?? {}).filter(([, entry]) => !entry.channel_managed)

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Providers' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>API keys</Text>
        {envQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {envQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {envQuery.error instanceof Error ? envQuery.error.message : String(envQuery.error)}
          </Text>
        ) : null}
        {envEntries.map(([name, entry]) => (
          <EnvVarRow
            entry={entry}
            key={name}
            name={name}
            onDelete={() => deleteEnvMutation.mutate(name)}
            onSet={value => setEnvMutation.mutate({ key: name, value })}
            saving={setEnvMutation.isPending}
          />
        ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>OAuth providers</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Connecting a new provider needs the CLI (`hermes model`) for now.
        </Text>
        {oauthQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {oauthQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {oauthQuery.error instanceof Error ? oauthQuery.error.message : String(oauthQuery.error)}
          </Text>
        ) : null}
        {(oauthQuery.data?.providers ?? []).map(provider => (
          <View key={provider.id} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{provider.name}</Text>
              <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {provider.status.logged_in ? 'Connected' : 'Not connected'}
              </Text>
            </View>
            {provider.status.logged_in && provider.disconnectable !== false ? (
              <TouchableOpacity onPress={() => disconnectMutation.mutate(provider.id)}>
                <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Disconnect</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Custom endpoints</Text>
        {endpointsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {endpointsQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {endpointsQuery.error instanceof Error ? endpointsQuery.error.message : String(endpointsQuery.error)}
          </Text>
        ) : null}
        {(endpointsQuery.data?.endpoints ?? []).map(endpoint => (
          <View key={endpoint.id} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>
                {endpoint.name}
                {endpoint.is_current ? ' (active)' : ''}
              </Text>
              <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {endpoint.base_url} · {endpoint.model}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deleteEndpointMutation.mutate(endpoint.id)}>
              <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
        {endpointsQuery.data?.endpoints.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No custom endpoints configured.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionText: {
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '600'
  },
  editInput: {
    borderBottomWidth: 1,
    flex: 1,
    fontSize: 13,
    marginRight: 10,
    paddingVertical: 2
  },
  editRow: {
    alignItems: 'center',
    flexDirection: 'row',
    width: 180
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
    fontSize: 12,
    marginTop: 2
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8
  },
  rowText: {
    flex: 1,
    paddingRight: 12
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 6
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  }
})
