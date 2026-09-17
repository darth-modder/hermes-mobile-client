import { describe, expect, it } from 'vitest'

import {
  effortChipLabel,
  effortOptions,
  interpretConfigSwitchResult,
  normalizeEffortValue
} from './model-effort-chip-logic'

describe('effortOptions', () => {
  it('lists the off state plus all seven VALID_REASONING_EFFORTS words, in ascending order', () => {
    expect(effortOptions().map(o => o.value)).toEqual([
      'none',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
      'ultra'
    ])
  })

  it('labels come from the vendored strings, not retyped copy', () => {
    const byValue = Object.fromEntries(effortOptions().map(o => [o.value, o.label]))

    expect(byValue.none).toBe('Off')
    expect(byValue.medium).toBe('Medium')
    expect(byValue.xhigh).toBe('Extra High')
  })
})

describe('effortChipLabel', () => {
  it('shows the off label for empty, "none", "false" and "disabled"', () => {
    expect(effortChipLabel('')).toBe('Off')
    expect(effortChipLabel('none')).toBe('Off')
    expect(effortChipLabel('false')).toBe('Off')
    expect(effortChipLabel('disabled')).toBe('Off')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(effortChipLabel(' Medium ')).toBe('Medium')
    expect(effortChipLabel('XHIGH')).toBe('Extra High')
  })

  it('falls back to the raw value for an unrecognized word rather than blanking the chip', () => {
    expect(effortChipLabel('turbo')).toBe('turbo')
  })
})

describe('normalizeEffortValue', () => {
  it('collapses empty/false/disabled to "none"', () => {
    expect(normalizeEffortValue('')).toBe('none')
    expect(normalizeEffortValue('false')).toBe('none')
    expect(normalizeEffortValue('disabled')).toBe('none')
  })

  it('lowercases and trims a known level', () => {
    expect(normalizeEffortValue('  High  ')).toBe('high')
  })

  it('passes an unknown word through unchanged (lowercased)', () => {
    expect(normalizeEffortValue('Turbo')).toBe('turbo')
  })
})

describe('interpretConfigSwitchResult', () => {
  it('confirm_required takes priority even if deferred is also set', () => {
    expect(
      interpretConfigSwitchResult({
        confirm_message: 'This model costs more.',
        confirm_required: true,
        deferred: true,
        key: 'model',
        value: 'expensive-model'
      })
    ).toEqual({ kind: 'confirm-required', message: 'This model costs more.' })
  })

  it('confirm_required with no message still surfaces an empty string, not undefined', () => {
    expect(interpretConfigSwitchResult({ confirm_required: true, key: 'model', value: 'expensive-model' })).toEqual({
      kind: 'confirm-required',
      message: ''
    })
  })

  it('a mid-turn stashed switch reports deferred', () => {
    expect(interpretConfigSwitchResult({ deferred: true, key: 'model', value: 'deepseek-v4-flash' })).toEqual({
      kind: 'deferred'
    })
  })

  it('an ordinary switch reports applied', () => {
    expect(interpretConfigSwitchResult({ key: 'reasoning', value: 'high' })).toEqual({ kind: 'applied' })
  })
})
