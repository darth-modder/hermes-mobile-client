import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  createCronJob,
  deleteCronJob,
  listCronJobs,
  pauseCronJob,
  resumeCronJob,
  triggerCronJob
} from '../../../src/api/cron'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { $cronChangeTick } from '../../../src/store/live-sync'
import { $activeProfile } from '../../../src/store/profile'
import { createCronTriggerController } from '../../../src/upstream/shared/cron-trigger-controller'
import type { CronJob } from '../../../src/upstream/types/hermes'

const QUERY_KEY_ROOT = 'cron-jobs'

/**
 * Cron screen (M10). `/api/cron/*` (src/api/cron.ts) for CRUD; the list
 * refetches on the `cron.changed` gateway broadcast (src/store/live-sync.ts)
 * — the exit criterion's "list updates live" — rather than polling. Trigger
 * presses go through the vendored `cron-trigger-controller.ts`
 * (src/upstream/shared) so a double-tap on the same job's Trigger button
 * can't fire it twice from this one mounted screen; the durable claim on the
 * backend is still the real cross-client guard (the controller's own doc
 * comment).
 */
export default function CronScreen() {
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined
  const queryKey = [QUERY_KEY_ROOT, profile]

  const [prompt, setPrompt] = useState('')
  const [schedule, setSchedule] = useState('')
  const [name, setName] = useState('')
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [triggerMessages, setTriggerMessages] = useState<Record<string, string>>({})

  const triggerController = useRef(
    createCronTriggerController((key, running) => {
      setRunningIds(current => {
        const next = new Set(current)

        if (running) {
          next.add(key)
        } else {
          next.delete(key)
        }

        return next
      })
    })
  ).current

  const jobsQuery = useQuery({ queryFn: () => listCronJobs(profile), queryKey })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey })

  // Live update: `cron.changed` (a create/edit/pause/resume/trigger/delete —
  // this client's own or another client's) bumps the tick; refetch rather
  // than trust a stale local cache. Skip the tick's initial value so mount
  // doesn't double-fetch alongside useQuery's own initial run.
  const cronChangeTick = useStore($cronChangeTick)
  const skipInitialTick = useRef(true)

  useEffect(() => {
    if (skipInitialTick.current) {
      skipInitialTick.current = false

      return
    }

    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ROOT, profile] })
  }, [cronChangeTick, profile, queryClient])

  const createMutation = useMutation({
    mutationFn: () =>
      createCronJob({ name: name.trim() || undefined, prompt: prompt.trim(), schedule: schedule.trim() }, profile),
    onSuccess: () => {
      setPrompt('')
      setSchedule('')
      setName('')
      invalidate()
    }
  })

  const pauseMutation = useMutation({
    mutationFn: (job: CronJob) => (job.enabled ? pauseCronJob(job.id, profile) : resumeCronJob(job.id, profile)),
    onSuccess: invalidate
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCronJob(id, profile),
    onSuccess: invalidate
  })

  const onTrigger = (job: CronJob) => {
    void triggerController
      .run(job.id, () => triggerCronJob(job.id, profile))
      .then(result => {
        if (!result.started) {
          return
        }

        setTriggerMessages(current => ({ ...current, [job.id]: `Ran — ${result.value?.state ?? 'ok'}` }))
        invalidate()
      })
      .catch(err => {
        setTriggerMessages(current => ({
          ...current,
          [job.id]: err instanceof Error ? err.message : String(err)
        }))
      })
  }

  const confirmDelete = (job: CronJob) => {
    Alert.alert('Delete cron job?', job.name || job.id, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => deleteMutation.mutate(job.id), style: 'destructive', text: 'Delete' }
    ])
  }

  const jobs = jobsQuery.data ?? []

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader title="Cron" />
      <ScrollView contentContainerStyle={styles.content}>
        {jobsQuery.isLoading ? <ActivityIndicator color="#8a8a99" style={styles.spinner} /> : null}
        {jobsQuery.isError ? (
          <Text style={styles.errorText}>
            {jobsQuery.error instanceof Error ? jobsQuery.error.message : String(jobsQuery.error)}
          </Text>
        ) : null}
        {jobs.length === 0 && !jobsQuery.isLoading ? <Text style={styles.sectionHint}>No cron jobs yet.</Text> : null}

        {jobs.map(job => (
          <View key={job.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.rowTitle}>{job.name || job.id}</Text>
              <Text style={job.enabled ? styles.statusEnabled : styles.statusDisabled}>
                {job.state || (job.enabled ? 'enabled' : 'paused')}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.rowSubtitle}>
              {job.schedule_display || job.schedule?.display || job.schedule?.expr || '—'}
            </Text>
            {job.prompt ? (
              <Text numberOfLines={2} style={styles.rowPrompt}>
                {job.prompt}
              </Text>
            ) : null}
            {job.last_error ? <Text style={styles.errorText}>{job.last_error}</Text> : null}
            {triggerMessages[job.id] ? <Text style={styles.testMessage}>{triggerMessages[job.id]}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity
                disabled={runningIds.has(job.id)}
                onPress={() => onTrigger(job)}
                style={styles.actionButton}
              >
                <Text style={styles.actionText}>{runningIds.has(job.id) ? 'Running…' : 'Trigger'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => pauseMutation.mutate(job)} style={styles.actionButton}>
                <Text style={styles.actionText}>{job.enabled ? 'Pause' : 'Resume'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(job)} style={styles.actionButton}>
                <Text style={styles.destructiveText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>New job</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Name (optional)"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={name}
        />
        <TextInput
          multiline
          numberOfLines={3}
          onChangeText={setPrompt}
          placeholder="Prompt"
          placeholderTextColor="#5a5a66"
          style={[styles.input, styles.multilineInput]}
          value={prompt}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setSchedule}
          placeholder="Schedule (cron expr, e.g. 0 9 * * *)"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={schedule}
        />
        <TouchableOpacity
          disabled={createMutation.isPending || !prompt.trim() || !schedule.trim()}
          onPress={() => createMutation.mutate()}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>{createMutation.isPending ? 'Creating…' : 'Create job'}</Text>
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
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top'
  },
  rowPrompt: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 6
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
  },
  statusDisabled: {
    color: '#8a8a99',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  statusEnabled: {
    color: '#3fb950',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  testMessage: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 6
  }
})
