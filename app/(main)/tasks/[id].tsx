// Replicates: docs/mobile-prototypes/tasks.html `data-view="detail"` — the
// job inspector as its own stack screen (M14: the desktop's PanelDetail
// becomes the detail route, never a side-by-side split).
//
// Field markers from that block honoured here:
//   :22-23  the labelled schedule grid on the task itself — SCHEDULE / NEXT /
//           LAST / DELIVER / MODEL — instead of burying the schedule in an
//           edit dialog.
//   :24-25  Pause and Trigger now live on the task, not behind an overflow;
//           on the phone they are the two full-width actions under the title.
//   :28-29  RUN HISTORY carries its count and says "No completed runs yet"
//           rather than showing an empty area.
//
// M14 adaptation rules: delete is long-press → Alert with the destructive
// button last (:18-19, :49); prompt editing happens in place rather than in a
// dialog. Actions disable while a mutation for this task is in flight
// (:42-43).
import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deleteCronJob,
  getCronJob,
  getCronJobRuns,
  pauseCronJob,
  resumeCronJob,
  triggerCronJob,
  updateCronJob
} from '../../../src/api/cron'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { Button } from '../../../src/components/ui/Button'
import { Input } from '../../../src/components/ui/Input'
import { jobState, jobStateTone, jobTitle } from '../../../src/lib/cron-job-state'
import { scheduleExpr, scheduleWords } from '../../../src/lib/cron-schedule'
import {
  TASKS_LAST_RUN_PREFIX,
  TASKS_NEXT_RUN_PREFIX,
  TASKS_NO_RUNS_YET,
  TASKS_RUN_HISTORY_LABEL,
  TASKS_STATE_RUNNING_NOW
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { formatRunTimestamp } from '../../../src/lib/task-format'
import { $cronChangeTick } from '../../../src/store/live-sync'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

import { toneColor } from './index'

export default function TaskDetailScreen() {
  const tokens = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined

  const jobKey = ['cron-job', id, profile]
  const runsKey = ['cron-job-runs', id, profile]

  const jobQuery = useQuery({ enabled: Boolean(id), queryFn: () => getCronJob(id, profile), queryKey: jobKey })

  const runsQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => getCronJobRuns(id, profile, 10),
    queryKey: runsKey
  })

  const [promptDraft, setPromptDraft] = useState<null | string>(null)

  // `cron.changed` covers this client's own mutations and another client's.
  const cronChangeTick = useStore($cronChangeTick)

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: jobKey })
    void queryClient.invalidateQueries({ queryKey: runsKey })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cronChangeTick])

  const job = jobQuery.data

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: jobKey })
    void queryClient.invalidateQueries({ queryKey: runsKey })
  }

  const toggleMutation = useMutation({
    mutationFn: () => (job?.enabled === false ? resumeCronJob(id, profile) : pauseCronJob(id, profile)),
    onSuccess: refresh
  })

  const triggerMutation = useMutation({
    mutationFn: () => triggerCronJob(id, profile),
    onSuccess: refresh
  })

  const promptMutation = useMutation({
    mutationFn: (next: string) => updateCronJob(id, { prompt: next }, profile),
    onSuccess: () => {
      setPromptDraft(null)
      refresh()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCronJob(id, profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cron-jobs', profile] })
      router.back()
    }
  })

  // Destructive, so it is behind a confirm with the destructive button last
  // (M14 adaptation table; matches the app's other delete confirms). The body
  // is assembled from the vendored pair rather than a new string.
  const confirmDelete = () => {
    Alert.alert(t.cron.deleteTitle, `${t.cron.deleteDescPrefix}${job ? jobTitle(job) : id}${t.cron.deleteDescSuffix}`, [
      { style: 'cancel', text: t.common.cancel },
      { onPress: () => deleteMutation.mutate(), style: 'destructive', text: t.common.delete }
    ])
  }

  const busy = toggleMutation.isPending || triggerMutation.isPending || deleteMutation.isPending

  if (jobQuery.isLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
        <ScreenHeader onBack={() => router.back()} title={t.cron.title} />
        <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} />
      </SafeAreaView>
    )
  }

  if (jobQuery.isError || !job) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
        <ScreenHeader onBack={() => router.back()} title={t.cron.title} />
        <View style={styles.errorBlock}>
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {jobQuery.error instanceof Error ? jobQuery.error.message : String(jobQuery.error ?? '')}
          </Text>
          <Button onPress={() => void jobQuery.refetch()} variant="secondary">
            {t.common.retry}
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  const state = jobState(job)
  const words = scheduleWords(job)
  const expr = scheduleExpr(job)
  const runs = runsQuery.data?.runs ?? []
  const paused = job.enabled === false

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader onBack={() => router.back()} title={jobTitle(job)} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stateLine}>
          <View style={[styles.dot, { backgroundColor: toneColor(jobStateTone(job), tokens) }]} />
          <Text style={[styles.stateText, { color: tokens.textSecondary }]}>
            {state === 'running' ? TASKS_STATE_RUNNING_NOW : state}
          </Text>
        </View>

        {/* Field (tasks.html:24-25): the two actions on the task itself. */}
        <View style={styles.actions}>
          <Button
            block
            disabled={busy}
            loading={toggleMutation.isPending}
            onPress={() => toggleMutation.mutate()}
            style={styles.actionButton}
            variant="secondary"
          >
            {paused ? t.cron.resumeTitle : t.cron.pauseTitle}
          </Button>
          <Button
            block
            disabled={busy}
            loading={triggerMutation.isPending}
            onPress={() => triggerMutation.mutate()}
            style={styles.actionButton}
            variant="primary"
          >
            {t.cron.triggerNow}
          </Button>
        </View>

        {triggerMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{t.cron.failedTrigger}</Text>
        ) : null}

        {/* Field (tasks.html:22-23): the labelled schedule grid. */}
        <View style={styles.grid}>
          <GridRow
            label={t.cron.scheduleLabels.custom}
            tokens={tokens}
            value={words && words !== expr ? `${words} · ${expr}` : expr}
          />
          <GridRow label={TASKS_NEXT_RUN_PREFIX} tokens={tokens} value={formatRunTimestamp(job.next_run_at)} />
          <GridRow label={TASKS_LAST_RUN_PREFIX} tokens={tokens} value={formatRunTimestamp(job.last_run_at)} />
          <GridRow label={t.cron.deliverLabel} tokens={tokens} value={job.deliver || t.cron.deliveryLabels.local} />
          <GridRow label={t.cron.modelLabel} tokens={tokens} value={job.model || t.cron.modelDefault} />
        </View>

        {job.last_error ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{job.last_error}</Text>
        ) : null}

        {/* Prompt, edited in place rather than in a dialog. */}
        <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{t.cron.promptLabel}</Text>
        <Input
          multiline
          numberOfLines={4}
          onChangeText={setPromptDraft}
          style={styles.promptInput}
          value={promptDraft ?? job.prompt ?? ''}
        />
        {promptDraft !== null && promptDraft !== (job.prompt ?? '') ? (
          <View style={styles.actions}>
            <Button block onPress={() => setPromptDraft(null)} style={styles.actionButton} variant="secondary">
              {t.common.cancel}
            </Button>
            <Button
              block
              loading={promptMutation.isPending}
              onPress={() => promptMutation.mutate(promptDraft)}
              style={styles.actionButton}
              variant="primary"
            >
              {t.common.save}
            </Button>
          </View>
        ) : null}

        <View style={styles.sectionLabelRow}>
          <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{TASKS_RUN_HISTORY_LABEL}</Text>
          <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{runs.length}</Text>
        </View>

        {runs.length === 0 ? (
          <Text style={[styles.hint, { color: tokens.textTertiary }]}>{TASKS_NO_RUNS_YET}</Text>
        ) : (
          runs.map(run => (
            <Pressable
              accessibilityLabel={run.id}
              accessibilityRole="button"
              key={run.id}
              onPress={() => router.push({ params: { id: run.id }, pathname: '/(main)/sessions/[id]' })}
              style={({ pressed }) => [
                styles.runRow,
                { borderBottomColor: tokens.border },
                pressed ? { backgroundColor: tokens.rowActive } : null
              ]}
            >
              <Text numberOfLines={1} style={[styles.runTitle, { color: tokens.foreground }]}>
                {run.title || run.id}
              </Text>
              <Text style={[styles.runSub, { color: tokens.textTertiary }]}>{formatRunTimestamp(run.started_at)}</Text>
            </Pressable>
          ))
        )}

        <Button
          block
          disabled={busy}
          loading={deleteMutation.isPending}
          onPress={confirmDelete}
          style={styles.deleteButton}
          variant="danger"
        >
          {t.common.delete}
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}

function GridRow({ label, tokens, value }: { label: string; tokens: ReturnType<typeof useTheme>; value: string }) {
  return (
    <View style={styles.gridRow}>
      <Text style={[styles.gridLabel, { color: tokens.textTertiary }]}>{label}</Text>
      <Text style={[styles.gridValue, { color: tokens.foreground }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // See NewTaskSheet.tsx's `footerButton`: `block` is `width: '100%'`, so two
  // of them in a row overflow unless each also takes a share of it.
  actionButton: {
    flex: 1
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 16
  },
  deleteButton: {
    marginTop: 24
  },
  dot: {
    borderRadius: radius.full,
    height: 8,
    width: 8
  },
  errorBlock: {
    gap: 8,
    padding: 16
  },
  errorText: {
    ...type.caption,
    marginTop: 8
  },
  grid: {
    gap: 6,
    marginTop: 16
  },
  gridLabel: {
    ...type.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    width: 88
  },
  gridRow: {
    flexDirection: 'row',
    gap: 14
  },
  gridValue: {
    ...type.bodySmall,
    flex: 1
  },
  hint: {
    ...type.caption,
    paddingVertical: 8
  },
  promptInput: {
    minHeight: 96,
    textAlignVertical: 'top'
  },
  runRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: 8
  },
  runSub: {
    ...type.caption
  },
  runTitle: {
    ...type.bodySmall
  },
  sectionLabel: {
    ...type.caption,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24
  },
  spinner: {
    paddingVertical: 32
  },
  stateLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12
  },
  stateText: {
    ...type.bodySmall
  }
})
