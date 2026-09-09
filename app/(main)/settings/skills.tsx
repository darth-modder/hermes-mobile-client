import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getOfficialSkills,
  getSkills,
  installSkillFromHub,
  setSkillEnabled,
  uninstallSkillFromHub
} from '../../../src/api/skills'
import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'
import { $activeProfile } from '../../../src/store/profile'

/**
 * Skills settings screen (M09). Exit criterion: "skill toggle persists" —
 * `setSkillEnabled` writes through the backend; this screen re-fetches
 * (`invalidateQueries`) rather than only flipping local state, so a stale
 * optimistic toggle can never look "persisted" when it wasn't.
 */
export default function SkillsSettings() {
  const queryClient = useQueryClient()
  const profile = useStore($activeProfile) || undefined

  const skillsQuery = useQuery({ queryFn: () => getSkills(profile), queryKey: ['skills', profile] })
  const officialQuery = useQuery({ queryFn: () => getOfficialSkills(profile), queryKey: ['official-skills', profile] })

  const toggleMutation = useMutation({
    mutationFn: (args: { enabled: boolean; name: string }) => setSkillEnabled(args.name, args.enabled, profile),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['skills', profile] })
  })

  const installMutation = useMutation({
    mutationFn: (identifier: string) => installSkillFromHub(identifier, profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skills', profile] })
      void queryClient.invalidateQueries({ queryKey: ['official-skills', profile] })
    }
  })

  const uninstallMutation = useMutation({
    mutationFn: (skillName: string) => uninstallSkillFromHub(skillName, profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skills', profile] })
      void queryClient.invalidateQueries({ queryKey: ['official-skills', profile] })
    }
  })

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Skills' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Installed</Text>
        {skillsQuery.isLoading ? <ActivityIndicator color="#8a8a99" /> : null}
        {skillsQuery.isError ? (
          <Text style={styles.errorText}>
            {skillsQuery.error instanceof Error ? skillsQuery.error.message : String(skillsQuery.error)}
          </Text>
        ) : null}
        {(skillsQuery.data ?? []).map(skill => (
          <View key={skill.name} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{skill.name}</Text>
              <Text numberOfLines={2} style={styles.rowSubtitle}>
                {skill.description}
              </Text>
            </View>
            <Switch
              onValueChange={value => toggleMutation.mutate({ enabled: value, name: skill.name })}
              value={skill.enabled}
            />
          </View>
        ))}
        {skillsQuery.data?.length === 0 ? <Text style={styles.sectionHint}>No skills installed.</Text> : null}

        <Text style={styles.sectionTitle}>Available to install</Text>
        {officialQuery.isLoading ? <ActivityIndicator color="#8a8a99" /> : null}
        {officialQuery.isError ? (
          <Text style={styles.errorText}>
            {officialQuery.error instanceof Error ? officialQuery.error.message : String(officialQuery.error)}
          </Text>
        ) : null}
        {(officialQuery.data?.skills ?? []).map(skill => (
          <View key={skill.identifier} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{skill.name}</Text>
              <Text numberOfLines={2} style={styles.rowSubtitle}>
                {skill.description}
              </Text>
            </View>
            {skill.installed ? (
              <TouchableOpacity onPress={() => uninstallMutation.mutate(skill.name)}>
                <Text style={styles.destructiveText}>Uninstall</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                disabled={installMutation.isPending && installMutation.variables === skill.identifier}
                onPress={() => installMutation.mutate(skill.identifier)}
              >
                <Text style={styles.actionText}>
                  {installMutation.isPending && installMutation.variables === skill.identifier ? '…' : 'Install'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionText: {
    color: '#1f6feb',
    fontSize: 13,
    fontWeight: '600'
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    color: '#e06c75',
    fontSize: 13,
    fontWeight: '600'
  },
  errorText: {
    color: '#e06c75',
    fontSize: 12,
    marginBottom: 8
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#17171d',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowText: {
    flex: 1,
    paddingRight: 12
  },
  rowTitle: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  sectionHint: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 6
  },
  sectionTitle: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  }
})
