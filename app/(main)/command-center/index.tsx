import { Fragment } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import {
  COMMAND_CENTER_USAGE_NOT_AVAILABLE,
  USAGE_API_CALLS_DESC,
  USAGE_DAILY_TOKENS_DESC,
  USAGE_SESSIONS_DESC,
  USAGE_TOKENS_DESC,
  USAGE_TOP_MODELS_DESC,
  USAGE_TOP_SKILLS_DESC
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

const USAGE_FIELD_ROWS = [
  { description: USAGE_SESSIONS_DESC, title: t.commandCenter.statSessions },
  { description: USAGE_API_CALLS_DESC, title: t.commandCenter.statApiCalls },
  { description: USAGE_TOKENS_DESC, title: t.commandCenter.statTokens },
  { description: USAGE_DAILY_TOKENS_DESC, title: t.commandCenter.dailyTokens },
  { description: USAGE_TOP_MODELS_DESC, title: t.commandCenter.topModels },
  { description: USAGE_TOP_SKILLS_DESC, title: t.commandCenter.topSkills }
]

// Replicates: docs/desktop-prototypes/a-main/command-center.html's
// `data-view="usage"` section (UsagePanel, UsageStat, UsageList) — one of
// Command Center's four tabs (Sessions, System, Usage, Maintenance). M14
// only wants Usage here: Sessions is its own session-list screen elsewhere
// in the drawer, and System/Maintenance are machine-bound (host gateway
// restart, local diagnostics) so they're absent by the milestone's own
// mapping table, same as `docs/PARITY.md`'s "Command Center is thinner on
// mobile" note.
//
// The panel reads `getUsageAnalytics` (capability-scoped, multi-gateway
// analytics), which src/api/models.ts's own header already says isn't
// ported to mobile — no equivalent surface exists here, and M14 is
// layout-only: it may not invent new backend API surface (models.tsx/
// appearance.tsx/safety.tsx already drew this line for their own gaps). So
// this screen is real but inert: the section title/description are the
// vendored t.commandCenter.sections.usage / sectionDescriptions.usage
// (D15.4); the stat/list titles below are the vendored
// t.commandCenter.stat*/dailyTokens/topModels/topSkills words, paired with
// descriptions adapted from the prototype's own markup (same "copy the
// prototype's field text" precedent as CHAT_FIELDS/SAFETY_FIELDS/
// MEMORY_FIELDS use, since t.commandCenter has no full-sentence description
// for any one of them — see strings.mobile.ts's header on this screen).
// Reusing the vendored empty-state copy (noUsage/noModelUsage/
// noSkillActivity/noDailyActivity) instead would claim "queried, found
// nothing" when this app never queries at all, so it isn't shown.
export default function CommandCenterScreen() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={t.commandCenter.commandCenter} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.commandCenter.sections.usage}</Text>
        <Text style={[styles.subtitle, { color: tokens.mutedForeground }]}>
          {t.commandCenter.sectionDescriptions.usage}
        </Text>
        {USAGE_FIELD_ROWS.map((row, index) => (
          <Fragment key={row.title}>
            <ListRow subtitle={row.description} title={row.title} />
            {index < USAGE_FIELD_ROWS.length - 1 ? <ListRowSeparator /> : null}
          </Fragment>
        ))}
        <Text style={[styles.notice, { color: tokens.mutedForeground }]}>{COMMAND_CENTER_USAGE_NOT_AVAILABLE}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  notice: {
    ...type.bodySmall,
    marginTop: 16
  },
  sectionTitle: {
    ...type.title,
    fontWeight: '700'
  },
  subtitle: {
    ...type.bodySmall,
    marginBottom: 16,
    marginTop: 4
  }
})
