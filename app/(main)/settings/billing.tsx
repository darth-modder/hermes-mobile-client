import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { BILLING_NOT_AVAILABLE } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="billing"` panel (plan summary, usage meters, "Change plan").
// This app has no billing/credits API at all: past the mid-turn "out of
// credits" wall carried on the message stream (BillingBlock,
// src/upstream/lib/chat-messages/types.ts — present only while a turn is
// actively blocked, never queryable on its own outside that moment), there
// is no endpoint to read a plan, payment method, or usage from. The
// desktop's billing/index.tsx polls a dedicated REST route every 30s that
// has no mobile port (src/api/config.ts's header already draws this line
// for the sibling raw-config surface). Adding a billing-status endpoint is
// new backend API surface, out of scope for a layout pass — this screen has
// no real content to show and says so instead of faking a plan or a usage
// bar.
export default function BillingSettings() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.nav.billing }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.notice, { color: tokens.mutedForeground }]}>{BILLING_NOT_AVAILABLE}</Text>
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
