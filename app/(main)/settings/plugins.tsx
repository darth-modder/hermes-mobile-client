import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { listInstalledPlugins } from '../../../src/api/plugins'
import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'

/**
 * Plugins settings screen (M09): list-only, per `src/api/plugins.ts`'s
 * header — a plugin's own dashboard page (desktop: an embedded web view) has
 * no mobile equivalent yet. Push notification settings live under
 * "Notifications" (M11), not here, even though hermes-push is itself a
 * plugin.
 */
export default function PluginsSettings() {
  const pluginsQuery = useQuery({ queryFn: () => listInstalledPlugins(), queryKey: ['installed-plugins'] })

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Plugins' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHint}>
          Plugins installed on the backend. Per-plugin dashboards (a plugin's own web UI) aren&apos;t available on
          mobile yet — install and configure a plugin from the desktop app or CLI.
        </Text>
        {pluginsQuery.isLoading ? <ActivityIndicator color="#8a8a99" /> : null}
        {pluginsQuery.isError ? (
          <Text style={styles.errorText}>
            {pluginsQuery.error instanceof Error ? pluginsQuery.error.message : String(pluginsQuery.error)}
          </Text>
        ) : null}
        {(pluginsQuery.data ?? []).map(plugin => (
          <View key={plugin.name} style={styles.row}>
            <Text style={styles.rowTitle}>{plugin.label || plugin.name}</Text>
            {plugin.description ? <Text style={styles.rowSubtitle}>{plugin.description}</Text> : null}
            <Text style={styles.rowMeta}>
              {plugin.name}
              {plugin.version ? ` · v${plugin.version}` : ''}
              {plugin.source ? ` · ${plugin.source}` : ''}
            </Text>
          </View>
        ))}
        {pluginsQuery.data?.length === 0 ? <Text style={styles.sectionHint}>No plugins installed.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    padding: 16
  },
  errorText: {
    color: '#e06c75',
    fontSize: 13,
    marginTop: 8
  },
  row: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
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
    marginBottom: 12
  }
})
