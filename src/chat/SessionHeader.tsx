import { useStore } from '@nanostores/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { compressSession, renameSession } from '../gateway/session-connection'
import { notify } from '../store/notifications'
import { $sessionStates } from '../store/session-states'
import { useTheme } from '../theme/provider'

import { UsageChip } from './parts/UsageChip'

export interface SessionHeaderProps {
  storedSessionId: string
}

/** Model/provider/effort + title edit + `session.compress` — the chat
 *  screen's top bar. */
export function SessionHeader({ storedSessionId }: SessionHeaderProps) {
  const tokens = useTheme()
  const router = useRouter()
  const session = useStore($sessionStates)[storedSessionId]
  const [editingTitle, setEditingTitle] = useState<null | string>(null)
  const [compressing, setCompressing] = useState(false)

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.background, borderBottomColor: tokens.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: tokens.foreground }]}>‹</Text>
        </TouchableOpacity>
        <ActivityIndicator color={tokens.mutedForeground} size="small" />
      </View>
    )
  }

  const commitTitle = async () => {
    const title = editingTitle?.trim()

    setEditingTitle(null)

    if (!title || title === session.title) {
      return
    }

    try {
      await renameSession(storedSessionId, title)
    } catch (error) {
      notify({
        id: `rename-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Rename failed',
        type: 'notify'
      })
    }
  }

  const compress = async () => {
    setCompressing(true)

    try {
      await compressSession(storedSessionId)
    } catch (error) {
      notify({
        id: `compress-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Compress failed',
        type: 'notify'
      })
    } finally {
      setCompressing(false)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: tokens.background, borderBottomColor: tokens.border }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={[styles.backText, { color: tokens.foreground }]}>‹</Text>
      </TouchableOpacity>
      <View style={styles.titleColumn}>
        {editingTitle !== null ? (
          <TextInput
            autoFocus
            onBlur={() => void commitTitle()}
            onChangeText={setEditingTitle}
            onSubmitEditing={() => void commitTitle()}
            style={[styles.titleInput, { borderBottomColor: tokens.primary, color: tokens.foreground }]}
            value={editingTitle}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingTitle(session.title || 'Untitled')}>
            <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
              {session.title || 'Untitled'}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.subtitleRow}>
          <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.mutedForeground }]}>
            {[session.provider, session.model, session.reasoningEffort].filter(Boolean).join(' · ') || '—'}
          </Text>
          <UsageChip usage={session.usage} />
        </View>
      </View>
      <TouchableOpacity disabled={compressing} onPress={() => void compress()} style={styles.compressButton}>
        {compressing ? (
          <ActivityIndicator color={tokens.mutedForeground} size="small" />
        ) : (
          <Text style={[styles.compressText, { color: tokens.primary }]}>Compress</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  back: {
    paddingRight: 8
  },
  backText: {
    fontSize: 26,
    fontWeight: '300'
  },
  compressButton: {
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  compressText: {
    fontSize: 12
  },
  container: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  subtitle: {
    fontSize: 12,
    marginRight: 6
  },
  subtitleRow: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  title: {
    fontSize: 16,
    fontWeight: '600'
  },
  titleColumn: {
    flex: 1
  },
  titleInput: {
    borderBottomWidth: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 2
  }
})
