import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'

import { type BotProfileDetail, configureBot } from '../api/bots'
import {
  BOTS_CAPABILITIES_SEARCH_PLACEHOLDER,
  BOTS_CAPABILITIES_SKILLS_SECTION,
  BOTS_CAPABILITIES_TITLE,
  BOTS_CAPABILITIES_TOOLSETS_SECTION
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

  useEffect(() => {
    if (visible) {
      setSkills(detail.skills)
      setToolsets(detail.toolsets)
      setQuery('')
      setError(null)
    }
  }, [detail, visible])

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

    // profile-config.tsx:585-590, quoted in this file's header: all-or-none
    // toggled = clear the pin, otherwise pin the checked set.
    const allToolsets = toolsets.length
    const enabledToolsets = toolsets.filter(toolset => toolset.enabled)

    const enabledToolsetNames =
      enabledToolsets.length === allToolsets || enabledToolsets.length === 0
        ? []
        : enabledToolsets.map(toolset => toolset.name)

    try {
      await configureBot(profileName, {
        disabledSkills: skills.filter(skill => !skill.enabled).map(skill => skill.name),
        enabledToolsets: enabledToolsetNames
      })
      onSaved({ ...detail, skills, toolsets })
      onClose()
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
            <View key={skill.name} style={styles.row}>
              <Text numberOfLines={1} style={[styles.rowLabel, { color: tokens.foreground }]}>
                {skill.name}
              </Text>
              <Switch
                onValueChange={enabled =>
                  setSkills(current => current.map(s => (s.name === skill.name ? { ...s, enabled } : s)))
                }
                value={skill.enabled}
              />
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
            <View key={toolset.name} style={styles.row}>
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
            </View>
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
