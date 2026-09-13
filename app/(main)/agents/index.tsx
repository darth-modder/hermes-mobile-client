import { Fragment } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { ListRow, ListRowSeparator } from '../../../src/components/ui/ListRow'
import {
  AGENTS_DONE_DESC,
  AGENTS_FAILED_DESC,
  AGENTS_NOT_AVAILABLE,
  AGENTS_RUNNING_DESC
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

const STATUS_ROWS = [
  { description: AGENTS_RUNNING_DESC, title: t.agents.running },
  { description: AGENTS_DONE_DESC, title: t.agents.done },
  { description: AGENTS_FAILED_DESC, title: t.agents.failed }
]

// Replicates: docs/desktop-prototypes/a-main/agents.html (Panel, SubagentTree
// / DelegationGroup / SubagentRow) — the live cross-session spawn tree the
// desktop builds from its own `store/subagents`. There is no mobile
// equivalent of that store (checked src/gateway and src/store — a session's
// own delegations reach this app as chat tool cards, per-session, never
// aggregated across sessions), and M14 is layout-only: it may not invent new
// backend API surface (models.tsx/appearance.tsx/safety.tsx already drew
// this line for their own gaps). So this screen is real but inert — title
// and status words are the vendored `t.agents` block (D15.4); the status
// row descriptions are adapted from the prototype's own Measurements block
// (status glyph meanings), the same "copy the prototype's field text"
// precedent as CHAT_FIELDS/SAFETY_FIELDS/MEMORY_FIELDS use, since t.agents
// has no full-sentence description for any of them (see strings.mobile.ts's
// header on this screen). No M15-tagged content — this view has none to
// exclude.
export default function AgentsScreen() {
  const tokens = useTheme()

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={t.shell.statusbar.agents} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: tokens.mutedForeground }]}>{t.agents.subtitle}</Text>
        {STATUS_ROWS.map((row, index) => (
          <Fragment key={row.title}>
            <ListRow subtitle={row.description} title={row.title} />
            {index < STATUS_ROWS.length - 1 ? <ListRowSeparator /> : null}
          </Fragment>
        ))}
        <Text style={[styles.notice, { color: tokens.mutedForeground }]}>{AGENTS_NOT_AVAILABLE}</Text>
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
  subtitle: {
    ...type.bodySmall,
    marginBottom: 16
  }
})
