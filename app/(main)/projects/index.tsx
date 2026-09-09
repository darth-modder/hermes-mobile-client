import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { archiveProject, createProject, deleteProject, listProjects, setActiveProject } from '../../../src/api/projects'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { $activeProfile } from '../../../src/store/profile'
import type { ProjectInfo } from '../../../src/upstream/types/hermes'

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
    Alert.alert('Delete project?', project.name, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => deleteMutation.mutate(project.id), style: 'destructive', text: 'Delete' }
    ])
  }

  const projects = projectsQuery.data?.projects ?? []
  const activeId = projectsQuery.data?.active_id ?? null

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader title="Projects" />
      <ScrollView contentContainerStyle={styles.content}>
        {projectsQuery.isLoading ? <ActivityIndicator color="#8a8a99" style={styles.spinner} /> : null}
        {projectsQuery.isError ? (
          <Text style={styles.errorText}>
            {projectsQuery.error instanceof Error ? projectsQuery.error.message : String(projectsQuery.error)}
          </Text>
        ) : null}

        {projects.length === 0 && !projectsQuery.isLoading ? (
          <Text style={styles.sectionHint}>No projects yet — create one below.</Text>
        ) : null}

        {projects.map(project => {
          const isActive = project.id === activeId

          return (
            <View key={project.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.rowTitle}>
                  {project.name}
                  {isActive ? ' · active' : ''}
                  {project.archived ? ' · archived' : ''}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.rowSubtitle}>
                {project.primary_path || project.folders[0]?.path || 'No folder'}
                {project.folders.length > 1 ? ` (+${project.folders.length - 1} more)` : ''}
              </Text>
              <View style={styles.actions}>
                {!isActive && !project.archived ? (
                  <TouchableOpacity onPress={() => activateMutation.mutate(project.id)} style={styles.actionButton}>
                    <Text style={styles.actionText}>Set active</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => archiveMutation.mutate({ id: project.id, restore: Boolean(project.archived) })}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>{project.archived ? 'Restore' : 'Archive'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(project)} style={styles.actionButton}>
                  <Text style={styles.destructiveText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}

        <Text style={styles.sectionTitle}>New project</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Project name"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={name}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setFolder}
          placeholder="Primary folder path (on the server)"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={folder}
        />
        <TouchableOpacity
          disabled={createMutation.isPending || !name.trim() || !folder.trim()}
          onPress={() => createMutation.mutate()}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>{createMutation.isPending ? 'Creating…' : 'Create project'}</Text>
        </TouchableOpacity>
        {createMutation.isError ? (
          <Text style={styles.errorText}>
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
    color: '#1f6feb',
    fontSize: 13,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 12
  },
  addButtonText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 10,
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
    marginTop: 6
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
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
  },
  spinner: {
    marginBottom: 12
  }
})
