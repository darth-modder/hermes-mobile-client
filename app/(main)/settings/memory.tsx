import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { MEMORY_NOT_AVAILABLE } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="memory"` panel (Memory, User Profile, Memory Provider, Context
// Engine, Auto-Compression, Compression Threshold). Every row here is either
// a config.yaml-schema field (the desktop's generic config editor,
// src/api/config.ts's header already decided isn't ported to mobile) or one
// of the memory/curator endpoints src/api/system.ts's header explicitly left
// unported: "getMemoryStatus/resetMemory/getCuratorStatus/setCuratorPaused/
// runCurator/getMemoryProviderConfig/saveMemoryProviderConfig/
// startMemoryProviderOAuth/getMemoryProviderOAuthStatus ... have no named M09
// sub-screen". Adding that API surface is data-fetching/mutation work, out
// of scope for a layout pass (models.tsx and appearance.tsx already drew
// this line for their own gaps), so this screen has no real content to show
// and says so instead of faking a row.
export default function MemorySettings() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.sections.memory }} />
      <ScrollView contentContainerStyle={styles.content}>
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
    ...type.bodySmall
  }
})
