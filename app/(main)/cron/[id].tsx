import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deleteCronJob,
  getCronJobRuns,
  listCronJobs,
  pauseCronJob,
  resumeCronJob,
  triggerCronJob
} from '../../../src/api/cron'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

const QUERY_KEY_ROOT = 'cron-jobs'

function relativeTime(epochMs: number): string {
  const minutes = Math.floor((Date.now() - epochMs) / 60_000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

// Replicates: docs/desktop-prototypes/a-main/cron.html's PanelDetail half
// (job fields, actions, run history) — the sibling of cron/index.tsx's
// PanelList half. Job data comes from the SAME `[QUERY_KEY_ROOT, profile]`
// query the list screen already populates (react-query shares the cache
// across components on one key), not a second fetch — "from data the list
// already has," per the M14 review that asked for this split. Run history
// is a genuinely new fetch (`GET /api/cron/jobs/{id}/runs`, confirmed real
// at the gateway layer — see M14-screen-layouts.md's Deviation on cron):
// each run is `SessionInfo`-shaped (the route's own docstring: "same row
// shape as /api/sessions"), so rows reuse the session-list/archived-chats
// look and tap through to the real chat screen.
export default function CronJobDetailScreen() {
  const tokens = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined
  const queryKey = [QUERY_KEY_ROOT, profile]

  const jobsQuery = useQuery({ queryFn: () => listCronJobs(profile), queryKey })
  const job = jobsQuery.data?.find(candidate => candidate.id === id)

  const runsQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => getCronJobRuns(id, profile),
    queryKey: ['cron-job-runs', id, profile]
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey })

  const triggerMutation = useMutation({
    mutationFn: () => triggerCronJob(id, profile),
    onSuccess: invalidate
  })

  const pauseMutation = useMutation({
    mutationFn: () => (job?.enabled ? pauseCronJob(id, profile) : resumeCronJob(id, profile)),
    onSuccess: invalidate
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCronJob(id, profile),
    onSuccess: () => {
      invalidate()
      router.back()
    }
  })

  const confirmDelete = () => {
    const jobLabel = job?.name || id

    Alert.alert(t.cron.deleteTitle, `${t.cron.deleteDescPrefix}${jobLabel}${t.cron.deleteDescSuffix}`, [
      { style: 'cancel', text: t.common.cancel },
      { onPress: () => deleteMutation.mutate(), style: 'destructive', text: t.common.delete }
    ])
  }

  if (jobsQuery.isLoading && !job) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
        <ScreenHeader title={t.cron.title} />
        <View style={styles.center}>
          <ActivityIndicator color={tokens.mutedForeground} />
        </View>
      </SafeAreaView>
    )
  }

  if (!job) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
        <ScreenHeader title={t.cron.title} />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{t.cron.failedLoad}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const runs = runsQuery.data?.runs ?? []

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={job.name || job.id} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <View style={styles.cardHeader}>
            <Text
              style={[styles.statusEnabled, { color: job.enabled ? tokens.semantic.green : tokens.mutedForeground }]}
            >
              {job.state || (job.enabled ? t.cron.states.enabled : t.cron.states.paused)}
            </Text>
          </View>
          <Text style={[styles.fieldLabel, { color: tokens.textTertiary }]}>{t.cron.frequencyLabel}</Text>
          <Text style={[styles.fieldValue, { color: tokens.foreground }]}>
            {job.schedule_display || job.schedule?.display || job.schedule?.expr || '—'}
          </Text>
          {job.prompt ? (
            <>
              <Text style={[styles.fieldLabel, { color: tokens.textTertiary }]}>{t.cron.promptLabel}</Text>
              <Text style={[styles.fieldValue, { color: tokens.foreground }]}>{job.prompt}</Text>
            </>
          ) : null}
          {job.model ? (
            <>
              <Text style={[styles.fieldLabel, { color: tokens.textTertiary }]}>{t.cron.modelLabel}</Text>
              <Text style={[styles.fieldValue, { color: tokens.foreground }]}>
                {job.provider ? `${job.provider} · ${job.model}` : job.model}
              </Text>
            </>
          ) : null}
          {job.deliver ? (
            <>
              <Text style={[styles.fieldLabel, { color: tokens.textTertiary }]}>{t.cron.deliverLabel}</Text>
              <Text style={[styles.fieldValue, { color: tokens.foreground }]}>{job.deliver}</Text>
            </>
          ) : null}
          {job.last_run_at ? (
            <Text style={[styles.fieldValue, { color: tokens.mutedForeground }]}>
              {t.cron.last} {job.last_run_at}
            </Text>
          ) : null}
          {job.next_run_at ? (
            <Text style={[styles.fieldValue, { color: tokens.mutedForeground }]}>
              {t.cron.next} {job.next_run_at}
            </Text>
          ) : null}
          {job.last_error ? (
            <Text style={[styles.errorText, { color: tokens.destructive }]}>{job.last_error}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            disabled={triggerMutation.isPending}
            onPress={() => triggerMutation.mutate()}
            style={styles.actionButton}
          >
            <Text style={[styles.actionText, { color: tokens.primary }]}>
              {triggerMutation.isPending ? t.commandCenter.maintenance.running : t.cron.triggerNow}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={pauseMutation.isPending}
            onPress={() => pauseMutation.mutate()}
            style={styles.actionButton}
          >
            <Text style={[styles.actionText, { color: tokens.primary }]}>
              {job.enabled ? t.cron.pauseTitle : t.cron.resumeTitle}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDelete} style={styles.actionButton}>
            <Text style={[styles.destructiveText, { color: tokens.destructive }]}>{t.common.delete}</Text>
          </TouchableOpacity>
        </View>
        {triggerMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{t.cron.failedTrigger}</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.cron.runHistory}</Text>
        {runsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {runsQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{t.cron.failedLoad}</Text>
        ) : null}
        {!runsQuery.isLoading && runs.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{t.cron.noRuns}</Text>
        ) : null}
        {runs.map((run, index) => (
          <View key={run.id}>
            <ListRow
              onPress={() => router.push({ params: { id: run.id }, pathname: '/(main)/sessions/[id]' })}
              subtitle={relativeTime(run.last_active)}
              title={run.title || run.preview || run.id}
            />
            {index < runs.length - 1 ? <ListRowSeparator /> : null}
          </View>
        ))}
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
    marginBottom: 6,
    marginTop: 4
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24
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
    marginTop: 6
  },
  fieldLabel: {
    ...type.caption,
    marginTop: 8,
    textTransform: 'uppercase'
  },
  fieldValue: {
    ...type.bodySmall,
    marginTop: 2
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
  statusEnabled: {
    ...type.caption,
    fontWeight: '600',
    textTransform: 'uppercase'
  }
})
