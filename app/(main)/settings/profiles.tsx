import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { createProfile, deleteProfile, getProfiles } from '../../../src/api/profiles'
import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'
import { HttpError } from '../../../src/net/http'
import { $activeProfile, setActiveProfile } from '../../../src/store/profile'
import type { ProfileInfo } from '../../../src/upstream/types/hermes'

/**
 * Profiles settings screen (M09). Switching sets `$activeProfile`, which
 * scopes REST calls (`?profile=`) and `session.create`'s `profile` field —
 * the session list screen re-fetches under the new scope the next time it
 * regains focus (exit criterion: "a profile switch changes the sessions
 * list").
 */
export default function ProfilesSettings() {
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)
  const [newName, setNewName] = useState('')

  const { data, error, isLoading, refetch } = useQuery({ queryFn: () => getProfiles(), queryKey: ['profiles'] })

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
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Profiles' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHint}>
          A profile is a separate config, sessions, and skill set on the same backend. Switching scopes every settings
          screen and new sessions to it.
        </Text>

        {isLoading ? <ActivityIndicator color="#8a8a99" style={styles.spinner} /> : null}
        {error ? <Text style={styles.errorText}>{error instanceof Error ? error.message : String(error)}</Text> : null}

        <TouchableOpacity
          onPress={() => setActiveProfile('')}
          style={[styles.row, activeProfile === '' ? styles.rowActive : null]}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>default</Text>
            <Text style={styles.rowSubtitle}>The connection&apos;s default profile</Text>
          </View>
          {activeProfile === '' ? <Text style={styles.checkmark}>✓</Text> : null}
        </TouchableOpacity>

        {data?.profiles
          .filter(profile => !profile.is_default)
          .map(profile => (
            <TouchableOpacity
              key={profile.name}
              onLongPress={() => confirmDelete(profile)}
              onPress={() => setActiveProfile(profile.name)}
              style={[styles.row, activeProfile === profile.name ? styles.rowActive : null]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{profile.display_name || profile.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {profile.skill_count} skill{profile.skill_count === 1 ? '' : 's'}
                  {profile.model ? ` · ${profile.model}` : ''}
                </Text>
              </View>
              {activeProfile === profile.name ? <Text style={styles.checkmark}>✓</Text> : null}
            </TouchableOpacity>
          ))}

        <Text style={styles.sectionTitle}>New profile</Text>
        <View style={styles.createRow}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setNewName}
            onSubmitEditing={submitCreate}
            placeholder="profile name"
            placeholderTextColor="#5a5a66"
            style={styles.input}
            value={newName}
          />
          <TouchableOpacity
            disabled={createMutation.isPending || !newName.trim()}
            onPress={submitCreate}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>{createMutation.isPending ? '…' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
        {createMutation.isError ? (
          <Text style={styles.errorText}>
            {createMutation.error instanceof HttpError ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
        <Text style={styles.hint}>Long-press a profile to delete it. The default profile cannot be deleted.</Text>
        <TouchableOpacity onPress={() => void refetch()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  checkmark: {
    color: '#3fb950',
    fontSize: 16,
    fontWeight: '700'
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    padding: 16
  },
  createButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  createButtonText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  errorText: {
    color: '#e06c75',
    fontSize: 12,
    marginTop: 8
  },
  hint: {
    color: '#5a5a66',
    fontSize: 11,
    marginTop: 10
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f2f2f5',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  refreshButton: {
    alignSelf: 'flex-start',
    marginTop: 16
  },
  refreshText: {
    color: '#8a8a99',
    fontSize: 13
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12
  },
  rowActive: {
    borderColor: '#1f6feb'
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    color: '#f2f2f5',
    fontSize: 15,
    fontWeight: '600'
  },
  sectionHint: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 12
  },
  sectionTitle: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginVertical: 12
  }
})
