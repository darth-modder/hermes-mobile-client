import { useStore } from '@nanostores/react'
import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  NOTIFICATIONS_IN_APP_HINT,
  NOTIFICATIONS_IN_APP_SECTION_TITLE,
  NOTIFICATIONS_PERMISSION_BLOCKED_HINT,
  NOTIFICATIONS_PERMISSION_ENABLE_ACTION,
  NOTIFICATIONS_PERMISSION_GRANTED,
  NOTIFICATIONS_PERMISSION_LABEL,
  NOTIFICATIONS_PERMISSION_NOT_GRANTED,
  NOTIFICATIONS_PERMISSION_OPEN_SETTINGS_ACTION,
  NOTIFICATIONS_PUSH_HINT,
  NOTIFICATIONS_PUSH_SECTION_TITLE
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import {
  $nativeNotifyPrefs,
  NATIVE_NOTIFICATION_KINDS,
  type NativeNotificationKind,
  setNativeNotifyEnabled,
  setNativeNotifyKind
} from '../../../src/push/native-notifications'
import {
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
  requestNotificationPermission
} from '../../../src/push/notification-permission'
import { $pushEnabled, setPushEnabled } from '../../../src/push/settings'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// The event categories (approval / input / turnDone / turnError /
// backgroundDone / credits / plugin) are the same ones the desktop's own
// Notifications panel lists (docs/desktop-prototypes/a-main/settings.html's
// `data-view="notifications"`) — same labels and descriptions apply
// whichever delivery path (push vs in-app) fires them here, so this reuses
// t.settings.notifications.kinds rather than retyping them (D15.4).
const KIND_META: Record<NativeNotificationKind, { description: string; label: string }> = t.settings.notifications.kinds

function Row({ children, description, label }: { children: React.ReactNode; description?: string; label: string }) {
  const tokens = useTheme()

  return (
    <View style={[styles.row, { borderBottomColor: tokens.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tokens.foreground }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: tokens.mutedForeground }]}>{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  )
}

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="notifications"` panel (master toggle, per-kind list rows with
// descriptions). The desktop has one notifications concept; this app splits
// it into Push (server-delivered while backgrounded, M11) and In-app
// (shown locally while the app is running) because only one of those needs
// an EAS-published build — an existing, accepted mobile adaptation, not
// changed here. The desktop's "Send test notification" button and
// "Completion Sound" picker/preview aren't implemented: both need new
// wiring (a test-dispatch call, a sound-preset picker with audio preview)
// that doesn't exist in src/push/*, out of scope for a layout-only pass.
export default function NotificationsSettings() {
  const tokens = useTheme()
  const pushEnabled = useStore($pushEnabled)
  const localPrefs = useStore($nativeNotifyPrefs)
  const [permission, setPermission] = useState<NotificationPermissionStatus | null>(null)

  useEffect(() => {
    const refresh = () => void getNotificationPermissionStatus().then(setPermission)

    refresh()

    // The user can grant/revoke in system settings without this screen
    // remounting — re-check whenever the app comes back to the foreground,
    // the same way it would have to notice any other OS-level change.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh()
      }
    })

    return () => subscription.remove()
  }, [])

  const onRequestPermission = () => {
    if (permission && !permission.canAskAgain) {
      void Linking.openSettings()

      return
    }

    void requestNotificationPermission().then(setPermission)
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.notifications.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Row
          description={
            permission?.status === 'granted'
              ? undefined
              : permission && !permission.canAskAgain
                ? NOTIFICATIONS_PERMISSION_BLOCKED_HINT
                : NOTIFICATIONS_PERMISSION_NOT_GRANTED
          }
          label={NOTIFICATIONS_PERMISSION_LABEL}
        >
          {permission?.status === 'granted' ? (
            <Text style={[styles.rowLabel, { color: tokens.mutedForeground }]}>{NOTIFICATIONS_PERMISSION_GRANTED}</Text>
          ) : (
            <TouchableOpacity onPress={onRequestPermission}>
              <Text style={[styles.rowLabel, { color: tokens.primary }]}>
                {permission && !permission.canAskAgain
                  ? NOTIFICATIONS_PERMISSION_OPEN_SETTINGS_ACTION
                  : NOTIFICATIONS_PERMISSION_ENABLE_ACTION}
              </Text>
            </TouchableOpacity>
          )}
        </Row>

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{NOTIFICATIONS_PUSH_SECTION_TITLE}</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{NOTIFICATIONS_PUSH_HINT}</Text>
        <Row label={t.settings.notifications.enableAll}>
          <Switch onValueChange={setPushEnabled} value={pushEnabled} />
        </Row>

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{NOTIFICATIONS_IN_APP_SECTION_TITLE}</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{NOTIFICATIONS_IN_APP_HINT}</Text>
        <Row description={t.settings.notifications.enableAllDesc} label={t.settings.notifications.enableAll}>
          <Switch onValueChange={setNativeNotifyEnabled} value={localPrefs.enabled} />
        </Row>
        {NATIVE_NOTIFICATION_KINDS.map(kind => (
          <Row description={KIND_META[kind].description} key={kind} label={KIND_META[kind].label}>
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
  rowDescription: {
    ...type.caption,
    marginTop: 2
  },
  rowLabel: {
    ...type.body
  },
  rowText: {
    flex: 1,
    paddingRight: 12
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
