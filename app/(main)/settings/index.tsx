import { useStore } from '@nanostores/react'
import { type Href, Stack, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getActiveConnection } from '../../../src/connections/registry'
import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'
import { $activeProfile } from '../../../src/store/profile'

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
  { route: '/(main)/settings/skills', subtitle: 'Enable, install, uninstall', title: 'Skills' },
  { route: '/(main)/settings/plugins', subtitle: 'Installed plugin dashboards', title: 'Plugins' },
  { route: '/(main)/settings/notifications', subtitle: 'Push and in-app alerts', title: 'Notifications' },
  { route: '/(main)/settings/voice', subtitle: 'Dictation and spoken replies', title: 'Voice' }
]

export default function SettingsIndex() {
  const router = useRouter()
  const connection = getActiveConnection()
  const activeProfile = useStore($activeProfile)

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Settings' }} />
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Connected to</Text>
        <Text numberOfLines={1} style={styles.summaryValue}>
          {connection ? connection.label || connection.baseUrl : 'No active connection'}
        </Text>
        {activeProfile ? <Text style={styles.summaryProfile}>Profile: {activeProfile}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {ROWS.map(row => (
          <TouchableOpacity key={row.title} onPress={() => router.push(row.route)} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  chevron: {
    color: '#5a5a66',
    fontSize: 20
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    paddingBottom: 32
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#17171d',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    color: '#f2f2f5',
    fontSize: 15,
    fontWeight: '600'
  },
  summary: {
    borderBottomColor: '#17171d',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  summaryLabel: {
    color: '#5a5a66',
    fontSize: 11,
    textTransform: 'uppercase'
  },
  summaryProfile: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  summaryValue: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2
  }
})
