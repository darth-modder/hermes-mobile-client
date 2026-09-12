import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { SAFETY_NOT_AVAILABLE } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="safety"` panel (Approval Mode, Approval Timeout, Confirm MCP
// Reloads, Command Allowlist, Redact Secrets, Allow Private URLs, File
// Checkpoints). Every one of those rows is a config.yaml-schema field the
// desktop autosaves through its generic config editor — src/api/config.ts's
// header already decided that editor isn't ported to mobile. Approval mode
// specifically has no live mirror to fall back to as a read-only display
// either: src/gateway/session-stream/session-info.ts's header lists
// "approval_mode reconciliation (profile-scoped desktop settings sync)"
// among what was deliberately dropped porting the desktop's session-info
// handler, so there is nothing this app currently receives to show, even
// without a write path. M14 is layout-only and may not invent new backend
// API surface (models.tsx and appearance.tsx already drew this line for
// their own gaps), so this screen has no real content to show and says so
// instead of faking a row.
export default function SafetySettings() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.sections.safety }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.notice, { color: tokens.mutedForeground }]}>{SAFETY_NOT_AVAILABLE}</Text>
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
