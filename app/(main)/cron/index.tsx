import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  createCronJob,
  type CronBlueprintField,
  instantiateCronBlueprint,
  listCronBlueprints,
  listCronJobs
} from '../../../src/api/cron'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { Button } from '../../../src/components/ui/Button'
import { Input } from '../../../src/components/ui/Input'
import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import { Menu } from '../../../src/components/ui/Menu'
import { Sheet } from '../../../src/components/ui/Sheet'
import { t } from '../../../src/lib/t'
import { $cronChangeTick } from '../../../src/store/live-sync'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { CronJob } from '../../../src/upstream/types/hermes'

const QUERY_KEY_ROOT = 'cron-jobs'

// Replicates: docs/desktop-prototypes/a-main/cron.html (PanelList + PanelDetail
// anatomy) — this screen is now the list half; `cron/[id].tsx` (M14) is the
// detail half, and this file's own manual create form plus the Blueprints
// sheet below cover the mapping's third element, "templates as a sheet"
// (t.cron.blueprints, t.cron.tabs — the desktop shows Jobs/Blueprints as
// tabs on one screen; M14's own adaptation table calls for a sheet instead,
// so the tab vocabulary is reused for the sheet's own copy, not for a
// literal tab strip). Cron's own Deviation (M14-screen-layouts.md) records
// why this was one scrolling list before this commit and what changed.
/**
 * Cron list screen (M10, M14 list/detail split). `/api/cron/*`
 * (src/api/cron.ts) for CRUD; the list refetches on the `cron.changed`
 * gateway broadcast (src/store/live-sync.ts) — the exit criterion's "list
 * updates live" — rather than polling. Row actions (trigger/pause/delete)
 * moved to the detail screen; this list is tap-through plus create.
 */
export default function CronScreen() {
  const tokens = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeProfile = useStore($activeProfile)
  const profile = activeProfile || undefined
  const queryKey = [QUERY_KEY_ROOT, profile]

  const [prompt, setPrompt] = useState('')
  const [schedule, setSchedule] = useState('')
  const [name, setName] = useState('')

  const [blueprintsOpen, setBlueprintsOpen] = useState(false)
  const [selectedBlueprintKey, setSelectedBlueprintKey] = useState<null | string>(null)
  const [blueprintValues, setBlueprintValues] = useState<Record<string, string>>({})
  const [openEnumField, setOpenEnumField] = useState<null | string>(null)

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

  const blueprintsQuery = useQuery({
    enabled: blueprintsOpen,
    queryFn: () => listCronBlueprints(),
    queryKey: ['cron-blueprints']
  })

  const instantiateMutation = useMutation({
    mutationFn: (blueprintKey: string) => instantiateCronBlueprint(blueprintKey, blueprintValues, profile),
    onSuccess: () => {
      setBlueprintsOpen(false)
      setSelectedBlueprintKey(null)
      setBlueprintValues({})
      invalidate()
    }
  })

  const blueprints = blueprintsQuery.data?.blueprints ?? []
  const selectedBlueprint = blueprints.find(b => b.key === selectedBlueprintKey) ?? null

  const openBlueprint = (key: string, fields: CronBlueprintField[]) => {
    setSelectedBlueprintKey(key)
    setBlueprintValues(Object.fromEntries(fields.map(field => [field.name, field.default ?? ''])))
  }

  const closeBlueprints = () => {
    setBlueprintsOpen(false)
    setSelectedBlueprintKey(null)
    setBlueprintValues({})
  }

  const jobs = jobsQuery.data ?? []

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={t.cron.title} />
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
        {jobsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {jobsQuery.isError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {jobsQuery.error instanceof Error ? jobsQuery.error.message : String(jobsQuery.error)}
            </Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => void jobsQuery.refetch()}
              style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {jobs.length === 0 && !jobsQuery.isLoading && !jobsQuery.isError ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{t.cron.emptyTitleNew}</Text>
        ) : null}

        {jobs.map((job: CronJob, index) => (
          <View key={job.id}>
            <ListRow
              onPress={() => router.push({ params: { id: job.id }, pathname: '/(main)/cron/[id]' })}
              subtitle={job.schedule_display || job.schedule?.display || job.schedule?.expr || '—'}
              title={job.name || job.id}
              value={job.state || (job.enabled ? t.cron.states.enabled : t.cron.states.paused)}
            />
            {index < jobs.length - 1 ? <ListRowSeparator /> : null}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.cron.blueprints.startFrom}</Text>
        <TouchableOpacity
          onPress={() => setBlueprintsOpen(true)}
          style={[styles.addButton, styles.secondaryButton, { borderColor: tokens.border }]}
        >
          <Text style={[styles.addButtonText, { color: tokens.foreground }]}>{t.cron.blueprints.subtitle}</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.cron.newCron}</Text>
        <TextInput
          onChangeText={setName}
          placeholder={t.cron.namePlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={name}
        />
        <TextInput
          multiline
          numberOfLines={3}
          onChangeText={setPrompt}
          placeholder={t.cron.promptPlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            styles.multilineInput,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={prompt}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setSchedule}
          placeholder={t.cron.customPlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={schedule}
        />
        <TouchableOpacity
          disabled={createMutation.isPending || !prompt.trim() || !schedule.trim()}
          onPress={() => createMutation.mutate()}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.addButtonText, { color: tokens.primaryForeground }]}>
            {createMutation.isPending ? t.webhooks.creating : t.cron.createAction}
          </Text>
        </TouchableOpacity>
        {createMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {createMutation.error instanceof Error ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
      </ScrollView>

      <Sheet
        onClose={closeBlueprints}
        title={selectedBlueprint ? selectedBlueprint.title : t.cron.blueprints.tab}
        visible={blueprintsOpen && !selectedBlueprint}
      >
        {blueprintsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {blueprintsQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{t.cron.blueprints.failedLoad}</Text>
        ) : null}
        {!blueprintsQuery.isLoading && blueprints.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{t.cron.blueprints.emptyDesc}</Text>
        ) : null}
        {blueprints.map((blueprint, index) => (
          <View key={blueprint.key}>
            <ListRow
              onPress={() => openBlueprint(blueprint.key, blueprint.fields)}
              subtitle={blueprint.scheduleHuman}
              title={blueprint.title}
            />
            {index < blueprints.length - 1 ? <ListRowSeparator /> : null}
          </View>
        ))}
      </Sheet>

      <Sheet
        footer={
          selectedBlueprint ? (
            <>
              <Button block onPress={() => setSelectedBlueprintKey(null)} variant="secondary">
                {t.common.cancel}
              </Button>
              <Button
                block
                disabled={instantiateMutation.isPending}
                loading={instantiateMutation.isPending}
                onPress={() => instantiateMutation.mutate(selectedBlueprint.key)}
              >
                {t.cron.blueprints.scheduleIt}
              </Button>
            </>
          ) : null
        }
        onClose={() => setSelectedBlueprintKey(null)}
        title={selectedBlueprint?.title}
        visible={selectedBlueprint !== null}
      >
        {selectedBlueprint ? (
          <>
            <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{t.cron.blueprints.dialogDesc}</Text>
            {/* CronBlueprintField.type is 'text' | 'enum' | 'time' | 'weekdays' in the
                catalog (checked cron/blueprint_catalog.py directly). Only 'enum' gets a
                picker (Menu, from field.options); 'time'/'weekdays' fall through to a
                plain text Input rather than a dedicated time-picker/weekday-toggle — a
                deliberate scope call for this pass, not an oversight: both are rare next
                to 'text'/'enum' across the catalog and a free-text value still reaches
                the same server-side validation (BlueprintFillError surfaces inline). */}
            {selectedBlueprint.fields.map(field =>
              field.type === 'enum' ? (
                <TouchableOpacity
                  key={field.name}
                  onPress={() => setOpenEnumField(field.name)}
                  style={styles.enumField}
                >
                  <Input
                    editable={false}
                    label={field.label}
                    pointerEvents="none"
                    value={blueprintValues[field.name] ?? ''}
                  />
                </TouchableOpacity>
              ) : (
                <Input
                  key={field.name}
                  label={field.label}
                  onChangeText={value => setBlueprintValues(current => ({ ...current, [field.name]: value }))}
                  value={blueprintValues[field.name] ?? ''}
                />
              )
            )}
            {selectedBlueprint.fields
              .filter(field => field.type === 'enum')
              .map(field => (
                <Menu
                  items={(field.options ?? []).map(option => ({
                    active: blueprintValues[field.name] === option,
                    key: option,
                    label: option,
                    onPress: () => setBlueprintValues(current => ({ ...current, [field.name]: option }))
                  }))}
                  key={field.name}
                  onClose={() => setOpenEnumField(null)}
                  title={field.label}
                  visible={openEnumField === field.name}
                />
              ))}
            {instantiateMutation.isError ? (
              <Text style={[styles.errorText, { color: tokens.destructive }]}>
                {instantiateMutation.error instanceof Error
                  ? instantiateMutation.error.message
                  : String(instantiateMutation.error)}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    marginTop: 4,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 12
  },
  addButtonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  enumField: {
    marginBottom: 0
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
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top'
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
  secondaryButton: {
    borderWidth: 1
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
