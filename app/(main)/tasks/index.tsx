// Replicates: docs/mobile-prototypes/tasks.html `data-view="list"` and
// `data-view="empty"` — the Tasks tab, third of the three root tabs. Its own
// comment block names the desktop sources it adapts
// (docs/desktop-prototypes/c-plugins/routines.html's Routines pane and
// docs/desktop-prototypes/a-main/cron.html's /cron overlay) and the M14
// adaptation rules that turn the 250 px pane and the 1220×800 overlay into
// one full-width list screen plus a detail route.
//
// Field markers honoured from that block, all four of them:
//   :26-27  the "Running now" / "Scheduled" counters above the list, so the
//           tab answers "is anything happening right now?" before a single
//           row is read.
//   :22-23  the labelled schedule grid — on the detail route, not here.
//   :24-25  Pause / Trigger now on the task itself — likewise the detail.
//   :30-32  the plain-language echo in the New task sheet — NewTaskSheet.tsx.
//
// Measurements from :34-39: counter cards 12 pad / 8 gap, task row 72
// min-height with 12×16 padding, 40 dp lead tile + 12 gap, state chip 20 high
// (2×8 pad). Touch targets 48 dp.
//
// Deviation (recorded in the M15 doc): the prototype draws a tab row
// (Bots · Sessions · Tasks) under the header. That row belongs to M15 E
// (Gestures — "Swiping between the three tabs works", :50) and does not exist
// as a shared component yet, so this screen is reached from the drawer like
// every other list screen. No tab strip is drawn here rather than a dead one.
import { useStore } from '@nanostores/react'
import { IconPlus as Plus } from '@tabler/icons-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { listCronJobs } from '../../../src/api/cron'
import { NewTaskSheet } from '../../../src/components/NewTaskSheet'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { Button } from '../../../src/components/ui/Button'
import { isRunningNow, jobState, jobStateTone, jobTitle } from '../../../src/lib/cron-job-state'
import { scheduleExpr, scheduleWords } from '../../../src/lib/cron-schedule'
import {
  TASKS_LAST_RUN_PREFIX,
  TASKS_NEW_TASK_ACTION,
  TASKS_NEXT_RUN_PREFIX,
  TASKS_RUNNING_NOW_LABEL,
  TASKS_SCHEDULED_LABEL,
  TASKS_SECTION_LABEL,
  TASKS_STATE_RUNNING_NOW
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { formatRunTimestamp } from '../../../src/lib/task-format'
import { $cronChangeTick } from '../../../src/store/live-sync'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import type { MobileTokens } from '../../../src/theme/resolve'
import { radius, type } from '../../../src/theme/type'
import type { CronJob } from '../../../src/upstream/types/hermes'

const QUERY_KEY_ROOT = 'cron-jobs'

/** See `jobsQuery` — the polling floor under the `cron.changed` broadcast. */
const LIST_POLL_MS = 10000

export function toneColor(tone: ReturnType<typeof jobStateTone>, tokens: MobileTokens): string {
  if (tone === 'danger') {
    return tokens.destructive
  }

  if (tone === 'warn') {
    return tokens.semantic.orange
  }

  if (tone === 'busy') {
    return tokens.primary
  }

  if (tone === 'good') {
    return tokens.semantic.green
  }

  return tokens.textQuaternary
}

export default function TasksScreen() {
  const tokens = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined
  const queryKey = [QUERY_KEY_ROOT, profile]

  const [newTaskOpen, setNewTaskOpen] = useState(false)

  // "The list polls" (docs/mobile-prototypes/tasks.html:40). The `cron.changed`
  // tick below is still the fast path; this is the floor under it, and it is
  // what makes a run started elsewhere — or by this app's own Trigger now, one
  // screen over — show up without a manual pull-to-refresh.
  const jobsQuery = useQuery({ queryFn: () => listCronJobs(profile), queryKey, refetchInterval: LIST_POLL_MS })

  // Same live-update seam the cron screen used: `cron.changed` bumps the
  // tick (src/store/live-sync.ts) and we refetch rather than poll. The
  // initial value is skipped so mount doesn't double-fetch alongside
  // useQuery's own first run.
  const cronChangeTick = useStore($cronChangeTick)
  const skipInitialTick = useRef(true)

  useEffect(() => {
    if (skipInitialTick.current) {
      skipInitialTick.current = false

      return
    }

    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ROOT, profile] })
  }, [cronChangeTick, profile, queryClient])

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
  const runningCount = useMemo(() => jobs.filter(isRunningNow).length, [jobs])
  const scheduledCount = jobs.length - runningCount

  // The prototype's "a failed refresh keeps the last list and says so instead
  // of emptying" (tasks.html:40-41). react-query already keeps `data` across
  // a failed refetch, so the error banner renders *above* the rows rather
  // than replacing them; only a first load with no data at all is a bare
  // error state.
  const hasRows = jobs.length > 0
  const isFirstLoad = jobsQuery.isLoading && !hasRows

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader
        actions={[
          {
            accessibilityLabel: TASKS_NEW_TASK_ACTION,
            icon: <Plus color={tokens.foreground} size={20} />,
            onPress: () => setNewTaskOpen(true)
          }
        ]}
        title={t.cron.title}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void jobsQuery.refetch()}
            refreshing={jobsQuery.isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        {isFirstLoad ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}

        {jobsQuery.isError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {jobsQuery.error instanceof Error ? jobsQuery.error.message : String(jobsQuery.error)}
            </Text>
            <Button onPress={() => void jobsQuery.refetch()} variant="secondary">
              {t.common.retry}
            </Button>
          </View>
        ) : null}

        {hasRows ? (
          <>
            {/* Field (tasks.html:26-27): the two counters, before any row. */}
            <View style={styles.counterRow}>
              <CounterTile
                color={tokens.primary}
                label={TASKS_RUNNING_NOW_LABEL}
                tokens={tokens}
                value={runningCount}
              />
              <CounterTile
                color={tokens.semantic.green}
                label={TASKS_SCHEDULED_LABEL}
                tokens={tokens}
                value={scheduledCount}
              />
            </View>

            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{TASKS_SECTION_LABEL}</Text>
              <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{jobs.length}</Text>
            </View>

            {jobs.map(job => (
              <TaskRow
                job={job}
                key={job.id}
                onPress={() => router.push({ params: { id: job.id }, pathname: '/(main)/tasks/[id]' })}
                tokens={tokens}
              />
            ))}
          </>
        ) : null}

        {!hasRows && !isFirstLoad && !jobsQuery.isError ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: tokens.foreground }]}>{t.cron.emptyTitleNew}</Text>
            <Text style={[styles.emptyDesc, { color: tokens.textTertiary }]}>{t.cron.emptyDescNew}</Text>
            <Button onPress={() => setNewTaskOpen(true)} variant="primary">
              {TASKS_NEW_TASK_ACTION}
            </Button>
          </View>
        ) : null}
      </ScrollView>

      <NewTaskSheet
        onClose={() => setNewTaskOpen(false)}
        onCreated={() => {
          setNewTaskOpen(false)
          void queryClient.invalidateQueries({ queryKey })
        }}
        profile={profile}
        visible={newTaskOpen}
      />
    </SafeAreaView>
  )
}

function CounterTile({
  color,
  label,
  tokens,
  value
}: {
  color: string
  label: string
  tokens: MobileTokens
  value: number
}) {
  return (
    <View style={[styles.counterTile, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
      <Text style={[styles.counterLabel, { color: tokens.textTertiary }]}>{label}</Text>
      <View style={styles.counterValueRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.counterValue, { color: tokens.foreground }]}>{value}</Text>
      </View>
    </View>
  )
}

function TaskRow({ job, onPress, tokens }: { job: CronJob; onPress: () => void; tokens: MobileTokens }) {
  const state = jobState(job)
  const tone = jobStateTone(job)
  const dotColor = toneColor(tone, tokens)
  const words = scheduleWords(job)
  const expr = scheduleExpr(job)
  // Words and the raw expression, separated the way the prototype draws them
  // (tasks.html:130, "Every day at 9:00 AM · 0 9 * * *"). When the humanizer
  // can't describe the expression it returns null and only the raw string is
  // shown — never a wrong sentence.
  const scheduleLine = words && words !== expr ? `${words} · ${expr}` : expr

  return (
    <Pressable
      accessibilityLabel={jobTitle(job)}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: tokens.border },
        pressed ? { backgroundColor: tokens.rowActive } : null
      ]}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.foreground }]}>
            {jobTitle(job)}
          </Text>
          <View style={[styles.chip, { backgroundColor: tokens.bgTertiary }]}>
            <View style={[styles.dotSmall, { backgroundColor: dotColor }]} />
            <Text style={[styles.chipText, { color: tokens.textSecondary }]}>
              {state === 'running' ? TASKS_STATE_RUNNING_NOW : state}
            </Text>
          </View>
        </View>

        <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.textSecondary }]}>
          {scheduleLine}
        </Text>

        <Text numberOfLines={1} style={[styles.rowMeta, { color: tokens.textTertiary }]}>
          {`${TASKS_NEXT_RUN_PREFIX} ${formatRunTimestamp(job.next_run_at)} · ${TASKS_LAST_RUN_PREFIX} ${formatRunTimestamp(job.last_run_at)}`}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  chipText: {
    ...type.caption
  },
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 24
  },
  counterLabel: {
    ...type.caption,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  counterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  counterTile: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 4,
    padding: 12
  },
  counterValue: {
    ...type.title,
    fontWeight: '600'
  },
  counterValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  dot: {
    borderRadius: radius.full,
    height: 8,
    width: 8
  },
  dotSmall: {
    borderRadius: radius.full,
    height: 6,
    width: 6
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 64
  },
  emptyDesc: {
    ...type.bodySmall,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyTitle: {
    ...type.body,
    fontWeight: '600'
  },
  errorBlock: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  errorText: {
    ...type.caption
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  rowBody: {
    flex: 1,
    gap: 2,
    justifyContent: 'center'
  },
  rowMeta: {
    ...type.caption
  },
  rowSub: {
    ...type.bodySmall
  },
  rowTitle: {
    ...type.body,
    flex: 1,
    fontWeight: '600'
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  sectionLabel: {
    ...type.caption,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  spinner: {
    paddingVertical: 32
  }
})
