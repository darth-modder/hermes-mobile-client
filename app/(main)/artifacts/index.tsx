import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { loadRecentArtifacts, shareArtifact } from '../../../src/api/artifacts'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { ARTIFACT_FILTERS, type ArtifactFilter, type ArtifactRecord } from '../../../src/lib/artifacts'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

const FILTER_LABEL: Record<ArtifactFilter, string> = { all: 'All', file: 'Files', image: 'Images', link: 'Links' }

function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString()
}

/**
 * Artifacts screen (M10). No server-side artifact list exists — this walks
 * the most recently active sessions' messages and runs the same
 * text/tool-result heuristics the desktop's Artifacts page uses
 * (src/lib/artifacts.ts, ported from `apps/desktop/src/app/artifacts/artifact-utils.ts`).
 * Exit criterion: "Artifact share opens the system share sheet with the
 * file" — `shareArtifact` (src/api/artifacts.ts) downloads the bytes and
 * calls `expo-sharing`.
 */
export default function ArtifactsScreen() {
  const tokens = useTheme()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined

  const [artifacts, setArtifacts] = useState<ArtifactRecord[] | null>(null)
  const [error, setError] = useState<null | string>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<ArtifactFilter>('all')
  const [sharingId, setSharingId] = useState<null | string>(null)

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) {
        setError(null)
      }

      try {
        const result = await loadRecentArtifacts(30, profile)

        setArtifacts(result.artifacts)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setRefreshing(false)
      }
    },
    [profile]
  )

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load({ silent: true })
  }, [load])

  const visible = useMemo(() => {
    if (!artifacts) {
      return []
    }

    return filter === 'all' ? artifacts : artifacts.filter(artifact => artifact.kind === filter)
  }, [artifacts, filter])

  const onShare = useCallback(async (artifact: ArtifactRecord) => {
    setSharingId(artifact.id)

    try {
      await shareArtifact(artifact)
    } catch (err) {
      Alert.alert('Could not share', err instanceof Error ? err.message : String(err))
    } finally {
      setSharingId(null)
    }
  }, [])

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title="Artifacts" />

      <View style={styles.filterRow}>
        {ARTIFACT_FILTERS.map(item => (
          <TouchableOpacity
            key={item}
            onPress={() => setFilter(item)}
            style={[
              styles.filterChip,
              { backgroundColor: tokens.muted, borderColor: tokens.border },
              filter === item ? { backgroundColor: tokens.primary, borderColor: tokens.primary } : null
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: tokens.mutedForeground },
                filter === item ? { color: tokens.primaryForeground } : null
              ]}
            >
              {FILTER_LABEL[item]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
      ) : artifacts === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.mutedForeground} size="large" />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: tokens.textTertiary }]}>No artifacts found in recent sessions.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={visible}
          keyExtractor={artifact => artifact.id}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={tokens.mutedForeground} />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.foreground }]}>
                {item.label}
              </Text>
              <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {item.value}
              </Text>
              <Text style={[styles.rowMeta, { color: tokens.textTertiary }]}>
                {item.kind} · {item.sessionTitle} · {formatTime(item.timestamp)}
              </Text>
              <TouchableOpacity
                disabled={sharingId === item.id}
                onPress={() => void onShare(item)}
                style={styles.shareButton}
              >
                <Text style={[styles.shareText, { color: tokens.primary }]}>
                  {sharingId === item.id ? 'Sharing…' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
  },
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
    ...type.bodySmall,
    textAlign: 'center'
  },
  errorText: {
    ...type.bodySmall,
    marginBottom: 16,
    textAlign: 'center'
  },
  filterChip: {
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  filterText: {
    ...type.caption,
    fontWeight: '600'
  },
  list: {
    padding: 16
  },
  retryButton: {
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  rowMeta: {
    ...type.caption,
    marginTop: 4
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  shareButton: {
    marginTop: 8
  },
  shareText: {
    ...type.label,
    fontWeight: '600'
  }
})
