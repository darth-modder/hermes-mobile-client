import { Stack } from 'expo-router'
import { Fragment } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { SAFETY_FIELDS, SAFETY_NOT_AVAILABLE } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="safety"` panel (Approval Mode, Approval Timeout, Confirm MCP
// Reloads, Command Allowlist, Redact Secrets, Allow Private URLs, File
// Checkpoints) — listed below as read-only rows (2026-09-12 review: "the
// screen should teach what lives there, not just apologise"), not only the
// notice this screen originally shipped with alone (see SAFETY_FIELDS's own
// comment in strings.mobile.ts for why these use the desktop's literal
// field text rather than a vendored path). Every one of those rows is a
// config.yaml-schema field the desktop autosaves through its generic config
// editor — src/api/config.ts's header already decided that editor isn't
// ported to mobile. Approval mode specifically has no live mirror to fall
// back to as a read-only display either: src/gateway/session-stream/
// session-info.ts's header lists "approval_mode reconciliation (profile-
// scoped desktop settings sync)" among what was deliberately dropped
// porting the desktop's session-info handler, so there is nothing this app
// currently receives to show, even without a write path. M14 is
// layout-only and may not invent new backend API surface (models.tsx and
// appearance.tsx already drew this line for their own gaps), so nothing
// below is interactive.
export default function SafetySettings() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.sections.safety }} />
      <ScrollView contentContainerStyle={styles.content}>
        {SAFETY_FIELDS.map((field, index) => (
          <Fragment key={field.title}>
            <ListRow subtitle={field.description} title={field.title} />
            {index < SAFETY_FIELDS.length - 1 ? <ListRowSeparator /> : null}
          </Fragment>
        ))}
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
    ...type.bodySmall,
    marginTop: 16
  }
})
