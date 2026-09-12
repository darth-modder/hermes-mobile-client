import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getOfficialSkills,
  getSkills,
  installSkillFromHub,
  setSkillEnabled,
  uninstallSkillFromHub
} from '../../../src/api/skills'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

// Replicates: docs/desktop-prototypes/a-main/capabilities.html's
// `data-view="skills"` panel (installed list + "Available to install"
// catalog). No dedicated mobile-prototype view exists for Skills — the
// M14 mapping's Skills/Toolsets/MCP tabs become three settings rows, this
// being one of them — and the desktop's MasterDetail (list + SKILL.md
// preview pane) stays a single list here, same structural-rewrite call as
// mcp.tsx. Section/action labels with a vendored match (D15.4): screen
// title (t.skills.tabSkills), "Available to install" -> officialCatalog,
// Install/Uninstall -> t.skills.hub.{install,uninstall} (the same hub
// install action this screen already calls).
/**
 * Skills settings screen (M09). Exit criterion: "skill toggle persists" —
 * `setSkillEnabled` writes through the backend; this screen re-fetches
 * (`invalidateQueries`) rather than only flipping local state, so a stale
 * optimistic toggle can never look "persisted" when it wasn't.
 */
export default function SkillsSettings() {
  const tokens = useTheme()
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

  const confirmUninstall = (skillName: string) => {
    Alert.alert('Uninstall skill?', skillName, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => uninstallMutation.mutate(skillName), style: 'destructive', text: t.skills.hub.uninstall }
    ])
  }

  const refreshing = skillsQuery.isRefetching || officialQuery.isRefetching

  const onRefresh = () => {
    void skillsQuery.refetch()
    void officialQuery.refetch()
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.skills.tabSkills }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={tokens.mutedForeground} />
        }
      >
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.skills.hub.installed}</Text>
        {skillsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {skillsQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {skillsQuery.error instanceof Error ? skillsQuery.error.message : String(skillsQuery.error)}
            </Text>
            <TouchableOpacity hitSlop={10} onPress={() => void skillsQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {(skillsQuery.data ?? []).map(skill => (
          <View key={skill.name} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{skill.name}</Text>
              <Text numberOfLines={2} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {skill.description}
              </Text>
            </View>
            <Switch
              onValueChange={value => toggleMutation.mutate({ enabled: value, name: skill.name })}
              value={skill.enabled}
            />
          </View>
        ))}
        {skillsQuery.data?.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No skills installed.</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.skills.officialCatalog}</Text>
        {officialQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {officialQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {officialQuery.error instanceof Error ? officialQuery.error.message : String(officialQuery.error)}
            </Text>
            <TouchableOpacity hitSlop={10} onPress={() => void officialQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {(officialQuery.data?.skills ?? []).map(skill => (
          <View key={skill.identifier} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{skill.name}</Text>
              <Text numberOfLines={2} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {skill.description}
              </Text>
            </View>
            {skill.installed ? (
              <TouchableOpacity hitSlop={10} onPress={() => confirmUninstall(skill.name)}>
                <Text style={[styles.destructiveText, { color: tokens.destructive }]}>{t.skills.hub.uninstall}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                disabled={installMutation.isPending && installMutation.variables === skill.identifier}
                hitSlop={10}
                onPress={() => installMutation.mutate(skill.identifier)}
              >
                <Text style={[styles.actionText, { color: tokens.primary }]}>
                  {installMutation.isPending && installMutation.variables === skill.identifier
                    ? '…'
                    : t.skills.hub.install}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {officialQuery.data?.skills.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No skills available to install.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionText: {
    ...type.label,
    fontWeight: '600'
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    ...type.label,
    fontWeight: '600'
  },
  errorText: {
    ...type.caption,
    marginBottom: 8
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  retryText: {
    ...type.label,
    fontWeight: '600'
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowText: {
    flex: 1,
    paddingRight: 12
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 6
  },
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  }
})
