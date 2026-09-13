import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getToolsets, setToolsetEnabled } from '../../../src/api/toolsets'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'
import type { ToolsetInfo } from '../../../src/upstream/types/hermes'

// Replicates: docs/desktop-prototypes/a-main/capabilities.html's
// `data-view="toolsets"` panel (its own "Tools" tab, alongside Skills and
// MCP — the M14 mapping's three tabs become three settings rows: this one,
// skills.tsx, mcp.tsx). Was this app's own Toolsets section on
// settings/models.tsx until the 2026-09-12 review moved it here per the
// M14 mapping — same API (src/api/toolsets.ts), same re-fetch-not-
// optimistic pattern as skills.tsx (`setSkillEnabled`'s screen), unchanged.
// The desktop's per-toolset provider/model picker (its own detail pane,
// with usage badges from a 365-day analytics scan this app has no access
// to) stays a structural rewrite for later — src/api/toolsets.ts's own
// header already draws this line ("no per-toolset provider/model picker —
// that is a deep enough surface to deserve its own pass later").
export default function ToolsetsSettings() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const profile = useStore($activeProfile) || undefined

  const toolsetsQuery = useQuery({
    queryFn: () => getToolsets(profile),
    queryKey: ['toolsets', profile]
  })

  const toggleMutation = useMutation({
    mutationFn: (args: { enabled: boolean; name: string }) => setToolsetEnabled(args.name, args.enabled, profile),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['toolsets', profile] })
  })

  const toolsets = toolsetsQuery.data ?? []

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.skills.tabToolsets }} />
      <ScrollView contentContainerStyle={styles.content}>
        {toolsetsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {toolsetsQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {toolsetsQuery.error instanceof Error ? toolsetsQuery.error.message : String(toolsetsQuery.error)}
          </Text>
        ) : null}
        {toolsets.map((toolset: ToolsetInfo) => (
          <View key={toolset.name} style={[styles.row, { borderBottomColor: tokens.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{toolset.label}</Text>
              <Text numberOfLines={2} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
                {toolset.description || t.skills.noDescription}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t.skills.toggleToolset(toolset.label, !toolset.enabled)}
              onValueChange={value => toggleMutation.mutate({ enabled: value, name: toolset.name })}
              value={toolset.enabled}
            />
          </View>
        ))}
        {toolsetsQuery.data?.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{t.skills.noToolsetsTitle}</Text>
        ) : null}
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
  errorText: {
    ...type.caption,
    marginBottom: 8
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 10
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowText: {
    flex: 1,
    paddingRight: 12
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 6
  }
})
