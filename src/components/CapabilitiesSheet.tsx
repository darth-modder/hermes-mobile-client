import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { type BotProfileDetail, configureBot, describeBot, skillsServerKeptEnabled } from '../api/bots'
import {
  BOTS_CAPABILITIES_SEARCH_PLACEHOLDER,
  BOTS_CAPABILITIES_SKILLS_SECTION,
  BOTS_CAPABILITIES_TITLE,
  BOTS_CAPABILITIES_TOOLSETS_SECTION,
  botsCapabilitiesSkillLockedNote
} from '../lib/strings.mobile'
import { t } from '../lib/t'
import { useTheme } from '../theme/provider'
import { type as typeTokens } from '../theme/type'

import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Sheet } from './ui/Sheet'

/**
 * Replicates: docs/mobile-prototypes/bots.html's `settings` view's
 * Capabilities row, opened as its own sheet (M15 A round 2, task 2):
 * installed skills and toolsets with per-bot toggles and a search over
 * both. `profiles.configure`'s `disabled_skills`/`enabled_toolsets` do the
 * write (`src/api/bots.ts`'s `configureBot`); the toolset write follows the
 * desktop's own rule for what "pin" means
 * (`apps/desktop/src/plugins/hermes-bots/profile-config.tsx:585-590`):
 * "All enabled (or none) = clear the pin; otherwise pin the checked set" —
 * `payload.enabled_toolsets = enabled.length === all || enabled.length ===
 * 0 ? [] : enabled.map(t => t.name)`, quoted and ported below verbatim.
 *
 * M15 A-close round 1: `save()` re-reads `profiles.describe` after
 * `configureBot` and renders ITS skills/toolsets, not the local toggle
 * state — the server silently keeps an essential skill enabled
 * (`skillsServerKeptEnabled` in `src/api/bots.ts`) and the sheet has no
 * other way to learn that happened.
 */
export interface CapabilitiesSheetProps {
  detail: BotProfileDetail
  onClose: () => void
  onSaved: (updated: BotProfileDetail) => void
  profileName: string
  visible: boolean
}

export function CapabilitiesSheet({ detail, onClose, onSaved, profileName, visible }: CapabilitiesSheetProps) {
  const tokens = useTheme()
  const [skills, setSkills] = useState(detail.skills)
  const [toolsets, setToolsets] = useState(detail.toolsets)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [lockedSkillNames, setLockedSkillNames] = useState<string[]>([])

  const detailRef = useRef(detail)

  detailRef.current = detail

  // Resets ONLY on a visible transition (sheet freshly opened) — not on
  // every `detail` prop change while it stays open. Depending on `detail`
  // directly used to wipe `lockedSkillNames` (and the freshly-loaded skills/
  // toolsets) the instant `save()` set them: `onSaved(fresh)` updates the
  // parent's `detail`, which re-triggered this effect and reset the very
  // note it had just shown. `save()` already applies the server's fresh
  // state directly; this effect only needs to run for a genuine re-open.
  useEffect(() => {
    if (visible) {
      setSkills(detailRef.current.skills)
      setToolsets(detailRef.current.toolsets)
      setQuery('')
      setError(null)
      setLockedSkillNames([])
    }
  }, [visible])

  const filteredSkills = useMemo(
    () => skills.filter(skill => skill.name.toLowerCase().includes(query.toLowerCase())),
    [skills, query]
  )

  const filteredToolsets = useMemo(
    () =>
      toolsets.filter(
        toolset =>
          toolset.name.toLowerCase().includes(query.toLowerCase()) ||
          toolset.label.toLowerCase().includes(query.toLowerCase())
      ),
    [toolsets, query]
  )

  const save = async () => {
    setSaving(true)
    setError(null)
    setLockedSkillNames([])

    // profile-config.tsx:585-590, quoted in this file's header: all-or-none
    // toggled = clear the pin, otherwise pin the checked set.
    const allToolsets = toolsets.length
    const enabledToolsets = toolsets.filter(toolset => toolset.enabled)

    const enabledToolsetNames =
      enabledToolsets.length === allToolsets || enabledToolsets.length === 0
        ? []
        : enabledToolsets.map(toolset => toolset.name)

    const attemptedToDisable = new Set(skills.filter(skill => !skill.enabled).map(skill => skill.name))

    try {
      await configureBot(profileName, {
        disabledSkills: [...attemptedToDisable],
        enabledToolsets: enabledToolsetNames
      })

      // The write is fire-and-forget from the server's point of view — an
      // essential skill (e.g. hermes-agent) is silently kept enabled
      // (hermes_cli/skills_config.py:43-54), and `profiles.configure`'s own
      // response doesn't say which skill that was, only that the section was
      // applied. Re-reading `profiles.describe` is the only way to know what
      // actually landed, so the sheet renders the server's truth, not the
      // local toggle state the desktop request never confirmed.
      const fresh = await describeBot(profileName)

      setSkills(fresh.skills)
      setToolsets(fresh.toolsets)

      const stillEnabled = skillsServerKeptEnabled(attemptedToDisable, fresh.skills)

      setLockedSkillNames(stillEnabled)
      onSaved(fresh)

      if (stillEnabled.length === 0) {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      footer={
        <Button block loading={saving} onPress={() => void save()} variant="primary">
          {t.common.save}
        </Button>
      }
      onClose={onClose}
      title={BOTS_CAPABILITIES_TITLE}
      visible={visible}
    >
      <Input onChangeText={setQuery} placeholder={BOTS_CAPABILITIES_SEARCH_PLACEHOLDER} value={query} />

      {filteredSkills.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{BOTS_CAPABILITIES_SKILLS_SECTION}</Text>
          {filteredSkills.map(skill => (
            <View key={skill.name}>
              <Pressable
                onPress={() =>
                  setSkills(current => current.map(s => (s.name === skill.name ? { ...s, enabled: !s.enabled } : s)))
                }
                style={styles.row}
              >
                <Text numberOfLines={1} style={[styles.rowLabel, { color: tokens.foreground }]}>
                  {skill.name}
                </Text>
                <Switch
                  onValueChange={enabled =>
                    setSkills(current => current.map(s => (s.name === skill.name ? { ...s, enabled } : s)))
                  }
                  value={skill.enabled}
                />
              </Pressable>
              {lockedSkillNames.includes(skill.name) ? (
                <Text style={[styles.rowSub, { color: tokens.destructive }]}>
                  {botsCapabilitiesSkillLockedNote(skill.name)}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {filteredToolsets.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>
            {BOTS_CAPABILITIES_TOOLSETS_SECTION}
          </Text>
          {filteredToolsets.map(toolset => (
            <Pressable
              key={toolset.name}
              onPress={() =>
                setToolsets(current =>
                  current.map(ts => (ts.name === toolset.name ? { ...ts, enabled: !ts.enabled } : ts))
                )
              }
              style={styles.row}
            >
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={[styles.rowLabel, { color: tokens.foreground }]}>
                  {toolset.label}
                </Text>
                <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.mutedForeground }]}>
                  {toolset.description}
                </Text>
              </View>
              <Switch
                onValueChange={enabled =>
                  setToolsets(current => current.map(ts => (ts.name === toolset.name ? { ...ts, enabled } : ts)))
                }
                value={toolset.enabled}
              />
            </Pressable>
          ))}
        </>
      ) : null}

      {error ? <Text style={[styles.errorText, { color: tokens.destructive }]}>{error}</Text> : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  errorText: {
    ...typeTokens.bodySmall,
    textAlign: 'center'
  },
  // M15 A-close round 1, task 4: `minHeight: 48` sizes this row, but a bare
  // Switch renders at its own native platform size regardless of the
  // container — device-measured at ~46.5×27dp, under the 48dp minimum in
  // both dimensions. The row is now a Pressable that toggles the same
  // value, so the full row is the touch target; the Switch itself stays
  // wired for a tap landing directly on it.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 6
  },
  rowLabel: {
    ...typeTokens.body,
    flex: 1
  },
  rowSub: {
    ...typeTokens.caption
  },
  rowText: {
    flex: 1,
    marginRight: 8
  },
  sectionLabel: {
    ...typeTokens.caption,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase'
  }
})
