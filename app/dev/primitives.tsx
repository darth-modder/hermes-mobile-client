// Dev-only story screen for src/components/ui/* (M14 task list). Not a
// ported screen — no `Replicates:` comment, excluded from that unit test.
// Mirrors docs/mobile-prototypes/primitives.html's section order so the two
// can be read side by side.
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { Input } from '../../src/components/ui/Input'
import { ListRow, ListRowSeparator } from '../../src/components/ui/ListRow'
import { Menu } from '../../src/components/ui/Menu'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { Sheet } from '../../src/components/ui/Sheet'
import { Switch } from '../../src/components/ui/Switch'
import { Tabs } from '../../src/components/ui/Tabs'
import { useTheme } from '../../src/theme/provider'
import { type } from '../../src/theme/type'

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  const tokens = useTheme()

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tokens.textTertiary }]}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

export default function PrimitivesScreen() {
  const tokens = useTheme()
  const [mode, setMode] = useState<'dark' | 'light' | 'system'>('light')
  const [tab, setTab] = useState<'bots' | 'sessions' | 'tasks'>('sessions')
  const [switchOn, setSwitchOn] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: tokens.foreground }]}>Primitives</Text>
        <Text style={[styles.headingSub, { color: tokens.textTertiary }]}>
          src/components/ui/* · DESKTOP-DESIGN.md §8
        </Text>

        <Section title="Button">
          <View style={styles.row}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
          </View>
          <View style={styles.row}>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
          </View>
          <Button block variant="primary">
            Sign in &amp; connect
          </Button>
          <View style={styles.row}>
            <Button
              accessibilityLabel="Search"
              icon={<Text style={{ color: tokens.textPrimary }}>⌕</Text>}
              variant="secondary"
            />
            <Button disabled variant="secondary">
              Disabled
            </Button>
            <Button loading variant="primary">
              Signing in…
            </Button>
          </View>
        </Section>

        <Section title="Badge">
          <View style={styles.row}>
            <Badge>Recommended</Badge>
            <Badge variant="muted">draft</Badge>
            <Badge variant="warn">degraded</Badge>
            <Badge variant="danger">recursive delete</Badge>
            <Badge variant="good">connected</Badge>
          </View>
        </Section>

        <Section title="Input">
          <Input
            hint="Where the guard sentence lives."
            label="Gateway URL"
            placeholder="https://your-pc.tailnet.ts.net:9119"
          />
          <Input error="Never enter 127.0.0.1 on your phone." label="Gateway URL" value="http://127.0.0.1:9119" />
        </Section>

        <Section title="ListRow">
          <ListRow onPress={() => {}} title="Notifications" />
          <ListRowSeparator />
          <ListRow onPress={() => {}} subtitle="How this phone reaches your host" title="Security & pairing" />
          <ListRowSeparator />
          <ListRow onPress={() => {}} title="Appearance" value="Nous · dark" />
          <ListRowSeparator />
          <ListRow
            right={<Switch accessibilityLabel="Stream replies" onValueChange={setSwitchOn} value={switchOn} />}
            subtitle="Render tokens as they arrive"
            title="Stream replies"
          />
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            onChange={setMode}
            options={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'System', value: 'system' }
            ]}
            value={mode}
          />
        </Section>

        <Section title="Tabs">
          <Tabs
            onChange={setTab}
            tabs={[
              { label: 'Bots', value: 'bots' },
              { label: 'Sessions', value: 'sessions' },
              { label: 'Tasks', value: 'tasks' }
            ]}
            value={tab}
          />
        </Section>

        <Section title="Sheet / Menu">
          <View style={styles.row}>
            <Button onPress={() => setSheetOpen(true)} variant="secondary">
              Open sheet
            </Button>
            <Button onPress={() => setMenuOpen(true)} variant="secondary">
              Open menu
            </Button>
          </View>
        </Section>
      </ScrollView>

      <Sheet
        footer={
          <>
            <Button block onPress={() => setSheetOpen(false)} style={{ flex: 1 }} variant="secondary">
              Cancel
            </Button>
            <Button block onPress={() => setSheetOpen(false)} style={{ flex: 1 }} variant="primary">
              Save
            </Button>
          </>
        }
        onClose={() => setSheetOpen(false)}
        title="Reasoning effort"
        visible={sheetOpen}
      >
        <Text style={[type.body, { color: tokens.foreground, paddingVertical: 12 }]}>Low · Medium · High</Text>
      </Sheet>

      <Menu
        items={[
          { key: 'low', label: 'Low', onPress: () => {} },
          { active: true, key: 'medium', label: 'Medium', onPress: () => {} },
          { danger: true, key: 'forget', label: 'Forget this host', onPress: () => {} }
        ]}
        onClose={() => setMenuOpen(false)}
        title="Reasoning effort"
        visible={menuOpen}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    gap: 4,
    padding: 16
  },
  heading: {
    ...type.title,
    fontWeight: '700'
  },
  headingSub: {
    ...type.caption,
    marginBottom: 12
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  section: {
    gap: 8,
    paddingVertical: 12
  },
  sectionBody: {
    gap: 10
  },
  sectionTitle: {
    ...type.caption,
    fontWeight: '600',
    textTransform: 'uppercase'
  }
})
