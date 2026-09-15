// M15 B, task 1: the composer's model and effort chips share one RPC
// response shape (`SessionConfigSwitchResult`, src/api/models.ts:123-131) —
// this module is the pure decision logic both chips drive off of, kept out
// of the .tsx files so it's testable (this project's vitest setup doesn't
// render components).

import type { SessionConfigSwitchResult } from '../api/models'
import { t } from '../lib/t'

/** The gateway's accepted `reasoning` values (`config.set`'s `reasoning`
 *  key, `tui_gateway/methods_config_set.py:289-317`'s `_set_reasoning`) —
 *  `"none"`/`"false"`/`"disabled"` parse to thinking-disabled
 *  (`hermes_constants.py:876-889`'s `parse_reasoning_effort`); the seven
 *  on-scale words are `hermes_constants.py:873`'s `VALID_REASONING_EFFORTS`,
 *  mirrored by the desktop at apps/desktop/src/lib/reasoning-effort.ts:6
 *  (`REASONING_EFFORTS`). Labelled from the vendored `shell.modelOptions`
 *  block (src/upstream/i18n/en.ts:2996-3011) plus `settings.model.reasoningOff`
 *  (en.ts:1100) for the off state — `shell.modelOptions` itself has no
 *  "none"/"off" entry of its own. */
export interface EffortOption {
  label: string
  value: string
}

export function effortOptions(): EffortOption[] {
  return [
    { label: t.settings.model.reasoningOff, value: 'none' },
    { label: t.shell.modelOptions.minimal, value: 'minimal' },
    { label: t.shell.modelOptions.low, value: 'low' },
    { label: t.shell.modelOptions.medium, value: 'medium' },
    { label: t.shell.modelOptions.high, value: 'high' },
    { label: t.shell.modelOptions.xhigh, value: 'xhigh' },
    { label: t.shell.modelOptions.max, value: 'max' },
    { label: t.shell.modelOptions.ultra, value: 'ultra' }
  ]
}

/** A session's raw `reasoningEffort` (SessionState field, session-info.ts:
 *  71-72) collapsed to the option value the effort sheet highlights as
 *  active — `"none"` for empty/"false"/"disabled" (mirrors
 *  `parse_reasoning_effort`'s own off-synonyms, hermes_constants.py:885),
 *  otherwise the lowercased, trimmed word as-is (even if it isn't one of
 *  the seven known levels — see `effortChipLabel` below for why an unknown
 *  word is never silently dropped). */
export function normalizeEffortValue(reasoningEffort: string): string {
  const normalized = reasoningEffort.trim().toLowerCase()

  return !normalized || normalized === 'false' || normalized === 'disabled' ? 'none' : normalized
}

/** The label an effort chip shows for a session's current `reasoningEffort`
 *  — falls back to the raw value itself for anything not in the known set
 *  (an older/newer gateway word this app doesn't have a translated label
 *  for), never silently blanking the chip. Empty (no `session.info` seen
 *  yet, or the field was never set) shows the off-state label, since an
 *  un-set reasoning field reads as "nothing pinned" the same way the model
 *  chip shows nothing pinned — it does NOT assume the host's default is
 *  "medium" for display purposes; only the sheet's own picker (not this
 *  label) needs to guess a fallback, and it doesn't need to either, since
 *  every option is listed either way. */
export function effortChipLabel(reasoningEffort: string): string {
  const normalized = normalizeEffortValue(reasoningEffort)

  if (normalized === 'none') {
    return t.settings.model.reasoningOff
  }

  const known = effortOptions().find(option => option.value === normalized)

  return known ? known.label : reasoningEffort
}

// 'confirm-required' (kebab-case, not 'confirmRequired'): src/lib/labels.
// test.ts's retyped-label scanner treats any mixed-case .tsx string literal
// as suspect prose — this is a discriminant tag, not visible text, but the
// scanner has no AST-context carve-out for that (only for console-call
// arguments), so the value itself is kept all-lowercase to read as
// obviously technical, the same way every other kind here already does.
export type ConfigSwitchOutcome =
  { kind: 'applied' } | { kind: 'confirm-required'; message: string } | { kind: 'deferred' }

/**
 * `SessionConfigSwitchResult` -> what the chip should do next.
 * `confirm_required` (the expensive-model guard, `models.ts:207-212`'s own
 * docstring — reachable from the model chip only, `reasoning` has no such
 * guard) takes priority: the switch did NOT apply, and the caller must
 * resend with `confirmExpensiveModel: true` after the user confirms.
 * `deferred` (`methods_config_set.py:116-117`'s stashed mid-turn switch)
 * means the pick was accepted but the NEXT `session.info` for this session
 * still reports the pre-switch value until the current turn ends — the chip
 * should show a pending state rather than the picked value until then.
 */
export function interpretConfigSwitchResult(result: SessionConfigSwitchResult): ConfigSwitchOutcome {
  if (result.confirm_required) {
    return { kind: 'confirm-required', message: result.confirm_message ?? '' }
  }

  if (result.deferred) {
    return { kind: 'deferred' }
  }

  return { kind: 'applied' }
}
