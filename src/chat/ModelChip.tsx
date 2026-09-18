import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { getGlobalModelOptions, setSessionModel } from '../api/models'
import { Input } from '../components/ui/Input'
import { Sheet } from '../components/ui/Sheet'
import { Check } from '../lib/icons'
import {
  BOTS_MODEL_CONFIRM_TITLE,
  MODEL_CHIP_PENDING_SUFFIX,
  MODEL_CHIP_SEARCH_PLACEHOLDER,
  MODEL_CHIP_SHEET_TITLE,
  MODEL_CHIP_THIS_CHAT_SECTION
} from '../lib/strings.mobile'
import { t } from '../lib/t'
import { useTheme } from '../theme/provider'
import { radius, type } from '../theme/type'

import { interpretConfigSwitchResult } from './model-effort-chip-logic'

interface ModelOption {
  model: string
  provider: string
}

export interface ModelChipProps {
  model: string
  provider: string
  storedSessionId: string
}

/**
 * The composer's model chip (M15 B, task 1) —
 * docs/mobile-prototypes/chat.html:357-382's `#chat=model` sheet. Always
 * session-scoped (`setSessionModel`, src/api/models.ts:145-157 —
 * unconditionally sends `--session`, per D17.3: the composer chip can never
 * move `model.default`). Options come from the same
 * `getGlobalModelOptions`/flatten shape `BotSettingsSheet.tsx`'s model menu
 * already uses.
 */
export function ModelChip({ model, provider, storedSessionId }: ModelChipProps) {
  const tokens = useTheme()
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ModelOption[] | null>(null)
  const [pending, setPending] = useState<null | ModelOption>(null)

  useEffect(() => {
    if (pending && pending.model === model && pending.provider === provider) {
      setPending(null)
    }
  }, [model, pending, provider])

  const open = () => {
    setVisible(true)

    if (options === null) {
      void getGlobalModelOptions({ includeUnconfigured: false })
        .then(response => {
          const flat = (response.providers || []).flatMap(providerEntry =>
            (providerEntry.models || []).map(modelName => ({ model: modelName, provider: providerEntry.slug }))
          )

          setOptions(flat)
        })
        .catch(() => {
          setOptions([])
        })
    }
  }

  const pick = async (option: ModelOption, confirmExpensiveModel = false) => {
    setVisible(false)

    try {
      const result = await setSessionModel(storedSessionId, option.model, option.provider, confirmExpensiveModel)
      const outcome = interpretConfigSwitchResult(result)

      if (outcome.kind === 'confirm-required') {
        Alert.alert(BOTS_MODEL_CONFIRM_TITLE, outcome.message, [
          { style: 'cancel', text: t.common.cancel },
          { onPress: () => void pick(option, true), text: t.common.confirm }
        ])

        return
      }

      if (outcome.kind === 'deferred') {
        setPending(option)

        return
      }

      setPending(null)
    } catch {
      // The chip keeps showing the last-confirmed model; nothing to roll
      // back optimistically since nothing was set ahead of confirmation.
    }
  }

  const filtered = (options ?? []).filter(option => {
    const needle = query.trim().toLowerCase()

    return !needle || option.model.toLowerCase().includes(needle) || option.provider.toLowerCase().includes(needle)
  })

  const label = pending ? `${pending.model}${MODEL_CHIP_PENDING_SUFFIX}` : model || '—'

  return (
    <>
      <Pressable
        accessibilityLabel={MODEL_CHIP_SHEET_TITLE}
        accessibilityRole="button"
        onPress={open}
        style={[styles.chip, { backgroundColor: tokens.muted, borderColor: tokens.border }]}
      >
        <Text numberOfLines={1} style={[styles.text, { color: tokens.foreground }]}>
          {label}
        </Text>
      </Pressable>
      <Sheet onClose={() => setVisible(false)} title={MODEL_CHIP_SHEET_TITLE} visible={visible}>
        <Input onChangeText={setQuery} placeholder={MODEL_CHIP_SEARCH_PLACEHOLDER} value={query} />
        <Text style={[styles.section, { color: tokens.textTertiary }]}>{MODEL_CHIP_THIS_CHAT_SECTION}</Text>
        {/* On Android, a ScrollView nested in Sheet.tsx's percentage-height
            `body` (maxHeight: '88%' of an auto-sized ancestor) measures to
            zero height even with its own maxHeight/height style — confirmed
            on-device: state held all 58 fetched options and re-rendered them,
            but nothing appeared, because the ScrollView itself collapsed.
            Giving a plain View (which sizes correctly in that same ancestor
            chain) the explicit height and letting the ScrollView fill it via
            flex:1 works around it. */}
        <View style={styles.listOuter}>
          <ScrollView style={styles.list}>
            {filtered.map(option => {
              const active = option.model === model && option.provider === provider

              return (
                <Pressable
                  key={`${option.provider}/${option.model}`}
                  onPress={() => void pick(option)}
                  style={styles.row}
                >
                  {active ? <Check color={tokens.primary} size={16} /> : <View style={styles.checkSpacer} />}
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: active ? tokens.primary : tokens.foreground }]}>
                      {option.model}
                    </Text>
                    <Text style={[styles.rowSub, { color: tokens.textTertiary }]}>{option.provider}</Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  checkSpacer: {
    width: 16
  },
  chip: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 160,
    minHeight: 48,
    paddingHorizontal: 14
  },
  list: {
    flex: 1
  },
  // Round 9 found the last row always part-cut: 320 isn't a multiple of the
  // measured 58 dp row pitch (320 / 58 = 5 full rows + a 30 dp remainder).
  // 348 (6 × 58) is the next multiple at or above 320, so the sheet shows
  // one more full row instead of a partial one.
  listOuter: {
    height: 348
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8
  },
  rowLabel: {
    ...type.body
  },
  rowSub: {
    ...type.caption
  },
  rowText: {
    flex: 1,
    gap: 2
  },
  section: {
    ...type.caption,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
    textTransform: 'uppercase'
  },
  text: {
    ...type.label
  }
})
