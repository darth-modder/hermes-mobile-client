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
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader title="Artifacts" />

      <View style={styles.filterRow}>
        {ARTIFACT_FILTERS.map(item => (
          <TouchableOpacity
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.filterChip, filter === item ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterText, filter === item ? styles.filterTextActive : null]}>
              {FILTER_LABEL[item]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : artifacts === null ? (
        <View style={styles.center}>
          <ActivityIndicator color="#8a8a99" size="large" />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No artifacts found in recent sessions.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={visible}
          keyExtractor={artifact => artifact.id}
          refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor="#8a8a99" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text numberOfLines={1} style={styles.rowTitle}>
                {item.label}
              </Text>
              <Text numberOfLines={1} style={styles.rowSubtitle}>
                {item.value}
              </Text>
              <Text style={styles.rowMeta}>
                {item.kind} · {item.sessionTitle} · {formatTime(item.timestamp)}
              </Text>
              <TouchableOpacity
                disabled={sharingId === item.id}
                onPress={() => void onShare(item)}
                style={styles.shareButton}
              >
                <Text style={styles.shareText}>{sharingId === item.id ? 'Sharing…' : 'Share'}</Text>
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
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 10,
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
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  emptyText: {
    color: '#5a5a66',
    fontSize: 14,
    textAlign: 'center'
  },
  errorText: {
    color: '#e06c75',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center'
  },
  filterChip: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  filterChipActive: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  filterText: {
    color: '#8a8a99',
    fontSize: 12,
    fontWeight: '600'
  },
  filterTextActive: {
    color: '#f2f2f5'
  },
  list: {
    padding: 16
  },
  retryButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  rowMeta: {
    color: '#5a5a66',
    fontSize: 11,
    marginTop: 4
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowTitle: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  shareButton: {
    marginTop: 8
  },
  shareText: {
    color: '#1f6feb',
    fontSize: 13,
    fontWeight: '600'
  }
})
