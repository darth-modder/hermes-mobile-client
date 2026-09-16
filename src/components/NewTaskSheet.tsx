import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  createCronJob,
  type CronBlueprint,
  getCronDeliveryTargets,
  instantiateCronBlueprint,
  listCronBlueprints
} from '../api/cron'
import { describeCronExpr, SCHEDULE_PRESETS, scheduleKindForExpr } from '../lib/cron-schedule'
import {
  TASKS_ADVANCED_SCHEDULE_LABEL,
  TASKS_FREQUENCY_LABEL,
  TASKS_NAME_LABEL,
  TASKS_NAME_PLACEHOLDER,
  TASKS_NEW_TASK_TITLE,
  TASKS_TEMPLATE_NONE,
  TASKS_WHEN_TO_RUN_LABEL
} from '../lib/strings.mobile'
import { t } from '../lib/t'
import { useTheme } from '../theme/provider'
import { radius, type as typeTokens } from '../theme/type'

import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { ListRow } from './ui/ListRow'
import { Menu } from './ui/Menu'
import { Sheet } from './ui/Sheet'

/**
 * Replicates: docs/mobile-prototypes/tasks.html `data-view="new"` — the New
 * task sheet. The desktop's create dialog
 * (docs/desktop-prototypes/a-main/cron.html) becomes a bottom sheet with the
 * desktop's fields in the desktop's order, per the M14 adaptation table, and
 * its "Start from" Select plus the Routines pane's Blueprints list collapse
 * into one horizontally scrolling chip row (tasks.html:16-19) so the schedule
 * picker below stays on screen.
 *
 * Two creation paths, because the server has two:
 *  - a picked template posts to `POST /api/cron/blueprints/instantiate`
 *    (`instantiateCronBlueprint`), which fills the blueprint's own fields
 *    host-side. The sheet renders those fields from the catalog rather than
 *    guessing them.
 *  - `Custom` posts to `POST /api/cron/jobs` (`createCronJob`) with name,
 *    prompt, schedule and deliver.
 *
 * `Field (ours)` (tasks.html:30-32): the plain-language echo beside the raw
 * schedule string. For a preset it comes from the humanizer; for a picked
 * template the host already supplies one as `CronBlueprint.scheduleHuman`,
 * which is preferred over re-deriving it. For a *typed* expression the echo
 * is `describeCronExpr`, and when that returns null — anything it cannot
 * describe — the sheet shows the raw expression alone rather than a wrong
 * sentence.
 */
export interface NewTaskSheetProps {
  onClose: () => void
  onCreated: () => void
  profile?: string
  visible: boolean
}

export function NewTaskSheet({ onClose, onCreated, profile, visible }: NewTaskSheetProps) {
  const tokens = useTheme()

  const [blueprintKey, setBlueprintKey] = useState<null | string>(null)
  const [blueprintValues, setBlueprintValues] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [schedule, setSchedule] = useState('0 9 * * *')
  const [deliver, setDeliver] = useState('local')
  const [openPicker, setOpenPicker] = useState<null | string>(null)
  const [error, setError] = useState<null | string>(null)

  const blueprintsQuery = useQuery({ enabled: visible, queryFn: listCronBlueprints, queryKey: ['cron-blueprints'] })

  const targetsQuery = useQuery({
    enabled: visible,
    queryFn: () => getCronDeliveryTargets(profile),
    queryKey: ['cron-delivery-targets', profile]
  })

  const blueprints = blueprintsQuery.data?.blueprints ?? []
  const targets = targetsQuery.data?.targets ?? []
  const blueprint = blueprints.find(b => b.key === blueprintKey) ?? null

  const reset = () => {
    setBlueprintKey(null)
    setBlueprintValues({})
    setName('')
    setPrompt('')
    setSchedule('0 9 * * *')
    setDeliver('local')
    setError(null)
  }

  const pickBlueprint = (next: CronBlueprint | null) => {
    setError(null)
    setBlueprintKey(next?.key ?? null)
    setBlueprintValues(next ? Object.fromEntries(next.fields.map(field => [field.name, field.default ?? ''])) : {})

    // "picking a template fills name, prompt and schedule" (tasks.html:44-45).
    if (next) {
      setName(next.title)
      setSchedule(next.schedule)
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (blueprint) {
        return instantiateCronBlueprint(blueprint.key, blueprintValues, profile)
      }

      return createCronJob(
        { deliver, name: name.trim() || undefined, prompt: prompt.trim(), schedule: schedule.trim() },
        profile
      )
    },
    onError: err => setError(err instanceof Error ? err.message : String(err)),
    onSuccess: () => {
      reset()
      onCreated()
    }
  })

  // "Create stays disabled until name, prompt and schedule are set"
  // (tasks.html:48-49). A template supplies its own prompt host-side, so for
  // that path the gate is its required fields instead.
  const canCreate = blueprint
    ? blueprint.fields.every(field => field.optional || (blueprintValues[field.name] ?? '').trim().length > 0)
    : prompt.trim().length > 0 && schedule.trim().length > 0 && name.trim().length > 0

  const echo = useMemo(() => {
    if (blueprint) {
      return blueprint.scheduleHuman
    }

    return describeCronExpr(schedule)
  }, [blueprint, schedule])

  const deliverLabel = targets.find(target => target.id === deliver)?.name ?? t.cron.deliveryLabels.local ?? deliver

  return (
    <Sheet
      footer={
        <>
          <Button block onPress={onClose} style={styles.footerButton} variant="secondary">
            {t.common.cancel}
          </Button>
          <Button
            block
            disabled={!canCreate || createMutation.isPending}
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
            style={styles.footerButton}
            variant="primary"
          >
            {t.cron.createAction}
          </Button>
        </>
      }
      onClose={onClose}
      title={TASKS_NEW_TASK_TITLE}
      visible={visible}
    >
      <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{t.cron.blueprints.startFrom}</Text>
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
        <TemplateChip
          active={blueprint === null}
          label={TASKS_TEMPLATE_NONE}
          onPress={() => pickBlueprint(null)}
          tokens={tokens}
        />
        {blueprints.map(item => (
          <TemplateChip
            active={item.key === blueprintKey}
            key={item.key}
            label={item.title}
            onPress={() => pickBlueprint(item)}
            tokens={tokens}
          />
        ))}
      </ScrollView>

      {blueprint ? (
        <>
          {blueprint.description ? (
            <Text style={[styles.hint, { color: tokens.textTertiary }]}>{blueprint.description}</Text>
          ) : null}
          {blueprint.fields.map(field =>
            field.type === 'enum' ? (
              <Pressable key={field.name} onPress={() => setOpenPicker(`field:${field.name}`)}>
                <Input
                  editable={false}
                  label={field.label}
                  pointerEvents="none"
                  value={blueprintValues[field.name] ?? ''}
                />
              </Pressable>
            ) : (
              <Input
                hint={field.help}
                key={field.name}
                label={field.label}
                onChangeText={value => setBlueprintValues(current => ({ ...current, [field.name]: value }))}
                value={blueprintValues[field.name] ?? ''}
              />
            )
          )}
        </>
      ) : (
        <>
          <Input label={TASKS_NAME_LABEL} onChangeText={setName} placeholder={TASKS_NAME_PLACEHOLDER} value={name} />
          <Input
            label={t.cron.promptLabel}
            multiline
            numberOfLines={3}
            onChangeText={setPrompt}
            placeholder={t.cron.promptPlaceholder}
            style={styles.multiline}
            value={prompt}
          />

          <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>{TASKS_WHEN_TO_RUN_LABEL}</Text>
          <ListRow
            onPress={() => setOpenPicker('schedule')}
            title={TASKS_FREQUENCY_LABEL}
            value={t.cron.scheduleLabels[scheduleKindForExpr(schedule)]}
          />
          <Input
            autoCapitalize="none"
            hint={t.cron.scheduleHints.custom}
            label={TASKS_ADVANCED_SCHEDULE_LABEL}
            onChangeText={setSchedule}
            style={styles.mono}
            value={schedule}
          />
        </>
      )}

      {/* Field (ours), tasks.html:30-32 and :294-297 — the plain-language
          echo next to the string that will actually be sent. When the
          humanizer can't describe the expression this renders the expression
          alone rather than a wrong sentence. */}
      <View style={[styles.echo, { backgroundColor: tokens.bgQuinary }]}>
        <Text style={[styles.echoText, { color: tokens.foreground }]}>{echo ?? schedule}</Text>
        {echo ? (
          <Text style={[styles.echoExpr, { color: tokens.textTertiary }]}>{blueprint?.schedule ?? schedule}</Text>
        ) : null}
      </View>

      <ListRow onPress={() => setOpenPicker('deliver')} title={t.cron.deliverLabel} value={deliverLabel} />

      {error ? <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text> : null}

      <Menu
        items={SCHEDULE_PRESETS.map(preset => ({
          active: preset.expr === schedule,
          key: preset.expr,
          label: t.cron.scheduleLabels[preset.kind],
          onPress: () => setSchedule(preset.expr),
          subtitle: describeCronExpr(preset.expr) ?? preset.expr
        }))}
        onClose={() => setOpenPicker(null)}
        title={TASKS_WHEN_TO_RUN_LABEL}
        visible={openPicker === 'schedule'}
      />

      <Menu
        items={targets.map(target => ({
          active: target.id === deliver,
          key: target.id,
          label: target.name,
          onPress: () => setDeliver(target.id),
          // `home_target_set: false` means the platform is configured but has
          // no cron home channel, so a job delivered there would go nowhere.
          // The route lists it deliberately so a picker can say why rather
          // than omit it (src/api/cron.ts:43-48).
          subtitle: target.home_target_set ? undefined : t.cron.deliverNeedsHomeChannel
        }))}
        onClose={() => setOpenPicker(null)}
        title={t.cron.deliverLabel}
        visible={openPicker === 'deliver'}
      />

      {blueprint?.fields
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
            onClose={() => setOpenPicker(null)}
            title={field.label}
            visible={openPicker === `field:${field.name}`}
          />
        ))}
    </Sheet>
  )
}

function TemplateChip({
  active,
  label,
  onPress,
  tokens
}: {
  active: boolean
  label: string
  onPress: () => void
  tokens: ReturnType<typeof useTheme>
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      // `chip--hit` in the prototype (tasks.html:38): 32 dp of visible chip
      // inside a 48 dp hit target, so the row reads compact without any
      // target dropping under the minimum.
      style={styles.chipHit}
    >
      <View
        style={[
          styles.chip,
          { backgroundColor: active ? tokens.primary : tokens.bgTertiary, borderColor: tokens.border }
        ]}
      >
        <Text style={[styles.chipText, { color: active ? tokens.primaryForeground : tokens.foreground }]}>{label}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  chipHit: {
    height: 48,
    justifyContent: 'center'
  },
  chipRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 8
  },
  chipText: {
    ...typeTokens.bodySmall,
    fontWeight: '600'
  },
  echo: {
    alignItems: 'center',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  echoExpr: {
    ...typeTokens.mono
  },
  echoText: {
    ...typeTokens.bodySmall,
    flex: 1,
    fontWeight: '500'
  },
  error: {
    ...typeTokens.caption,
    marginTop: 6
  },
  // `Button`'s `block` is `width: '100%'` (ui/Button.tsx:93-95), so two of
  // them inside `Sheet`'s `flexDirection: 'row'` footer overflow and the
  // second is pushed off-screen — device-measured at 8.0x48.0 dp in round 12
  // before this. Same call-site `flex: 1` the other two-button sheet footers
  // already use (app/(main)/bots/index.tsx:494-496 `sheetFooterButton`,
  // projects/index.tsx, settings/profiles.tsx).
  footerButton: {
    flex: 1
  },
  hint: {
    ...typeTokens.caption,
    marginBottom: 6
  },
  mono: {
    ...typeTokens.mono
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top'
  },
  sectionLabel: {
    ...typeTokens.caption,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase'
  }
})
