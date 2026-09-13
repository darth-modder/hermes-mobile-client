import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { deleteSession, listSessions, updateSessionFlags } from '../../../src/api/sessions'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { ARCHIVED_SESSION_UNTITLED } from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { SessionInfo } from '../../../src/upstream/types/hermes'

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

// Replicates: docs/desktop-prototypes/a-main/settings.html's
// `data-view="sessions"` panel ("Archived Chats"): list of archived
// conversations with Unarchive and a confirmed permanent delete, real end to
// end on `GET /api/sessions?archived=only`, `PATCH /api/sessions/{id}`
// (archived: false) and `DELETE /api/sessions/{id}` — src/api/sessions.ts,
// unchanged here. Two rows from the desktop panel are left out: "Auto-
// archive stale chats" (a days-of-inactivity setting) and "Default project
// directory" both need a settings-write endpoint this app has no port for
// (checked src/api/sessions.ts and src/api/config.ts — neither exposes an
// auto-archive or default-directory field), so they're omitted rather than
// shown as dead toggles, per the standing "no dead controls" rule.
export default function ArchivedChatsSettings() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const profile = useStore($activeProfile) || undefined
  const queryKey = ['archived-sessions', profile]

  const archivedQuery = useQuery({
    queryFn: () => listSessions({ archived: 'only', order: 'recent', profile }),
    queryKey
  })

  const unarchiveMutation = useMutation({
    mutationFn: (sessionId: string) => updateSessionFlags(sessionId, { archived: false }),
    onError: () => Alert.alert(t.settings.sessions.unarchiveFailed),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey })
  })

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onError: () => Alert.alert(t.settings.sessions.deleteFailed),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey })
  })

  const confirmDelete = (session: SessionInfo) => {
    Alert.alert(
      t.settings.sessions.archivedTitle,
      t.settings.sessions.deleteConfirm(session.title || ARCHIVED_SESSION_UNTITLED),
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => deleteMutation.mutate(session.id),
          style: 'destructive',
          text: t.settings.sessions.deletePermanently
        }
      ]
    )
  }

  const sessions = archivedQuery.data?.sessions ?? []

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.nav.archivedChats }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void archivedQuery.refetch()}
            refreshing={archivedQuery.isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        <Text style={[styles.intro, { color: tokens.mutedForeground }]}>{t.settings.sessions.archivedIntro}</Text>

        {archivedQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.mutedForeground} />
            <Text style={[styles.stateText, { color: tokens.mutedForeground }]}>{t.settings.sessions.loading}</Text>
          </View>
        ) : archivedQuery.isError ? (
          <View style={styles.center}>
            <Text style={[styles.stateText, { color: tokens.destructive }]}>{t.settings.sessions.failedLoad}</Text>
            <TouchableOpacity hitSlop={10} onPress={() => void archivedQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyTitle, { color: tokens.foreground }]}>
              {t.settings.sessions.emptyArchivedTitle}
            </Text>
            <Text style={[styles.stateText, { color: tokens.mutedForeground }]}>
              {t.settings.sessions.emptyArchivedDesc}
            </Text>
          </View>
        ) : (
          sessions.map(session => (
            <View key={session.id} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
                {session.title || ARCHIVED_SESSION_UNTITLED}
              </Text>
              {session.preview ? (
                <Text numberOfLines={2} style={[styles.preview, { color: tokens.mutedForeground }]}>
                  {session.preview}
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: tokens.textTertiary }]}>
                {t.settings.sessions.messages(session.message_count)} · {relativeTime(session.last_active)}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  disabled={unarchiveMutation.isPending && unarchiveMutation.variables === session.id}
                  hitSlop={8}
                  onPress={() => unarchiveMutation.mutate(session.id)}
                  style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                >
                  <Text style={[styles.actionText, { color: tokens.secondaryForeground }]}>
                    {t.settings.sessions.unarchive}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={deleteMutation.isPending && deleteMutation.variables === session.id}
                  hitSlop={8}
                  onPress={() => confirmDelete(session)}
                  style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                >
                  <Text style={[styles.destructiveText, { color: tokens.destructive }]}>
                    {t.settings.sessions.deletePermanently}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    borderRadius: radius.control,
    marginRight: 8,
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  actionText: {
    ...type.caption,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  center: {
    alignItems: 'center',
    padding: 24
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    ...type.caption,
    fontWeight: '600'
  },
  emptyTitle: {
    ...type.body,
    fontWeight: '700',
    marginBottom: 4
  },
  intro: {
    ...type.caption,
    marginBottom: 16
  },
  meta: {
    ...type.caption,
    marginTop: 4
  },
  preview: {
    ...type.caption,
    marginTop: 2
  },
  retryButton: {
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center'
  },
  retryText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  stateText: {
    ...type.caption,
    marginTop: 6,
    textAlign: 'center'
  },
  title: {
    ...type.body,
    fontWeight: '600'
  }
})
