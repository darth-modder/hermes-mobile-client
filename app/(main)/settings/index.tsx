import { useStore } from '@nanostores/react'
import { type Href, Stack, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getActiveConnection } from '../../../src/connections/registry'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'

interface SettingsRow {
  route: Href
  title: string
  subtitle: string
}

// Machine-bound settings (local models, terminal backend, pool limits,
// updates) are not rows here at all — AGENTS.md "Machine features don't
// exist here" — rather than a row that opens to an empty/disabled screen.
const ROWS: SettingsRow[] = [
  { route: '/(main)/settings/connections', subtitle: 'Add, edit, test, switch, delete', title: 'Connections' },
  { route: '/(main)/settings/profiles', subtitle: 'Switch or create a profile', title: 'Profiles' },
  { route: '/(main)/settings/providers', subtitle: 'API keys, custom endpoints', title: 'Providers' },
  { route: '/(main)/settings/models', subtitle: 'Main model, auxiliary tasks, toolsets', title: 'Models' },
  { route: '/(main)/settings/mcp', subtitle: 'Add, test, enable MCP servers', title: 'MCP' },
  { route: '/(main)/settings/appearance', subtitle: 'Skin and light/dark mode', title: 'Appearance' },
  { route: '/(main)/settings/skills', subtitle: 'Enable, install, uninstall', title: 'Skills' },
  { route: '/(main)/settings/plugins', subtitle: 'Installed plugin dashboards', title: 'Plugins' },
  { route: '/(main)/settings/notifications', subtitle: 'Push and in-app alerts', title: 'Notifications' },
  { route: '/(main)/settings/voice', subtitle: 'Dictation and spoken replies', title: 'Voice' }
]

export default function SettingsIndex() {
  const tokens = useTheme()
  const router = useRouter()
  const connection = getActiveConnection()
  const activeProfile = useStore($activeProfile)

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Settings' }} />
      <View style={[styles.summary, { borderBottomColor: tokens.border }]}>
        <Text style={[styles.summaryLabel, { color: tokens.textTertiary }]}>Connected to</Text>
        <Text numberOfLines={1} style={[styles.summaryValue, { color: tokens.foreground }]}>
          {connection ? connection.label || connection.baseUrl : 'No active connection'}
        </Text>
        {activeProfile ? (
          <Text style={[styles.summaryProfile, { color: tokens.mutedForeground }]}>Profile: {activeProfile}</Text>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {ROWS.map(row => (
          <TouchableOpacity
            key={row.title}
            onPress={() => router.push(row.route)}
            style={[styles.row, { borderBottomColor: tokens.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{row.title}</Text>
              <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>{row.subtitle}</Text>
            </View>
            <Text style={[styles.chevron, { color: tokens.textTertiary }]}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 20
  },
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 32
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  summary: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  summaryLabel: {
    fontSize: 11,
    textTransform: 'uppercase'
  },
  summaryProfile: {
    fontSize: 12,
    marginTop: 2
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2
  }
})
