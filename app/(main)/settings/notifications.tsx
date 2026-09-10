import { useStore } from '@nanostores/react'
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  $nativeNotifyPrefs,
  NATIVE_NOTIFICATION_KINDS,
  type NativeNotificationKind,
  setNativeNotifyEnabled,
  setNativeNotifyKind
} from '../../../src/push/native-notifications'
import { $pushEnabled, setPushEnabled } from '../../../src/push/settings'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

const KIND_LABELS: Record<NativeNotificationKind, string> = {
  approval: 'Approval requests',
  backgroundDone: 'Background turns finished',
  credits: 'Credit warnings',
  input: 'Clarify requests',
  plugin: 'Plugin notifications',
  turnDone: 'Turns finished',
  turnError: 'Turn errors'
}

function Row({ children, label }: { children: React.ReactNode; label: string }) {
  const tokens = useTheme()

  return (
    <View style={[styles.row, { borderBottomColor: tokens.border }]}>
      <Text style={[styles.rowLabel, { color: tokens.foreground }]}>{label}</Text>
      {children}
    </View>
  )
}

export default function NotificationsSettings() {
  const tokens = useTheme()
  const pushEnabled = useStore($pushEnabled)
  const localPrefs = useStore($nativeNotifyPrefs)

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Notifications' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Push notifications</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Delivered by the server when this device is backgrounded — never while the app is open. Requires an
          EAS-published build and a server with the hermes-push plugin installed.
        </Text>
        <Row label="Enable push">
          <Switch onValueChange={setPushEnabled} value={pushEnabled} />
        </Row>

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>In-app notifications</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Shown locally while the app is running, for events on other sessions.
        </Text>
        <Row label="Enable in-app notifications">
          <Switch onValueChange={setNativeNotifyEnabled} value={localPrefs.enabled} />
        </Row>
        {NATIVE_NOTIFICATION_KINDS.map(kind => (
          <Row key={kind} label={KIND_LABELS[kind]}>
            <Switch
              disabled={!localPrefs.enabled}
              onValueChange={value => setNativeNotifyKind(kind, value)}
              value={localPrefs.kinds[kind]}
            />
          </Row>
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
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  rowLabel: {
    ...type.body
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 8
  },
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  }
})
