import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

import { archiveProject, createProject, deleteProject, listProjects, setActiveProject } from '../../../src/api/projects'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import {
  PROJECTS_DELETE_CONFIRM_TITLE,
  PROJECTS_EMPTY,
  PROJECTS_FOLDER_PLACEHOLDER,
  projectsMoreFoldersSuffix
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { ProjectInfo } from '../../../src/upstream/types/hermes'

// Replicates: docs/desktop-prototypes/b-panels/sessions-sidebar.html's
// `#sb=projects` / `#sb=project` views (OverviewRow, WorkspaceGroup/Header,
// EnteredContent) — the desktop has no standalone Projects page at all
// (Deviation 3, project-planning/implementation-plan/M14-screen-layouts.md):
// it keeps project management inside the sessions sidebar's own tree, so
// this screen is the mobile-only page that surfaces the same `projects.*`
// concept. Labels below come from the vendored `t.sidebar.projects` block
// (D15.4); "Current"/"Archive"/"Restore" have no home there and are cross-
// reused by value from t.settings.connections.currentPill,
// t.sidebar.row.archive and t.zones.restore. The folder-path placeholder
// and the delete-confirm title stay mobile-only strings (strings.mobile.ts)
// — see its header comment for why no vendored form fits either.
/**
 * Projects screen (M10). `projects.*` RPCs only — never the local
 * filesystem (the task line's own wording): a project's folder is a path on
 * the *server*, typed in, not picked from an on-device browser. Folder
 * management beyond "one primary folder at create time" (add/remove/promote
 * additional folders, worktrees, repo auto-discovery) is cut — no exit
 * criterion needs it and it's all machine-bound surface per AGENTS.md; see
 * `src/api/projects.ts`'s header for the exact upstream RPCs left unported.
 */
export default function ProjectsScreen() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined

  const [name, setName] = useState('')
  const [folder, setFolder] = useState('')

  const projectsQuery = useQuery({
    queryFn: () => listProjects(profile),
    queryKey: ['projects', profile]
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['projects', profile] })

  const createMutation = useMutation({
    mutationFn: () =>
      createProject(
        { folders: folder.trim() ? [folder.trim()] : [], name: name.trim(), primaryPath: folder.trim(), use: true },
        profile
      ),
    onSuccess: () => {
      setName('')
      setFolder('')
      invalidate()
    }
  })

  const activateMutation = useMutation({
    mutationFn: (id: null | string) => setActiveProject(id, profile),
    onSuccess: invalidate
  })

  const archiveMutation = useMutation({
    mutationFn: (args: { id: string; restore: boolean }) => archiveProject(args.id, args.restore, profile),
    onSuccess: invalidate
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id, profile),
    onSuccess: invalidate
  })

  const confirmDelete = (project: ProjectInfo) => {
    Alert.alert(PROJECTS_DELETE_CONFIRM_TITLE, `${project.name} — ${t.sidebar.projects.deleteConfirm}`, [
      { style: 'cancel', text: t.common.cancel },
      { onPress: () => deleteMutation.mutate(project.id), style: 'destructive', text: t.sidebar.projects.menuDelete }
    ])
  }

  const projects = projectsQuery.data?.projects ?? []
  const activeId = projectsQuery.data?.active_id ?? null

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={t.commandCenter.projects} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void projectsQuery.refetch()}
            refreshing={projectsQuery.isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        {projectsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {projectsQuery.isError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {projectsQuery.error instanceof Error ? projectsQuery.error.message : String(projectsQuery.error)}
            </Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => void projectsQuery.refetch()}
              style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {projects.length === 0 && !projectsQuery.isLoading && !projectsQuery.isError ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{PROJECTS_EMPTY}</Text>
        ) : null}

        {projects.map(project => {
          const isActive = project.id === activeId

          return (
            <View key={project.id} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.rowTitle, { color: tokens.foreground }]}>
                  {project.name}
                  {isActive ? ` · ${t.settings.connections.currentPill}` : ''}
                  {project.archived ? ` · ${t.desktop.archived}` : ''}
                </Text>
              </View>
              <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {project.primary_path || project.folders[0]?.path || t.sidebar.projects.noFolders}
                {project.folders.length > 1 ? projectsMoreFoldersSuffix(project.folders.length - 1) : ''}
              </Text>
              <View style={styles.actions}>
                {!isActive && !project.archived ? (
                  <TouchableOpacity
                    hitSlop={8}
                    onPress={() => activateMutation.mutate(project.id)}
                    style={styles.actionButton}
                  >
                    <Text style={[styles.actionText, { color: tokens.primary }]}>
                      {t.sidebar.projects.menuSetActive}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => archiveMutation.mutate({ id: project.id, restore: Boolean(project.archived) })}
                  style={styles.actionButton}
                >
                  <Text style={[styles.actionText, { color: tokens.primary }]}>
                    {project.archived ? t.zones.restore : t.sidebar.row.archive}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity hitSlop={8} onPress={() => confirmDelete(project)} style={styles.actionButton}>
                  <Text style={[styles.destructiveText, { color: tokens.destructive }]}>
                    {t.sidebar.projects.menuDelete}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.sidebar.projects.newButton}</Text>
        <TextInput
          onChangeText={setName}
          placeholder={t.sidebar.projects.namePlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[styles.input, { backgroundColor: tokens.card, borderColor: tokens.border, color: tokens.foreground }]}
          value={name}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setFolder}
          placeholder={PROJECTS_FOLDER_PLACEHOLDER}
          placeholderTextColor={tokens.mutedForeground}
          style={[styles.input, { backgroundColor: tokens.card, borderColor: tokens.border, color: tokens.foreground }]}
          value={folder}
        />
        <TouchableOpacity
          disabled={createMutation.isPending || !name.trim() || !folder.trim()}
          onPress={() => createMutation.mutate()}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.addButtonText, { color: tokens.primaryForeground }]}>
            {createMutation.isPending ? t.profiles.creating : t.sidebar.projects.create}
          </Text>
        </TouchableOpacity>
        {createMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {createMutation.error instanceof Error ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    marginRight: 16
  },
  actionText: {
    ...type.label,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  addButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    marginTop: 4,
    paddingVertical: 12
  },
  addButtonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
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
  errorBlock: {
    marginBottom: 6
  },
  errorText: {
    ...type.caption,
    marginTop: 6
  },
  input: {
    ...type.mono,
    borderRadius: radius.control,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.control,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  retryText: {
    ...type.label,
    fontWeight: '600'
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
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
  },
  spinner: {
    marginBottom: 12
  }
})
