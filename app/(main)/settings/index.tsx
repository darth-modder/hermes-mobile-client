import { useStore } from '@nanostores/react'
import { type Href, Stack, useRouter } from 'expo-router'
import { Fragment } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SETTINGS_GROUPS } from '../../../src/components/settings-rows'
import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import { getActiveConnection } from '../../../src/connections/registry'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/mobile-prototypes/settings.html's `data-view="index"`
// (list rows, group labels), with the group order/row set as
// settings-rows.ts describes; row labels also draw on
// docs/desktop-prototypes/a-main/settings.html's nav rail via the vendored
// en.ts (src/lib/t.ts).
//
// Machine-bound settings (local models, terminal backend, pool limits,
// updates) are not rows here at all — AGENTS.md "Machine features don't
// exist here" — rather than a row that opens to an empty/disabled screen.
//
// Group/route/title data lives in ../../../src/components/settings-rows.ts
// (pure, no react-native import — see that file's header for the grouping
// rationale and the open D-entry question on group order).
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
        {SETTINGS_GROUPS.map(group => (
          <Fragment key={group.label}>
            <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{group.label}</Text>
            {group.rows.map((row, index) => (
              <Fragment key={row.route}>
                <ListRow onPress={() => router.push(row.route as Href)} subtitle={row.subtitle} title={row.title} />
                {index < group.rows.length - 1 ? <ListRowSeparator /> : null}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 32
  },
  sectionLabel: {
    ...type.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: 'uppercase'
  },
  summary: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  summaryLabel: {
    ...type.caption,
    textTransform: 'uppercase'
  },
  summaryProfile: {
    ...type.caption,
    marginTop: 2
  },
  summaryValue: {
    ...type.bodySmall,
    fontWeight: '600',
    marginTop: 2
  }
})
