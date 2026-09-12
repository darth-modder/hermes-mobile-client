import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { createProfile, deleteProfile, getProfiles, renameProfile } from '../../../src/api/profiles'
import { Button } from '../../../src/components/ui/Button'
import { Input } from '../../../src/components/ui/Input'
import { Menu } from '../../../src/components/ui/Menu'
import { Sheet } from '../../../src/components/ui/Sheet'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  PROFILES_DEFAULT_SUBTITLE,
  PROFILES_DELETE_HINT,
  PROFILES_EXPLAINER,
  PROFILES_NAME_PLACEHOLDER,
  PROFILES_RENAME_WRAPPER_PATH
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { HttpError } from '../../../src/net/http'
import { $activeProfile, setActiveProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { ProfileInfo } from '../../../src/upstream/types/hermes'

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

// Replicates: docs/desktop-prototypes/a-main/profiles.html (ProfilesView
// row anatomy: name, model/skill-count subtitle, a checkmark for the
// active row) plus docs/desktop-prototypes/f-dialogs/profile-dialogs.html's
// Create and Rename forms, now Sheets (M14 task 5) — this file's own header
// used to say those and Delete were "becoming bottom sheets" together, but
// that overstated it: the M14 mapping's Section F puts Delete with
// `confirm.html` (native `Alert`, unchanged) and only the two FORM dialogs
// (Create, Rename) with the "dialogs with a form -> Sheet" rule. Fields and
// order match the prototype: Name + Clone from for Create (validated with
// the same `/^[a-z0-9][a-z0-9_-]{0,63}$/` the prototype's own hint
// describes); New name for Rename. profile-dialogs.html's SOUL.md textarea
// on Create is left out — `src/api/profiles.ts`'s own header says soul
// editing was never ported ("no named M09 sub-screen covers them"), and
// `ProfileCreatePayload` (src/upstream/types/hermes.ts) has no soul field
// to send it to. The "Name this agent" variant (renaming the DEFAULT
// profile's display name, not its slug) is also not built: checked
// ProfileInfo and every src/api/profiles.ts export — `display_name` is
// read-only there, no endpoint sets it, so a sheet with that field could
// only fail or silently do the wrong thing (a real slug rename of the
// profile the prototype says must stay "default"). Rename below is scoped
// to non-default profiles, backed by the real (already existing, until now
// unused anywhere) `renameProfile` API.
//
// A per-row "Rename" control is now always visible (not gated behind the
// long-press that still opens Delete) per the M14 adaptation rule
// ("Hover-revealed controls ... always visible, or behind long-press when
// they are destructive" — rename isn't destructive).
//
// That prototype's own detail pane (SOUL.md editor, per-profile stats)
// isn't ported — the desktop's own header comment already says "Mobile:
// Profiles is at parity on mobile" for the create/switch/delete surface
// this screen has had since M09, and a SOUL.md editor is new functionality
// this layout pass doesn't add.
/**
 * Profiles settings screen (M09). Switching sets `$activeProfile`, which
 * scopes REST calls (`?profile=`) and `session.create`'s `profile` field —
 * the session list screen re-fetches under the new scope the next time it
 * regains focus (exit criterion: "a profile switch changes the sessions
 * list").
 */
export default function ProfilesSettings() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [cloneFrom, setCloneFrom] = useState<null | string>('default')
  const [cloneMenuOpen, setCloneMenuOpen] = useState(false)

  const [renameTarget, setRenameTarget] = useState<null | ProfileInfo>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryFn: () => getProfiles(),
    queryKey: ['profiles']
  })

  const createMutation = useMutation({
    mutationFn: (args: { cloneFrom: null | string; name: string }) =>
      createProfile({
        name: args.name,
        ...(args.cloneFrom === null
          ? {}
          : args.cloneFrom === 'default'
            ? { clone_from_default: true }
            : { clone_from: args.cloneFrom })
      }),
    onSuccess: (_result, args) => {
      setCreateOpen(false)
      setCreateName('')
      setCloneFrom('default')
      setActiveProfile(args.name)
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  const renameMutation = useMutation({
    mutationFn: (args: { name: string; newName: string }) => renameProfile(args.name, args.newName),
    onSuccess: (_result, args) => {
      setRenameTarget(null)

      if (activeProfile === args.name) {
        setActiveProfile(args.newName)
      }

      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteProfile(name),
    onSuccess: (_result, name) => {
      if (activeProfile === name) {
        setActiveProfile('')
      }

      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  const confirmDelete = (profile: ProfileInfo) => {
    Alert.alert(
      t.profiles.deleteTitle,
      `${t.profiles.deleteDescPrefix}${profile.name}${t.profiles.deleteDescMid}${profile.name}${t.profiles.deleteDescSuffix}`,
      [
        { style: 'cancel', text: t.common.cancel },
        { onPress: () => deleteMutation.mutate(profile.name), style: 'destructive', text: t.common.delete }
      ]
    )
  }

  const trimmedCreateName = createName.trim()
  const createNameValid = NAME_PATTERN.test(trimmedCreateName)

  const submitCreate = () => {
    if (createNameValid) {
      createMutation.mutate({ cloneFrom, name: trimmedCreateName })
    }
  }

  const openRename = (profile: ProfileInfo) => {
    renameMutation.reset()
    setRenameValue(profile.name)
    setRenameTarget(profile)
  }

  const trimmedRenameName = renameValue.trim()
  const renameNameValid = NAME_PATTERN.test(trimmedRenameName)
  const renameUnchanged = renameTarget !== null && trimmedRenameName === renameTarget.name

  const submitRename = () => {
    if (renameTarget && renameNameValid && !renameUnchanged) {
      renameMutation.mutate({ name: renameTarget.name, newName: trimmedRenameName })
    }
  }

  const otherProfiles = (data?.profiles ?? []).filter(profile => !profile.is_default)

  const cloneMenuItems = [
    { key: 'none', label: t.profiles.cloneFromNone, onPress: () => setCloneFrom(null) },
    { key: 'default', label: t.profiles.default, onPress: () => setCloneFrom('default') },
    ...otherProfiles.map(profile => ({
      key: profile.name,
      label: profile.display_name || profile.name,
      onPress: () => setCloneFrom(profile.name)
    }))
  ].map(item => ({ ...item, active: item.key === (cloneFrom ?? 'none') }))

  const cloneFromLabel =
    cloneFrom === null
      ? t.profiles.cloneFromNone
      : cloneFrom === 'default'
        ? t.profiles.default
        : (otherProfiles.find(profile => profile.name === cloneFrom)?.display_name ?? cloneFrom)

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.profiles.title }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refetch()}
            refreshing={isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{PROFILES_EXPLAINER}</Text>

        {isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {error ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {error instanceof Error ? error.message : String(error)}
            </Text>
            <TouchableOpacity hitSlop={10} onPress={() => void refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => setActiveProfile('')}
          style={[
            styles.row,
            { backgroundColor: tokens.card, borderColor: activeProfile === '' ? tokens.rowActive : tokens.border }
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{t.profiles.default}</Text>
            <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>{PROFILES_DEFAULT_SUBTITLE}</Text>
          </View>
          {activeProfile === '' ? <Text style={[styles.checkmark, { color: tokens.semantic.green }]}>✓</Text> : null}
        </TouchableOpacity>

        {otherProfiles.map(profile => (
          <TouchableOpacity
            key={profile.name}
            onLongPress={() => confirmDelete(profile)}
            onPress={() => setActiveProfile(profile.name)}
            style={[
              styles.row,
              {
                backgroundColor: tokens.card,
                borderColor: activeProfile === profile.name ? tokens.rowActive : tokens.border
              }
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>
                {profile.display_name || profile.name}
              </Text>
              <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {t.profiles.skills(profile.skill_count)}
                {profile.model ? ` · ${profile.model}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel={t.profiles.rename}
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => openRename(profile)}
              style={styles.renameButton}
            >
              <Text style={[styles.renameText, { color: tokens.primary }]}>{t.profiles.rename}</Text>
            </TouchableOpacity>
            {activeProfile === profile.name ? (
              <Text style={[styles.checkmark, { color: tokens.semantic.green }]}>✓</Text>
            ) : null}
          </TouchableOpacity>
        ))}

        <Button block onPress={() => setCreateOpen(true)} style={styles.newProfileButton} variant="secondary">
          {t.profiles.newProfile}
        </Button>
        <Text style={[styles.hint, { color: tokens.mutedForeground }]}>{PROFILES_DELETE_HINT}</Text>
        <TouchableOpacity hitSlop={10} onPress={() => void refetch()} style={styles.refreshButton}>
          <Text style={[styles.refreshText, { color: tokens.mutedForeground }]}>{t.profiles.refresh}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Sheet
        footer={
          <>
            <Button block onPress={() => setCreateOpen(false)} style={styles.sheetFooterButton} variant="ghost">
              {t.common.cancel}
            </Button>
            <Button
              block
              disabled={!createNameValid}
              loading={createMutation.isPending}
              onPress={submitCreate}
              style={styles.sheetFooterButton}
              variant="primary"
            >
              {t.profiles.createAction}
            </Button>
          </>
        }
        onClose={() => setCreateOpen(false)}
        title={t.profiles.newProfile}
        visible={createOpen}
      >
        <Text style={[styles.sheetDesc, { color: tokens.mutedForeground }]}>{t.profiles.createDesc}</Text>
        <Input
          autoCapitalize="none"
          autoFocus
          error={createName && !createNameValid ? t.profiles.invalidName(t.profiles.nameHint) : undefined}
          hint={createName && !createNameValid ? undefined : t.profiles.nameHint}
          label={t.profiles.nameLabel}
          onChangeText={setCreateName}
          onSubmitEditing={submitCreate}
          placeholder={PROFILES_NAME_PLACEHOLDER}
          value={createName}
        />
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: tokens.textTertiary }]}>{t.profiles.cloneFrom}</Text>
          <TouchableOpacity
            onPress={() => setCloneMenuOpen(true)}
            style={[styles.select, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <Text style={[styles.selectText, { color: tokens.foreground }]}>{cloneFromLabel}</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: tokens.mutedForeground }]}>{t.profiles.cloneFromDesc}</Text>
        </View>
        {createMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {createMutation.error instanceof HttpError ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
      </Sheet>

      <Menu
        items={cloneMenuItems}
        onClose={() => setCloneMenuOpen(false)}
        title={t.profiles.cloneFrom}
        visible={cloneMenuOpen}
      />

      <Sheet
        footer={
          <>
            <Button block onPress={() => setRenameTarget(null)} style={styles.sheetFooterButton} variant="ghost">
              {t.common.cancel}
            </Button>
            <Button
              block
              disabled={!renameNameValid || renameUnchanged}
              loading={renameMutation.isPending}
              onPress={submitRename}
              style={styles.sheetFooterButton}
              variant="primary"
            >
              {t.profiles.rename}
            </Button>
          </>
        }
        onClose={() => setRenameTarget(null)}
        title={t.profiles.renameTitle}
        visible={renameTarget !== null}
      >
        <Text style={[styles.sheetDesc, { color: tokens.mutedForeground }]}>
          {t.profiles.renameDescPrefix}
          {PROFILES_RENAME_WRAPPER_PATH}
          {t.profiles.renameDescSuffix}
        </Text>
        <Input
          autoCapitalize="none"
          autoFocus
          error={renameValue && !renameNameValid ? t.profiles.invalidName(t.profiles.nameHint) : undefined}
          hint={renameValue && !renameNameValid ? undefined : t.profiles.nameHint}
          label={t.profiles.newNameLabel}
          onChangeText={setRenameValue}
          onSubmitEditing={submitRename}
          value={renameValue}
        />
        {renameMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {renameMutation.error instanceof HttpError ? renameMutation.error.message : String(renameMutation.error)}
          </Text>
        ) : null}
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  checkmark: {
    ...type.body,
    fontWeight: '700'
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  errorText: {
    ...type.caption,
    marginTop: 8
  },
  field: {
    gap: 6,
    marginTop: 16
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  hint: {
    ...type.caption,
    marginTop: 10
  },
  newProfileButton: {
    marginTop: 20
  },
  refreshButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48
  },
  refreshText: {
    ...type.label
  },
  renameButton: {
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  renameText: {
    ...type.caption,
    fontWeight: '600'
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 6
  },
  retryText: {
    ...type.label,
    fontWeight: '600'
  },
  row: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    ...type.body,
    fontWeight: '600'
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 12
  },
  select: {
    borderRadius: radius.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12
  },
  selectText: {
    ...type.bodySmall
  },
  sheetDesc: {
    ...type.caption,
    marginBottom: 8
  },
  sheetFooterButton: {
    flex: 1
  },
  spinner: {
    marginVertical: 12
  }
})
