import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { type BotProfile, CANONICAL_CHAT_TITLE, createBot, listBots, resolveCanonicalChat } from '../../../src/api/bots'
import { getGlobalModelOptions } from '../../../src/api/models'
import { BotAvatar } from '../../../src/components/BotAvatar'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { TabStrip } from '../../../src/components/TabStrip'
import { Button } from '../../../src/components/ui/Button'
import { Input } from '../../../src/components/ui/Input'
import { Menu, type MenuItem } from '../../../src/components/ui/Menu'
import { Sheet } from '../../../src/components/ui/Sheet'
import { Plus } from '../../../src/lib/icons'
import {
  BOTS_AVATAR_SEED_HINT,
  BOTS_AVATAR_SEED_LABEL,
  BOTS_CREATE_ACTION,
  BOTS_CREATE_FAILED,
  BOTS_CREATING_ACTION,
  BOTS_DESCRIPTION_PLACEHOLDER,
  BOTS_EMPTY_DESC,
  BOTS_EMPTY_TITLE,
  BOTS_MODEL_INHERIT_LABEL,
  BOTS_NAME_HINT,
  BOTS_NEW_TITLE,
  BOTS_TAB_LABEL
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

/**
 * Replicates: docs/mobile-prototypes/bots.html's `roster` and `new` views
 * (M15 A round 2). Not replicated this round: the desktop's user-section
 * grouping/hidden-bots drawer (`section-label`/"Hidden" rows), the
 * archetype-tile step-1-of-4 wizard, and the long-press action-sheet menu —
 * this sheet is the round-1 task line's simpler 4-field form (name,
 * description, model, avatar seed), a deliberate scope cut from
 * bots.html's fuller `new` view (its own archetype tiles + step dots),
 * recorded as a Deviation. Long-press (Edit/Duplicate/Delete) is bot-
 * settings-sheet and later-round territory.
 *
 * `Replicates:` roster row anatomy (avatar, name, handle, model, preview,
 * relative time) at 72dp; New bot as a bottom sheet, not the desktop's
 * modal dialog (M14 "dialogs with a form -> Sheet" rule).
 */

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 64)
}

/** `last_session.last_active` / `canonical_session.last_active` are epoch
 *  SECONDS (`methods_profiles.py`'s roster rows), same convention
 *  `session-list.tsx`'s own local `relativeTime` already established for
 *  the REST `SessionInfo` list — no shared util exists for this anywhere in
 *  the app (checked: every screen using a relative-time label defines its
 *  own copy), so this follows that precedent rather than inventing one. */
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

function rowAvatarShape(bot: BotProfile): null | string {
  const meta = bot.ui_meta?.['hermes-bots']

  return meta && typeof meta === 'object' && 'shape' in meta ? String((meta as { shape?: unknown }).shape ?? '') : null
}

interface ModelOption {
  model: string
  provider: string
}

export default function BotsScreen() {
  const router = useRouter()
  const tokens = useTheme()
  const [bots, setBots] = useState<BotProfile[] | null>(null)
  const [error, setError] = useState<null | string>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [openingBot, setOpeningBot] = useState<null | string>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createAvatarSeed, setCreateAvatarSeed] = useState('')
  const [createModel, setCreateModel] = useState<ModelOption | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<null | string>(null)
  const [modelOptions, setModelOptions] = useState<ModelOption[] | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  const createSlug = slugify(createName)
  const createNameValid = createSlug.length > 0 && NAME_PATTERN.test(createSlug)

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) {
      setError(null)
    }

    try {
      const result = await listBots()

      setBots(result.profiles)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true })
    }, [load])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load({ silent: true })
  }, [load])

  const openBot = useCallback(
    async (bot: BotProfile) => {
      setOpeningBot(bot.name)

      try {
        const storedSessionId = await resolveCanonicalChat(bot.name, bot.canonical_session?.id)

        router.push({
          // `botId` is the profile slug — the RPC identifier the settings
          // sheet addresses `profiles.describe`/`configure` with — kept
          // separate from `botName` (the header's display string) so a
          // future `display_name` never gets used where an identifier is
          // required.
          params: {
            botId: bot.name,
            botName: bot.display_name || bot.name,
            id: storedSessionId,
            title: CANONICAL_CHAT_TITLE
          },
          pathname: '/(main)/sessions/[id]'
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setOpeningBot(null)
      }
    },
    [router]
  )

  const openCreateSheet = useCallback(() => {
    setCreateName('')
    setCreateDescription('')
    setCreateAvatarSeed('')
    setCreateModel(null)
    setCreateError(null)
    setCreateOpen(true)

    if (modelOptions === null) {
      void getGlobalModelOptions({ includeUnconfigured: false })
        .then(response => {
          const options = (response.providers || []).flatMap(provider =>
            (provider.models || []).map(model => ({ model, provider: provider.slug }))
          )

          setModelOptions(options)
        })
        .catch(() => setModelOptions([]))
    }
  }, [modelOptions])

  const submitCreate = useCallback(async () => {
    if (!createNameValid || creating) {
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      await createBot({
        avatarSeed: createAvatarSeed.trim() || undefined,
        description: createDescription.trim() || undefined,
        model: createModel ?? undefined,
        name: createSlug
      })
      setCreateOpen(false)
      await load({ silent: true })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : BOTS_CREATE_FAILED)
    } finally {
      setCreating(false)
    }
  }, [createAvatarSeed, createDescription, createModel, createNameValid, createSlug, creating, load])

  const modelMenuItems: MenuItem[] = [
    {
      key: 'inherit',
      label: BOTS_MODEL_INHERIT_LABEL,
      onPress: () => {
        setCreateModel(null)
        setModelMenuOpen(false)
      }
    },
    ...(modelOptions || []).map(option => ({
      key: `${option.provider}/${option.model}`,
      label: option.model,
      subtitle: option.provider,
      onPress: () => {
        setCreateModel(option)
        setModelMenuOpen(false)
      }
    }))
  ]

  const modelLabel = createModel ? createModel.model : BOTS_MODEL_INHERIT_LABEL

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader
        actions={[
          {
            accessibilityLabel: BOTS_NEW_TITLE,
            icon: <Plus color={tokens.foreground} size={20} />,
            onPress: openCreateSheet
          }
        ]}
        title={BOTS_TAB_LABEL}
      />

      <TabStrip active="bots" />

      {error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => void load()}
            style={[styles.retryButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.common.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : bots === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.textSecondary} size="large" />
        </View>
      ) : bots.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tokens.foreground }]}>{BOTS_EMPTY_TITLE}</Text>
          <Text style={[styles.emptyDesc, { color: tokens.mutedForeground }]}>{BOTS_EMPTY_DESC}</Text>
          <Button onPress={openCreateSheet} style={styles.emptyButton} variant="primary">
            {BOTS_NEW_TITLE}
          </Button>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={bots}
          keyExtractor={bot => bot.name}
          refreshControl={
            <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={tokens.textSecondary} />
          }
          renderItem={({ item }) => {
            const preview = item.last_session?.preview || item.description
            const timestamp = item.last_session?.last_active ?? item.canonical_session?.last_active

            return (
              <TouchableOpacity
                disabled={openingBot === item.name}
                onPress={() => void openBot(item)}
                style={[styles.row, { borderBottomColor: tokens.border }]}
              >
                <BotAvatar name={item.name} shape={rowAvatarShape(item)} size={40} />
                <View style={styles.rowMain}>
                  <View style={styles.rowTitleLine}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.foreground }]}>
                      {item.display_name || item.name}
                    </Text>
                    {timestamp ? (
                      <Text style={[styles.rowAge, { color: tokens.mutedForeground }]}>{relativeTime(timestamp)}</Text>
                    ) : null}
                  </View>
                  {preview ? (
                    <Text numberOfLines={1} style={[styles.rowPreview, { color: tokens.textSecondary }]}>
                      {preview}
                    </Text>
                  ) : null}
                  <Text numberOfLines={1} style={[styles.rowMeta, { color: tokens.mutedForeground }]}>
                    @{item.name}
                    {item.model ? ` · ${item.model}` : ''}
                  </Text>
                </View>
                {openingBot === item.name ? <ActivityIndicator color={tokens.mutedForeground} size="small" /> : null}
              </TouchableOpacity>
            )
          }}
        />
      )}

      <Sheet
        footer={
          <>
            <Button block onPress={() => setCreateOpen(false)} style={styles.sheetFooterButton} variant="ghost">
              {t.common.cancel}
            </Button>
            <Button
              block
              disabled={!createNameValid}
              loading={creating}
              onPress={() => void submitCreate()}
              style={styles.sheetFooterButton}
              variant="primary"
            >
              {creating ? BOTS_CREATING_ACTION : BOTS_CREATE_ACTION}
            </Button>
          </>
        }
        onClose={() => setCreateOpen(false)}
        title={BOTS_NEW_TITLE}
        visible={createOpen}
      >
        <Input
          autoCapitalize="none"
          autoFocus
          hint={BOTS_NAME_HINT}
          label={t.profiles.nameLabel}
          onChangeText={setCreateName}
          placeholder="research-rabbit"
          value={createName}
        />
        <Input
          label={t.webhooks.fieldDescription}
          multiline
          numberOfLines={3}
          onChangeText={setCreateDescription}
          placeholder={BOTS_DESCRIPTION_PLACEHOLDER}
          style={styles.multiline}
          value={createDescription}
        />
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.textTertiary }]}>{t.settings.model.model}</Text>
          <TouchableOpacity
            onPress={() => setModelMenuOpen(true)}
            style={[styles.select, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <Text style={[styles.selectText, { color: tokens.foreground }]}>{modelLabel}</Text>
          </TouchableOpacity>
        </View>
        <Input
          autoCapitalize="none"
          hint={BOTS_AVATAR_SEED_HINT}
          label={BOTS_AVATAR_SEED_LABEL}
          onChangeText={setCreateAvatarSeed}
          placeholder={createSlug || 'agent'}
          value={createAvatarSeed}
        />
        {createError ? <Text style={[styles.errorText, { color: tokens.destructive }]}>{createError}</Text> : null}
      </Sheet>

      <Menu
        items={modelMenuItems}
        onClose={() => setModelMenuOpen(false)}
        title={t.settings.model.model}
        visible={modelMenuOpen}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24
  },
  container: {
    flex: 1
  },
  emptyButton: {
    marginTop: 8
  },
  emptyDesc: {
    ...type.bodySmall,
    textAlign: 'center'
  },
  emptyTitle: {
    ...type.body,
    fontWeight: '600'
  },
  errorText: {
    ...type.bodySmall,
    textAlign: 'center'
  },
  field: {
    marginBottom: 14
  },
  fieldLabel: {
    ...type.caption,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  list: {
    paddingBottom: 24
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top'
  },
  retryButton: {
    borderRadius: radius.control,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryText: {
    ...type.bodySmall,
    fontWeight: '600'
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
  rowAge: {
    ...type.caption
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
    flex: 1,
    fontWeight: '600'
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  select: {
    borderRadius: radius.control,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  selectText: {
    ...type.bodySmall
  },
  sheetFooterButton: {
    flex: 1
  }
})
