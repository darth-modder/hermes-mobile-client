import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import {
  type BotProfile,
  type BotProfileDetail,
  type BotToolset,
  clearBotModelPin,
  configureBot,
  describeBot
} from '../api/bots'
import { getGlobalModelOptions } from '../api/models'
import { ensureMessagingProtocol } from '../lib/bot-soul'
import {
  BOTS_CAPABILITIES_SUBTITLE,
  BOTS_CAPABILITIES_TITLE,
  BOTS_HOST_AUTHORITY_NOTE,
  BOTS_MODEL_CONFIRM_TITLE,
  BOTS_MODEL_INHERIT_LABEL,
  BOTS_MODEL_PIN_SUBTITLE,
  BOTS_SETTINGS_TITLE,
  BOTS_SOUL_CHANGED_ON_HOST_MESSAGE,
  BOTS_SOUL_CHANGED_ON_HOST_TITLE,
  BOTS_SOUL_HINT,
  BOTS_SOUL_SAVE_FAILED
} from '../lib/strings.mobile'
import { t } from '../lib/t'
import { useTheme } from '../theme/provider'
import { type as typeTokens } from '../theme/type'

import { CapabilitiesSheet } from './CapabilitiesSheet'
import { Input } from './ui/Input'
import { Menu, type MenuItem } from './ui/Menu'
import { Sheet } from './ui/Sheet'

/**
 * Replicates: docs/mobile-prototypes/bots.html's `settings` view (M15 A
 * round 2, task 2). Description and the Model/Capabilities nav rows save
 * immediately on their own action; the SOUL.md editor saves independently
 * on blur (bots.html:313's own field hint, `BOTS_SOUL_HINT`) with the
 * staleness re-check task 2 asks for — there is no sheet-wide Cancel/Save,
 * unlike bots.html's footer, since every field here already commits itself.
 */
export interface BotSettingsSheetProps {
  onClose: () => void
  profile: BotProfile
  roster: BotProfile[]
  visible: boolean
}

interface ModelOption {
  model: string
  provider: string
}

export function BotSettingsSheet({ onClose, profile, roster, visible }: BotSettingsSheetProps) {
  const tokens = useTheme()
  const [detail, setDetail] = useState<BotProfileDetail | null>(null)
  const [loadError, setLoadError] = useState<null | string>(null)
  const [description, setDescription] = useState('')
  const [soul, setSoul] = useState('')
  const [soulSaving, setSoulSaving] = useState(false)
  const [soulError, setSoulError] = useState<null | string>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [modelOptions, setModelOptions] = useState<ModelOption[] | null>(null)
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)

  useEffect(() => {
    if (!visible) {
      return
    }

    setLoadError(null)
    setDetail(null)

    describeBot(profile.name)
      .then(result => {
        setDetail(result)
        setDescription(result.description)
        setSoul(result.soul)
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : String(err)))
  }, [profile.name, visible])

  const saveDescription = useCallback(async () => {
    if (!detail || description === detail.description) {
      return
    }

    try {
      await configureBot(profile.name, { description })
      setDetail(current => (current ? { ...current, description } : current))
    } catch {
      // Reverts to the last-known-good value on the next open; not fatal
      // enough to interrupt the sheet with an alert for a field that's
      // still visibly editable.
    }
  }, [description, detail, profile.name])

  const saveSoul = useCallback(async () => {
    if (!detail || soul === detail.soul || soulSaving) {
      return
    }

    setSoulSaving(true)
    setSoulError(null)

    try {
      // Re-read before writing: soul editor's own staleness guard (task 2).
      const fresh = await describeBot(profile.name)

      if (fresh.soul !== detail.soul) {
        const overwrite = await new Promise<boolean>(resolve => {
          Alert.alert(BOTS_SOUL_CHANGED_ON_HOST_TITLE, BOTS_SOUL_CHANGED_ON_HOST_MESSAGE, [
            { onPress: () => resolve(false), style: 'cancel', text: t.common.cancel },
            { onPress: () => resolve(true), style: 'destructive', text: t.common.save }
          ])
        })

        if (!overwrite) {
          setDetail(fresh)
          setSoul(fresh.soul)

          return
        }
      }

      const finalSoul = ensureMessagingProtocol(soul, profile.name, roster, false)

      await configureBot(profile.name, { soul: finalSoul })
      setDetail(current => (current ? { ...current, soul: finalSoul } : current))
      setSoul(finalSoul)
    } catch (err) {
      setSoulError(err instanceof Error ? err.message : BOTS_SOUL_SAVE_FAILED)
    } finally {
      setSoulSaving(false)
    }
  }, [detail, profile.name, roster, soul, soulSaving])

  const applyModel = useCallback(
    async (option: ModelOption | null, confirmExpensiveModel = false) => {
      setModelMenuOpen(false)

      try {
        if (!option) {
          const result = await clearBotModelPin(profile.name)

          if (!result.ok) {
            return
          }

          setDetail(current => (current ? { ...current, model: { default: '', provider: '' } } : current))

          return
        }

        const result = await configureBot(profile.name, {
          confirmExpensiveModel,
          model: option
        })

        if (result.confirm_required) {
          Alert.alert(BOTS_MODEL_CONFIRM_TITLE, result.confirm_message || '', [
            { style: 'cancel', text: t.common.cancel },
            { onPress: () => void applyModel(option, true), text: t.common.confirm }
          ])

          return
        }

        setDetail(current =>
          current ? { ...current, model: { default: option.model, provider: option.provider } } : current
        )
      } catch {
        // The row keeps showing the last-confirmed pin; nothing to roll back
        // optimistically since state above is only set on confirmed success.
      }
    },
    [profile.name]
  )

  const openModelMenu = useCallback(() => {
    setModelMenuOpen(true)

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

  const modelMenuItems: MenuItem[] = [
    { key: 'inherit', label: BOTS_MODEL_INHERIT_LABEL, onPress: () => void applyModel(null) },
    ...(modelOptions || []).map(option => ({
      key: `${option.provider}/${option.model}`,
      label: option.model,
      onPress: () => void applyModel(option),
      subtitle: option.provider
    }))
  ]

  const modelValue = detail?.model.default || BOTS_MODEL_INHERIT_LABEL
  const skillCount = detail?.skills.filter(s => s.enabled).length ?? 0
  const toolsetCount = detail?.toolsets.filter((toolset: BotToolset) => toolset.enabled).length ?? 0

  return (
    <>
      <Sheet onClose={onClose} title={BOTS_SETTINGS_TITLE} visible={visible}>
        {loadError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{loadError}</Text>
        ) : !detail ? (
          <ActivityIndicator color={tokens.mutedForeground} size="large" />
        ) : (
          <>
            <Input
              label={t.webhooks.fieldDescription}
              multiline
              numberOfLines={3}
              onBlur={() => void saveDescription()}
              onChangeText={setDescription}
              style={styles.multiline}
              value={description}
            />
            <Input
              hint={soulError ?? BOTS_SOUL_HINT}
              label={t.profiles.editSoul}
              multiline
              numberOfLines={6}
              onBlur={() => void saveSoul()}
              onChangeText={setSoul}
              placeholder={t.profiles.emptySoul}
              style={[styles.multiline, styles.soulInput]}
              value={soul}
            />
            {soulSaving ? <ActivityIndicator color={tokens.mutedForeground} size="small" /> : null}

            <View style={[styles.hair, { backgroundColor: tokens.border }]} />

            <TouchableOpacity onPress={openModelMenu} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{t.settings.model.model}</Text>
                <Text style={[styles.rowSub, { color: tokens.mutedForeground }]}>{BOTS_MODEL_PIN_SUBTITLE}</Text>
              </View>
              <Text style={[styles.rowValue, { color: tokens.textSecondary }]}>{modelValue}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCapabilitiesOpen(true)} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{BOTS_CAPABILITIES_TITLE}</Text>
                <Text style={[styles.rowSub, { color: tokens.mutedForeground }]}>{BOTS_CAPABILITIES_SUBTITLE}</Text>
              </View>
              <Text style={[styles.rowValue, { color: tokens.textSecondary }]}>
                {skillCount} · {toolsetCount}
              </Text>
            </TouchableOpacity>

            <View style={[styles.hair, { backgroundColor: tokens.border }]} />
            <Text style={[styles.hostNote, { color: tokens.textQuaternary }]}>{BOTS_HOST_AUTHORITY_NOTE}</Text>
          </>
        )}
      </Sheet>

      <Menu
        items={modelMenuItems}
        onClose={() => setModelMenuOpen(false)}
        title={t.settings.model.model}
        visible={modelMenuOpen}
      />

      {detail ? (
        <CapabilitiesSheet
          detail={detail}
          onClose={() => setCapabilitiesOpen(false)}
          onSaved={updated => setDetail(updated)}
          profileName={profile.name}
          visible={capabilitiesOpen}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  errorText: {
    ...typeTokens.bodySmall,
    textAlign: 'center'
  },
  hair: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8
  },
  hostNote: {
    ...typeTokens.caption,
    paddingTop: 4
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top'
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingVertical: 8
  },
  rowSub: {
    ...typeTokens.caption
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    ...typeTokens.body,
    fontWeight: '600'
  },
  rowValue: {
    ...typeTokens.bodySmall
  },
  soulInput: {
    ...typeTokens.mono,
    minHeight: 132
  }
})
