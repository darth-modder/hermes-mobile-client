import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { CHAT_NOT_AVAILABLE } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="chat"` panel (Personality, Timezone, Show Reasoning, Image
// Input Mode). None of those four rows has a mobile-compatible data layer:
// they're config.yaml-schema fields the desktop autosaves through its
// generic config editor, and src/api/config.ts's own header already decided
// that schema-driven editor isn't ported to mobile ("out — the named
// 'providers' screen is env-vars and custom endpoints, not a schema-driven
// config editor"). Two more settings that conceptually belong on this
// screen per the M14 mapping — "Collapse thinking by default" and "Message
// Reactions" (docs/desktop-prototypes/a-main/settings.html's
// `data-view="appearance"`, vendored as t.settings.appearance.
// reasoningCollapsedTitle/reactionsTitle, flagged in appearance.tsx's own
// Replicates comment as belonging here) — have no local preference store to
// read or write either. M14 is layout-only and may not invent new backend
// API surface or new persisted-preference plumbing (models.tsx and
// appearance.tsx already drew this line for their own gaps), so this screen
// has no real content to show and says so instead of faking a row.
export default function ChatSettings() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.sections.chat }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.notice, { color: tokens.mutedForeground }]}>{CHAT_NOT_AVAILABLE}</Text>
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
