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
import { HttpError } from '../../../src/net/http'
import { $activeProfile, setActiveProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'
import type { ProfileInfo } from '../../../src/upstream/types/hermes'

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
    Alert.alert('Delete profile?', profile.name, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => deleteMutation.mutate(profile.name), style: 'destructive', text: 'Delete' }
    ])
  }

  const submitCreate = () => {
    const name = newName.trim()

    if (name) {
      createMutation.mutate(name)
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Profiles' }} />
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
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          A profile is a separate config, sessions, and skill set on the same backend. Switching scopes every settings
          screen and new sessions to it.
        </Text>

        {isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {error ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {error instanceof Error ? error.message : String(error)}
            </Text>
            <TouchableOpacity onPress={() => void refetch()} style={styles.retryButton}>
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
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>default</Text>
            <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
              The connection&apos;s default profile
            </Text>
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
                  {profile.skill_count} skill{profile.skill_count === 1 ? '' : 's'}
                  {profile.model ? ` · ${profile.model}` : ''}
                </Text>
              </View>
              {activeProfile === profile.name ? (
                <Text style={[styles.checkmark, { color: tokens.semantic.green }]}>✓</Text>
              ) : null}
            </TouchableOpacity>
          ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>New profile</Text>
        <View style={styles.createRow}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setNewName}
            onSubmitEditing={submitCreate}
            placeholder="profile name"
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
              {createMutation.isPending ? '…' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
        {createMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {createMutation.error instanceof HttpError ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
        <Text style={[styles.hint, { color: tokens.mutedForeground }]}>
          Long-press a profile to delete it. The default profile cannot be deleted.
        </Text>
        <TouchableOpacity onPress={() => void refetch()} style={styles.refreshButton}>
          <Text style={[styles.refreshText, { color: tokens.mutedForeground }]}>Refresh</Text>
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
    borderRadius: 8,
    justifyContent: 'center',
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
    borderRadius: 8,
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
    borderRadius: 8,
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
