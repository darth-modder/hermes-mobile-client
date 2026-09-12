import { useStore } from '@nanostores/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { compressSession, renameSession } from '../gateway/session-connection'
import { ChevronLeft } from '../lib/icons'
import { t } from '../lib/t'
import { notify } from '../store/notifications'
import { $sessionStates } from '../store/session-states'
import { useTheme } from '../theme/provider'
import { type } from '../theme/type'

import { UsageChip } from './parts/UsageChip'

// Replicates: docs/desktop-prototypes/e-overlays/model-picker.html's
// composer model-pill / dialog trigger — with its own scope narrowed by
// that prototype's header comment: "Mobile: At parity: providers and models
// live in Settings on mobile (M09, docs/PARITY.md)." No new sheet is built
// here for that reason, not by oversight — checked src/api/models.ts
// directly: `ModelAssignmentRequest.scope` (src/upstream/types/hermes.ts)
// is typed `'main' | 'auxiliary'` only, no session-scoped variant and no
// `session_id` field anywhere on the request. The desktop's dialog applies
// the pick "to the focused session/tile" (that prototype's own Behaviour
// block); mobile's only model-switch call (`setGlobalModel`, scope: 'main')
// changes the default for new sessions, not the open one. A sheet that
// looked like the desktop's per-session picker but silently changed a
// different scope would misrepresent what the tap does — the same
// "no invented API surface" line settings/models.tsx's own header already
// draws for this endpoint. What IS built: this subtitle row is now a real
// shortcut to Settings -> Models (t.settings.sections.model), where the
// actual switch lives — same resolution precedent as the onboarding.html
// and gateway-connecting.html mapping-table/header-comment conflicts
// earlier in this milestone (prototype's own comment wins).

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
        <TouchableOpacity
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft color={tokens.foreground} size={26} />
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
      <TouchableOpacity
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => router.back()}
        style={styles.back}
      >
        <ChevronLeft color={tokens.foreground} size={26} />
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
          <TouchableOpacity
            hitSlop={{ bottom: 12, left: 8, right: 8, top: 12 }}
            onPress={() => setEditingTitle(session.title || 'Untitled')}
          >
            <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
              {session.title || 'Untitled'}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.subtitleRow}>
          <TouchableOpacity
            accessibilityLabel={t.settings.sections.model}
            accessibilityRole="button"
            hitSlop={{ bottom: 16, left: 8, right: 8, top: 16 }}
            onPress={() => router.push('/(main)/settings/models')}
          >
            <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.mutedForeground }]}>
              {[session.provider, session.model, session.reasoningEffort].filter(Boolean).join(' · ') || '—'}
            </Text>
          </TouchableOpacity>
          <UsageChip usage={session.usage} />
        </View>
      </View>
      <TouchableOpacity
        disabled={compressing}
        hitSlop={10}
        onPress={() => void compress()}
        style={styles.compressButton}
      >
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
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  compressButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  compressText: {
    ...type.caption
  },
  container: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 8
  },
  subtitle: {
    ...type.caption,
    marginRight: 6
  },
  subtitleRow: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  title: {
    ...type.body,
    fontWeight: '600'
  },
  titleColumn: {
    flex: 1
  },
  titleInput: {
    ...type.body,
    borderBottomWidth: 1,
    fontWeight: '600',
    paddingVertical: 2
  }
})
