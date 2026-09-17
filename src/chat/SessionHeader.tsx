import { useStore } from '@nanostores/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { BotAvatar } from '../components/BotAvatar'
import { Menu, type MenuItem } from '../components/ui/Menu'
import { compressSession, renameSession } from '../gateway/session-connection'
import { ChevronLeft, MoreVertical, RefreshCw, Settings } from '../lib/icons'
import {
  BOTS_SETTINGS_TITLE,
  SESSION_HEADER_COMPRESS_FAILED_TITLE,
  SESSION_HEADER_COMPRESS_LABEL,
  SESSION_HEADER_OVERFLOW_ACCESSIBILITY_LABEL,
  SESSION_HEADER_REFRESH_LABEL
} from '../lib/strings.mobile'
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
  /** Set only when this chat is a bot's canonical chat (M15 A round 2): the
   *  bot's profile name, shown with its `BotAvatar` in place of the plain
   *  session title. `session.title` is always the literal "Bot Chat" for
   *  this session (the exact-title identity contract, `src/api/bots.ts`'s
   *  `CANONICAL_CHAT_TITLE`) — showing that instead of the bot's name would
   *  make every bot's chat header say the same word. The rename tap target
   *  is disabled in this mode for the same reason: renaming away from "Bot
   *  Chat" would break `resolveCanonicalChat`'s next lookup for this bot. */
  botName?: string
  /** Bot mode only: opens `BotSettingsSheet`. The screen owns the sheet (it
   *  needs the full roster for the messaging-protocol teammate list) —
   *  this component only renders the entry point. Replaces the Compress
   *  action in this slot rather than adding a second one (this header has
   *  exactly one trailing action, per chat.html's own two-action cluster
   *  already spent on back+one action for a bot chat) — Compress is not
   *  reachable from a bot's canonical chat as of this round; noted here
   *  rather than silently dropped. */
  onSettingsPress?: () => void
  /** M15 B "Refresh conversation": re-runs `session.resume` hydration for
   *  this screen. The screen owns the call (`resumeSession`, via its own
   *  `botId` route param) rather than this component, because M15 Deviation
   *  5 requires passing the bot's profile for a Bot Chat's resume and this
   *  component is never given that id — only `botName`, which the canonical-
   *  chat identity contract (see `botName` above) deliberately keeps
   *  separate from the profile lookup key. Adds a second trailing action (a
   *  "More" overflow, `Menu`) alongside the existing Compress/Settings
   *  slot — the one-action layout note above no longer holds now that this
   *  exists for every chat, bot or plain. */
  onRefresh: () => void
}

/** Model/provider/effort + title edit + `session.compress` — the chat
 *  screen's top bar. */
export function SessionHeader({ botName, onRefresh, onSettingsPress, storedSessionId }: SessionHeaderProps) {
  const tokens = useTheme()
  const router = useRouter()
  const session = useStore($sessionStates)[storedSessionId]
  const [editingTitle, setEditingTitle] = useState<null | string>(null)
  const [compressing, setCompressing] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)

  const overflowItems: MenuItem[] = [
    {
      icon: <RefreshCw color={tokens.foreground} size={18} />,
      key: 'refresh',
      label: SESSION_HEADER_REFRESH_LABEL,
      onPress: onRefresh
    }
  ]

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
      {botName ? (
        <View style={styles.botAvatar}>
          <BotAvatar name={botName} size={32} />
        </View>
      ) : null}
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
          // it contains is plain text, not its own control. Bot mode: not a
          // touchable at all (see the `botName` prop doc above).
          <TouchableOpacity
            disabled={Boolean(botName)}
            onPress={() => setEditingTitle(session.title || t.sidebar.row.untitledPlaceholder)}
            style={styles.titleTouchable}
          >
            <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
              {botName || session.title || t.sidebar.row.untitledPlaceholder}
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
      {onSettingsPress ? (
        <TouchableOpacity
          accessibilityLabel={BOTS_SETTINGS_TITLE}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onSettingsPress}
          style={styles.compressButton}
        >
          <Settings color={tokens.foreground} size={20} />
        </TouchableOpacity>
      ) : (
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
      )}
      <TouchableOpacity
        accessibilityLabel={SESSION_HEADER_OVERFLOW_ACCESSIBILITY_LABEL}
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => setOverflowOpen(true)}
        style={styles.compressButton}
      >
        <MoreVertical color={tokens.foreground} size={20} />
      </TouchableOpacity>
      <Menu items={overflowItems} onClose={() => setOverflowOpen(false)} visible={overflowOpen} />
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
  botAvatar: {
    marginRight: 8
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
