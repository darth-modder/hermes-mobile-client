import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { listInstalledPlugins } from '../../../src/api/plugins'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

/**
 * Plugins settings screen (M09): list-only, per `src/api/plugins.ts`'s
 * header — a plugin's own dashboard page (desktop: an embedded web view) has
 * no mobile equivalent yet. Push notification settings live under
 * "Notifications" (M11), not here, even though hermes-push is itself a
 * plugin.
 */
export default function PluginsSettings() {
  const tokens = useTheme()
  const pluginsQuery = useQuery({ queryFn: () => listInstalledPlugins(), queryKey: ['installed-plugins'] })

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Plugins' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void pluginsQuery.refetch()}
            refreshing={pluginsQuery.isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Plugins installed on the backend. Per-plugin dashboards (a plugin's own web UI) aren&apos;t available on
          mobile yet — install and configure a plugin from the desktop app or CLI.
        </Text>
        {pluginsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {pluginsQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {pluginsQuery.error instanceof Error ? pluginsQuery.error.message : String(pluginsQuery.error)}
            </Text>
            <TouchableOpacity onPress={() => void pluginsQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {(pluginsQuery.data ?? []).map(plugin => (
          <View key={plugin.name} style={[styles.row, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{plugin.label || plugin.name}</Text>
            {plugin.description ? (
              <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>{plugin.description}</Text>
            ) : null}
            <Text style={[styles.rowMeta, { color: tokens.textTertiary }]}>
              {plugin.name}
              {plugin.version ? ` · v${plugin.version}` : ''}
              {plugin.source ? ` · ${plugin.source}` : ''}
            </Text>
          </View>
        ))}
        {pluginsQuery.data?.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No plugins installed.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  errorText: {
    ...type.label,
    marginTop: 8
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
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
  },
  rowMeta: {
    ...type.caption,
    marginTop: 4
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 12
  }
})
