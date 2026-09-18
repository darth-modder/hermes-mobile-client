import { useQuery } from '@tanstack/react-query'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getStatus } from '../../../src/api/config'
import { getActiveConnection } from '../../../src/connections/registry'
import { UNAFFILIATED_NOTICE } from '../../../src/lib/app-identity'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  ABOUT_HOST_SECTION_TITLE,
  aboutBuildSuffix,
  CONNECTION_NEVER_USED_SUFFIX,
  NO_ACTIVE_CONNECTION
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

function relativeTime(epochMs: number): string {
  const minutes = Math.floor((Date.now() - epochMs) / 60_000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

// Replicates: docs/mobile-prototypes/settings.html's `data-view="about"`
// (identity row, Host section) — the mobile prototype's own dedicated view
// for this screen, so it wins over the desktop's about-settings.tsx panel
// per the M14 mapping's usual mobile-prototype-first rule. Two things from
// that view are deliberately left out:
//  - The "Hermes Mobile is a control surface..." host-authority paragraph:
//    the prototype's own header comment tags this exact copy `Field:` for
//    the settings index, and M14 holds every `Field:`-tagged block for M15
//    regardless of which screen repeats it.
//  - Updates / Support (Check for updates, Release notes, Gateway
//    connection guide, Copy setup checklist, Send diagnostics, Licences):
//    none has real data behind it on this app today — no `expo-updates`
//    dependency (checked package.json) for the first two, no diagnostics
//    upload endpoint wired (t.sendDiagnostics exists but nothing in
//    src/api/ calls it), and no clipboard package installed for "Copy
//    setup checklist". Adding any of these is new capability, not layout.
// What IS real: the app's own version/build (`expo-constants`, no
// backend call, formatted with the vendored t.settings.about.version/
// versionUnavailable) and the active connection's gateway version
// (t.shell.statusbar.backendVersion) and status (`getStatus`,
// src/api/config.ts — unused anywhere else in this app until now, but an
// existing, working REST call, not new API surface).
export default function AboutSettings() {
  const tokens = useTheme()
  const connection = getActiveConnection()

  const statusQuery = useQuery({
    enabled: !!connection,
    queryFn: () => getStatus(),
    queryKey: ['status', connection?.id]
  })

  const version = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null
  const build = Constants.nativeBuildVersion ?? null

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.nav.about }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Text style={[styles.appName, { color: tokens.foreground }]}>{Constants.expoConfig?.name ?? 'Hermes'}</Text>
          <Text style={[styles.version, { color: tokens.mutedForeground }]}>
            {version
              ? `${t.settings.about.version(version)}${build ? aboutBuildSuffix(build) : ''}`
              : t.settings.about.versionUnavailable}
          </Text>
          <Text style={[styles.unaffiliatedNotice, { color: tokens.mutedForeground }]}>{UNAFFILIATED_NOTICE}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: tokens.mutedForeground }]}>{ABOUT_HOST_SECTION_TITLE}</Text>
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text numberOfLines={1} style={[styles.hostTitle, { color: tokens.foreground }]}>
            {connection ? connection.label || connection.baseUrl : NO_ACTIVE_CONNECTION}
          </Text>
          {connection ? (
            statusQuery.isLoading ? (
              <ActivityIndicator color={tokens.mutedForeground} style={styles.hostStatusSpinner} />
            ) : statusQuery.isError ? (
              <Text style={[styles.hostStatus, { color: tokens.destructive }]}>
                {statusQuery.error instanceof Error ? statusQuery.error.message : String(statusQuery.error)}
              </Text>
            ) : statusQuery.data ? (
              <Text style={[styles.hostStatus, { color: tokens.mutedForeground }]}>
                {t.shell.statusbar.backendVersion(statusQuery.data.version)}
                {connection.lastUsedAt
                  ? ` · used ${relativeTime(connection.lastUsedAt)}`
                  : ` ${CONNECTION_NEVER_USED_SUFFIX}`}
              </Text>
            ) : null
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  appName: {
    ...type.title,
    fontWeight: '700'
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 12
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  hostStatus: {
    ...type.caption,
    marginTop: 4
  },
  hostStatusSpinner: {
    alignItems: 'flex-start',
    marginTop: 6
  },
  hostTitle: {
    ...type.body,
    fontWeight: '600'
  },
  identity: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12
  },
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  unaffiliatedNotice: {
    ...type.caption,
    marginTop: 8,
    paddingHorizontal: 24,
    textAlign: 'center'
  },
  version: {
    ...type.caption,
    marginTop: 4
  }
})
