import { useStore } from '@nanostores/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { compressSession, renameSession } from '../gateway/session-connection'
import { ChevronLeft } from '../lib/icons'
import { SESSION_HEADER_COMPRESS_FAILED_TITLE, SESSION_HEADER_COMPRESS_LABEL } from '../lib/strings.mobile'
import { t } from '../lib/t'
import { notify } from '../store/notifications'
import { $sessionStates } from '../store/session-states'
import { useTheme } from '../theme/provider'
import { type } from '../theme/type'

import { UsageChip } from './parts/UsageChip'

// Replicates: docs/mobile-prototypes/chat.html's own header (line 62-73:
// back · title/subtitle · 2 actions, subtitle a plain `.header__sub`
// text node) and composer (line 124-127: the model/effort chips live in
// `.composer__controls`, not the header). Model/effort are not composer
// chips here (Deviation 11: mobile has no session-scoped switch API to wire
// a chip to — `/model` and Settings routes to the same place `slash.model`
// would need); this component's own scope is narrower still, per
// docs/desktop-prototypes/e-overlays/model-picker.html's header comment
// ("Mobile: At parity: providers and models live in Settings on mobile,
// M09, docs/PARITY.md") — no sheet is built here for that reason. Following
// the prototype's own subtitle shape (plain text) rather than the M13
// closing-fixes round's first attempt, which made the subtitle its own
// 48dp touchable and grew the header to 96dp to fit it — see Deviation 16.

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
        title: SESSION_HEADER_COMPRESS_FAILED_TITLE,
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
          // The whole column is one 56dp touchable that starts the rename —
          // see the file-header comment above for why the model/effort line
          // it contains is plain text, not its own control.
          <TouchableOpacity
            onPress={() => setEditingTitle(session.title || t.sidebar.row.untitledPlaceholder)}
            style={styles.titleTouchable}
          >
            <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
              {session.title || t.sidebar.row.untitledPlaceholder}
            </Text>
            <View style={styles.subtitleRow}>
              <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.mutedForeground }]}>
                {[session.provider, session.model, session.reasoningEffort].filter(Boolean).join(' · ') || '—'}
              </Text>
              <UsageChip usage={session.usage} />
            </View>
          </TouchableOpacity>
        )}
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
          <Text style={[styles.compressText, { color: tokens.primary }]}>{SESSION_HEADER_COMPRESS_LABEL}</Text>
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
  titleTouchable: {
    justifyContent: 'center',
    minHeight: 56
  },
  titleInput: {
    ...type.body,
    borderBottomWidth: 1,
    fontWeight: '600',
    paddingVertical: 2
  }
})
