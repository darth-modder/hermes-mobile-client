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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { createProfile, deleteProfile, getProfiles } from '../../../src/api/profiles'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  PROFILES_DEFAULT_SUBTITLE,
  PROFILES_DELETE_HINT,
  PROFILES_EXPLAINER,
  PROFILES_NAME_PLACEHOLDER
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { HttpError } from '../../../src/net/http'
import { $activeProfile, setActiveProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { ProfileInfo } from '../../../src/upstream/types/hermes'

// Replicates: docs/desktop-prototypes/a-main/profiles.html (ProfilesView
// row anatomy: name, model/skill-count subtitle, a checkmark for the
// active row). That prototype's own detail pane (SOUL.md editor, per-
// profile stats) isn't ported — the desktop's own header comment already
// says "Mobile: Profiles is at parity on mobile" for the create/switch/
// delete surface this screen has had since M09, and a SOUL.md editor is
// new functionality this layout pass doesn't add. Its Create/Rename/Delete
// dialogs becoming bottom sheets (the M14 adaptation-rules table's "Dialogs
// with a form" row) is its own later M14 task ("dialogs to sheets and
// alerts", last in the task list) — this screen's inline create form and
// native Delete Alert are left as they are for now, not converted here.
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
  const [newName, setNewName] = useState('')

  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryFn: () => getProfiles(),
    queryKey: ['profiles']
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => createProfile({ name }),
    onSuccess: (_result, name) => {
      setNewName('')
      setActiveProfile(name)
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
        { style: 'cancel', text: 'Cancel' },
        { onPress: () => deleteMutation.mutate(profile.name), style: 'destructive', text: 'Delete' }
      ]
    )
  }

  const submitCreate = () => {
    const name = newName.trim()

    if (name) {
      createMutation.mutate(name)
    }
  }

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
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
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

        {data?.profiles
          .filter(profile => !profile.is_default)
          .map(profile => (
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
              {activeProfile === profile.name ? (
                <Text style={[styles.checkmark, { color: tokens.semantic.green }]}>✓</Text>
              ) : null}
            </TouchableOpacity>
          ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.profiles.newProfile}</Text>
        <View style={styles.createRow}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setNewName}
            onSubmitEditing={submitCreate}
            placeholder={PROFILES_NAME_PLACEHOLDER}
            placeholderTextColor={tokens.mutedForeground}
            style={[
              styles.input,
              { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
            ]}
            value={newName}
          />
          <TouchableOpacity
            disabled={createMutation.isPending || !newName.trim()}
            onPress={submitCreate}
            style={[styles.createButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={[styles.createButtonText, { color: tokens.primaryForeground }]}>
              {createMutation.isPending ? t.profiles.creating : t.profiles.createAction}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: tokens.mutedForeground }]}>{t.profiles.nameHint}</Text>
        {createMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {createMutation.error instanceof HttpError ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
        <Text style={[styles.hint, { color: tokens.mutedForeground }]}>{PROFILES_DELETE_HINT}</Text>
        <TouchableOpacity hitSlop={10} onPress={() => void refetch()} style={styles.refreshButton}>
          <Text style={[styles.refreshText, { color: tokens.mutedForeground }]}>{t.profiles.refresh}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  createButton: {
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14
  },
  createButtonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  errorText: {
    ...type.caption,
    marginTop: 8
  },
  hint: {
    ...type.caption,
    marginTop: 10
  },
  input: {
    ...type.bodySmall,
    borderRadius: radius.control,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  refreshButton: {
    alignSelf: 'flex-start',
    marginTop: 16
  },
  refreshText: {
    ...type.label
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
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginVertical: 12
  }
})
