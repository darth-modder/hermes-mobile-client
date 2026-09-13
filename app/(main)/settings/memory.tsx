import { Stack } from 'expo-router'
import { Fragment } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { MEMORY_FIELDS, MEMORY_NOT_AVAILABLE } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="memory"` panel (Memory, User Profile, Memory Provider, Context
// Engine, Auto-Compression, Compression Threshold) — listed below as
// read-only rows (2026-09-12 review: "the screen should teach what lives
// there, not just apologise"), not only the notice this screen originally
// shipped with alone (see MEMORY_FIELDS's own comment in strings.mobile.ts
// for why these use the desktop's literal field text rather than a vendored
// path). Every row here is either a config.yaml-schema field (the desktop's
// generic config editor, src/api/config.ts's header already decided isn't
// ported to mobile) or one of the memory/curator endpoints src/api/
// system.ts's header explicitly left unported: "getMemoryStatus/
// resetMemory/getCuratorStatus/setCuratorPaused/runCurator/
// getMemoryProviderConfig/saveMemoryProviderConfig/startMemoryProviderOAuth/
// getMemoryProviderOAuthStatus ... have no named M09 sub-screen". Adding
// that API surface is data-fetching/mutation work, out of scope for a
// layout pass (models.tsx and appearance.tsx already drew this line for
// their own gaps), so nothing below is interactive.
export default function MemorySettings() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.sections.memory }} />
      <ScrollView contentContainerStyle={styles.content}>
        {MEMORY_FIELDS.map((field, index) => (
          <Fragment key={field.title}>
            <ListRow subtitle={field.description} title={field.title} />
            {index < MEMORY_FIELDS.length - 1 ? <ListRowSeparator /> : null}
          </Fragment>
        ))}
        <Text style={[styles.notice, { color: tokens.mutedForeground }]}>{MEMORY_NOT_AVAILABLE}</Text>
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
  notice: {
    ...type.bodySmall,
    marginTop: 16
  }
})
