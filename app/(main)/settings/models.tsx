import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getGlobalModelInfo, getGlobalModelOptions, setGlobalModel } from '../../../src/api/models'
import { getToolsets, setToolsetEnabled } from '../../../src/api/toolsets'
import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'
import { $activeProfile } from '../../../src/store/profile'
import type { ModelOptionProvider, ToolsetInfo } from '../../../src/upstream/types/hermes'

/**
 * Models settings screen (M09). Exit criterion: "a model switch is
 * reflected in the next `session.info`" — this screen only owns the switch
 * (`setGlobalModel`, scope: 'main'); the chat screen's `session.info`
 * handling (M06/M07, `src/gateway/session-stream/session-info.ts`) already
 * surfaces whatever the backend reports, unchanged by this milestone.
 */
export default function ModelsSettings() {
  const queryClient = useQueryClient()
  const profile = useStore($activeProfile) || undefined

  const infoQuery = useQuery({
    queryFn: () => getGlobalModelInfo(profile),
    queryKey: ['model-info', profile]
  })

  const optionsQuery = useQuery({
    queryFn: () => getGlobalModelOptions({ includeUnconfigured: false }, profile),
    queryKey: ['model-options', profile]
  })

  const toolsetsQuery = useQuery({
    queryFn: () => getToolsets(profile),
    queryKey: ['toolsets', profile]
  })

  const setModelMutation = useMutation({
    mutationFn: (args: { model: string; provider: string }) => setGlobalModel(args.provider, args.model, profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['model-info', profile] })
    }
  })

  const toggleToolsetMutation = useMutation({
    mutationFn: (args: { enabled: boolean; name: string }) => setToolsetEnabled(args.name, args.enabled, profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['toolsets', profile] })
    }
  })

  const current = infoQuery.data

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Models' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Current model</Text>
        {infoQuery.isLoading ? (
          <ActivityIndicator color="#8a8a99" />
        ) : current ? (
          <Text style={styles.currentModel}>
            {current.provider} · {current.model}
          </Text>
        ) : (
          <Text style={styles.errorText}>{String(infoQuery.error)}</Text>
        )}
        {setModelMutation.isPending ? <Text style={styles.pendingText}>Switching…</Text> : null}
        {setModelMutation.isError ? <Text style={styles.errorText}>{String(setModelMutation.error)}</Text> : null}

        <Text style={styles.sectionTitle}>Choose a model</Text>
        {optionsQuery.isLoading ? <ActivityIndicator color="#8a8a99" /> : null}
        {optionsQuery.isError ? (
          <Text style={styles.errorText}>
            {optionsQuery.error instanceof Error ? optionsQuery.error.message : String(optionsQuery.error)}
          </Text>
        ) : null}
        {(optionsQuery.data?.providers ?? []).map((provider: ModelOptionProvider) => (
          <View key={provider.slug} style={styles.providerBlock}>
            <Text style={styles.providerName}>
              {provider.name}
              {provider.authenticated === false ? ' (not configured)' : ''}
            </Text>
            {(provider.featured_models?.length ? provider.featured_models : (provider.models ?? []).slice(0, 6)).map(
              model => {
                const isCurrent = current?.provider === provider.slug && current.model === model

                return (
                  <TouchableOpacity
                    disabled={provider.authenticated === false}
                    key={model}
                    onPress={() => setModelMutation.mutate({ model, provider: provider.slug })}
                    style={[styles.modelRow, isCurrent ? styles.modelRowActive : null]}
                  >
                    <Text style={styles.modelName}>{model}</Text>
                    {isCurrent ? <Text style={styles.checkmark}>✓</Text> : null}
                  </TouchableOpacity>
                )
              }
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Toolsets</Text>
        <Text style={styles.sectionHint}>
          Enable or disable a whole tool group. Per-tool provider setup is not on mobile yet.
        </Text>
        {toolsetsQuery.isLoading ? <ActivityIndicator color="#8a8a99" /> : null}
        {toolsetsQuery.isError ? (
          <Text style={styles.errorText}>
            {toolsetsQuery.error instanceof Error ? toolsetsQuery.error.message : String(toolsetsQuery.error)}
          </Text>
        ) : null}
        {(toolsetsQuery.data ?? []).map((toolset: ToolsetInfo) => (
          <View key={toolset.name} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{toolset.label}</Text>
              <Text numberOfLines={1} style={styles.rowSubtitle}>
                {toolset.description}
              </Text>
            </View>
            <Switch
              onValueChange={value => toggleToolsetMutation.mutate({ enabled: value, name: toolset.name })}
              value={toolset.enabled}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  checkmark: {
    color: '#3fb950',
    fontSize: 15,
    fontWeight: '700'
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    padding: 16
  },
  currentModel: {
    color: '#f2f2f5',
    fontSize: 16,
    fontWeight: '700'
  },
  errorText: {
    color: '#e06c75',
    fontSize: 12,
    marginTop: 4
  },
  modelName: {
    color: '#f2f2f5',
    fontSize: 13
  },
  modelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  modelRowActive: {
    opacity: 1
  },
  pendingText: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 4
  },
  providerBlock: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  providerName: {
    color: '#8a8a99',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#17171d',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowText: {
    flex: 1,
    paddingRight: 12
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
  sectionTitle: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  }
})
