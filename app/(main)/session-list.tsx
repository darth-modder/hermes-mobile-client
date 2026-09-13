import { useStore } from '@nanostores/react'
import { IconMenu2 } from '@tabler/icons-react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { deleteSession, listSessions, updateSessionFlags } from '../../src/api/sessions'
import { Plus, Settings } from '../../src/lib/icons'
import { groupSessions } from '../../src/lib/session-groups'
import { OPEN_MENU_ACCESSIBILITY_LABEL } from '../../src/lib/strings.mobile'
import { t } from '../../src/lib/t'
import { openDrawer } from '../../src/store/drawer'
import { $activeProfile } from '../../src/store/profile'
import { $sessionListRefreshRequests } from '../../src/store/sessions'
import { useTheme } from '../../src/theme/provider'
import { radius, type } from '../../src/theme/type'
import type { SessionInfo } from '../../src/upstream/types/hermes'

/**
 * Replicates: docs/mobile-prototypes/sessions.html, `list` view. The other
 * views in that prototype are excluded here: the Bots·Sessions·Tasks tab
 * row (`Field:`, D16/M15), the connection-status header subtitle (`Field:`),
 * and the row preview's per-row model chip beyond what already existed
 * (`Field (ours):` — already built, M07) stay as they were; see M14
 * Deviations for the lead-cell status dot (kept as the existing unread dot,
 * not the busy/warn/ok/bad state the prototype draws — that needs live
 * per-row session state this REST list doesn't carry).
 */

/** `session.started_at`/`last_active` are epoch seconds (REST, unlike the
 *  gateway's own ms timestamps elsewhere in this app) — a plain relative
 *  label, no date library pulled in for one string. */
function relativeTime(epochSeconds: number): string {
  const diffMs = Date.now() - epochSeconds * 1000
  const minutes = Math.floor(diffMs / 60_000)

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

  const days = Math.floor(hours / 24)

  return `${days}d ago`
}

function matchesQuery(session: SessionInfo, query: string): boolean {
  if (!query) {
    return true
  }

  const haystack = `${session.title ?? ''} ${session.preview ?? ''}`.toLowerCase()

  return haystack.includes(query.toLowerCase())
}

/**
 * Session list — replaces M06's Deviation #6 stopgap (`app/index.tsx` always
 * minting a new session). `GET /api/sessions` (src/api/sessions.ts) rather
 * than the WS `session.list` RPC: the thin RPC shape has no `pinned`/`unread`,
 * which this screen's own affordances need.
 */
export default function SessionListScreen() {
  const router = useRouter()
  const tokens = useTheme()
  const [sessions, setSessions] = useState<null | SessionInfo[]>(null)
  const [error, setError] = useState<null | string>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  // M09: a profile switch (settings/profiles.tsx) scopes this list via
  // `?profile=` — `load`'s identity changes with it, so the useFocusEffect
  // below re-fetches under the new scope the next time this screen regains
  // focus (returning from Settings), the same "come back, refetch" path
  // that already covers a pin/title/delete made on the chat screen.
  const activeProfile = useStore($activeProfile)

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) {
        setError(null)
      }

      try {
        const result = await listSessions({ limit: 100, order: 'recent', profile: activeProfile || undefined })

        setSessions(result.sessions)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setRefreshing(false)
      }
    },
    [activeProfile]
  )

  // The reducer's `refreshSessions` effect (sessions.changed,
  // session.reclaimed, a replay-epoch cold start) can fire while this screen
  // is already mounted and visible — a mount-only fetch would miss it.
  const refreshRequestCount = useStore($sessionListRefreshRequests)
  const skipInitialRefreshSignal = useRef(true)

  useEffect(() => {
    if (skipInitialRefreshSignal.current) {
      skipInitialRefreshSignal.current = false

      return
    }

    void load({ silent: true })
  }, [load, refreshRequestCount])

  // Coming back from a chat screen (pin/title/delete could have happened
  // there, or simply time passed) — refetch rather than show stale rows.
  useFocusEffect(
    useCallback(() => {
      void load({ silent: true })
    }, [load])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load({ silent: true })
  }, [load])

  const openSession = useCallback(
    (session: SessionInfo) => {
      router.push({
        params: { id: session.id, ...(session.title ? { title: session.title } : {}) },
        pathname: '/(main)/sessions/[id]'
      })
    },
    [router]
  )

  const startNewSession = useCallback(() => {
    router.push({ params: { id: 'new' }, pathname: '/(main)/sessions/[id]' })
  }, [router])

  const togglePinned = useCallback(async (session: SessionInfo) => {
    const nextPinned = !session.pinned

    setSessions(current => current?.map(s => (s.id === session.id ? { ...s, pinned: nextPinned } : s)) ?? current)

    try {
      await updateSessionFlags(session.id, { pinned: nextPinned })
    } catch {
      setSessions(current => current?.map(s => (s.id === session.id ? { ...s, pinned: session.pinned } : s)) ?? current)
    }
  }, [])

  const confirmDelete = useCallback(
    (session: SessionInfo) => {
      Alert.alert(t.sidebar.row.deleteTitle, session.title || t.sidebar.row.untitledPlaceholder, [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            setSessions(current => current?.filter(s => s.id !== session.id) ?? current)
            void deleteSession(session.id).catch(() => void load())
          },
          style: 'destructive',
          text: 'Delete'
        }
      ])
    },
    [load]
  )

  const filtered = useMemo(() => {
    if (!sessions) {
      return []
    }

    const matching = sessions.filter(session => matchesQuery(session, query))

    // Pinned first, then by last_active — list_sessions_rich already sorts
    // server-side, but pin toggles are applied optimistically here and would
    // otherwise sit wherever the server originally placed the row.
    return [...matching].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1
      }

      return b.last_active - a.last_active
    })
  }, [sessions, query])

  // groupSessions repeats the "pinned first" half of the sort above as its
  // own leading group, then re-groups the (already-sorted) rest by day — the
  // desktop's own date dividers (sessions-sidebar.html), not a `Field:` item.
  const sections = useMemo(() => groupSessions(filtered).map(g => ({ data: g.sessions, title: g.label })), [filtered])

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            accessibilityLabel={OPEN_MENU_ACCESSIBILITY_LABEL}
            accessibilityRole="button"
            hitSlop={12}
            onPress={openDrawer}
            style={styles.settingsButton}
          >
            <IconMenu2 color={tokens.textSecondary} size={20} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: tokens.foreground }]}>Sessions</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityLabel="Settings"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.push('/(main)/settings')}
            style={styles.settingsButton}
          >
            <Settings color={tokens.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="New session"
            accessibilityRole="button"
            hitSlop={{ bottom: 8, top: 8 }}
            onPress={startNewSession}
            style={[styles.newButton, { backgroundColor: tokens.primary }]}
          >
            <Plus color={tokens.primaryForeground} size={16} />
            <Text style={[styles.newButtonText, { color: tokens.primaryForeground }]}>
              {t.sidebar.nav['new-session']}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        onChangeText={setQuery}
        placeholder="Search sessions…"
        placeholderTextColor={tokens.mutedForeground}
        style={[styles.search, { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }]}
        value={query}
      />

      {error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => void load()}
            style={[styles.retryButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sessions === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.textSecondary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: tokens.mutedForeground }]}>
            {query ? t.sidebar.noMatch(query) : t.commandCenter.noSessions}
          </Text>
        </View>
      ) : (
        <SectionList
          contentContainerStyle={styles.list}
          keyExtractor={session => session.id}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={tokens.textSecondary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => confirmDelete(item)}
              onPress={() => openSession(item)}
              style={[styles.row, { borderBottomColor: tokens.border }]}
            >
              <View style={styles.rowLead}>
                <View
                  style={[styles.leadDot, { backgroundColor: item.unread ? tokens.primary : tokens.strokeSecondary }]}
                />
              </View>
              <View style={styles.rowMain}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.foreground }]}>
                  {item.title || t.sidebar.row.untitledPlaceholder}
                </Text>
                {item.preview ? (
                  <Text numberOfLines={1} style={[styles.rowPreview, { color: tokens.textSecondary }]}>
                    {item.preview}
                  </Text>
                ) : null}
                <Text style={[styles.rowMeta, { color: tokens.mutedForeground }]}>
                  {relativeTime(item.last_active)}
                  {item.model ? ` · ${item.model}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel={item.pinned ? 'Unpin session' : 'Pin session'}
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => void togglePinned(item)}
                style={styles.pinButton}
              >
                <Text
                  style={[
                    styles.pinIcon,
                    { color: tokens.border },
                    item.pinned ? { color: tokens.semantic.orange } : null
                  ]}
                >
                  ★
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{section.title}</Text>
          )}
          sections={sections}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24
  },
  container: {
    flex: 1
  },
  emptyText: {
    ...type.bodySmall
  },
  errorText: {
    ...type.bodySmall,
    marginBottom: 16,
    textAlign: 'center'
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  list: {
    paddingBottom: 24
  },
  newButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 12
  },
  newButtonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  pinButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  pinIcon: {
    ...type.title
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  leadDot: {
    borderRadius: radius.full,
    height: 8,
    width: 8
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  rowLead: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 14
  },
  rowMain: {
    flex: 1,
    gap: 2
  },
  rowMeta: {
    ...type.caption
  },
  rowPreview: {
    ...type.label
  },
  rowTitle: {
    ...type.body,
    flexShrink: 1,
    fontWeight: '600'
  },
  sectionLabel: {
    ...type.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: 'uppercase'
  },
  search: {
    ...type.bodySmall,
    borderRadius: radius.control,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  settingsButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  title: {
    ...type.title,
    fontWeight: '700'
  }
})
