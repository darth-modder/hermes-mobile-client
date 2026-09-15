import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { setSessionReasoningEffort } from '../api/models'
import { Menu, type MenuItem } from '../components/ui/Menu'
import { EFFORT_CHIP_SHEET_TITLE, MODEL_CHIP_PENDING_SUFFIX } from '../lib/strings.mobile'
import { useTheme } from '../theme/provider'
import { radius, type } from '../theme/type'

import {
  effortChipLabel,
  effortOptions,
  interpretConfigSwitchResult,
  normalizeEffortValue
} from './model-effort-chip-logic'

export interface EffortChipProps {
  reasoningEffort: string
  storedSessionId: string
}

/**
 * The composer's effort chip (M15 B, task 1) —
 * docs/mobile-prototypes/chat.html:384-407's `#chat=effort` sheet. Always
 * session-scoped (`setSessionReasoningEffort`, src/api/models.ts:174-180 —
 * no `scope` param needed the way the model chip's `--session` flag is:
 * `_set_reasoning` already scopes to the session by default whenever one is
 * present).
 */
export function EffortChip({ reasoningEffort, storedSessionId }: EffortChipProps) {
  const tokens = useTheme()
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState<null | string>(null)

  // The gateway has no "deferred" path for `reasoning` today (models.ts's
  // own header: "reasoning... has no such guard"), but a future gateway
  // could stash it the same way `model` does — this clears the pending
  // state once the session's own reported effort catches up, exactly like
  // ModelChip, so nothing here depends on that guard staying absent.
  useEffect(() => {
    if (pending !== null && normalizeEffortValue(reasoningEffort) === normalizeEffortValue(pending)) {
      setPending(null)
    }
  }, [pending, reasoningEffort])

  const pick = async (value: string) => {
    setVisible(false)

    try {
      const result = await setSessionReasoningEffort(storedSessionId, value)
      const outcome = interpretConfigSwitchResult(result)

      if (outcome.kind === 'deferred') {
        setPending(value)
      }
    } catch {
      // The chip keeps showing the last-confirmed effort; nothing to roll
      // back optimistically since nothing was set ahead of confirmation.
    }
  }

  const activeValue = normalizeEffortValue(pending ?? reasoningEffort)

  const items: MenuItem[] = effortOptions().map(option => ({
    active: option.value === activeValue,
    key: option.value,
    label: option.label,
    onPress: () => void pick(option.value)
  }))

  const label =
    pending !== null ? `${effortChipLabel(pending)}${MODEL_CHIP_PENDING_SUFFIX}` : effortChipLabel(reasoningEffort)

  return (
    <>
      <Pressable
        accessibilityLabel={EFFORT_CHIP_SHEET_TITLE}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={[styles.chip, { backgroundColor: tokens.muted, borderColor: tokens.border }]}
      >
        <Text numberOfLines={1} style={[styles.text, { color: tokens.foreground }]}>
          {label}
        </Text>
      </Pressable>
      <Menu items={items} onClose={() => setVisible(false)} title={EFFORT_CHIP_SHEET_TITLE} visible={visible} />
    </>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 140,
    minHeight: 48,
    paddingHorizontal: 14
  },
  text: {
    ...type.label
  }
})
