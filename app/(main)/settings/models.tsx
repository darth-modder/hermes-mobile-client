import { useStore } from '@nanostores/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getGlobalModelInfo, getGlobalModelOptions, setGlobalModel } from '../../../src/api/models'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import {
  MODELS_CHOOSE_HINT,
  MODELS_CHOOSE_SECTION_TITLE,
  MODELS_CURRENT_SECTION_TITLE,
  MODELS_NOT_CONFIGURED_SUFFIX,
  MODELS_SWITCHING
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { $activeProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { ModelOptionProvider } from '../../../src/upstream/types/hermes'

// Replicates: docs/mobile-prototypes/settings.html's `data-view="models"`
// (current/default model list with a checkmark lead icon, provider-grouped
// options). Screen title moves to t.settings.sections.model ("Model",
// singular) per D15.4, matching the settings index row (979bbcc) — the
// prototype's own header types "Models" (plural), but the vendored copy
// wins. Two of that view's sections have no home here yet: "Fallback
// providers" (reorderable fallback list) and "Visible in the model picker"
// (docs/desktop-prototypes/e-overlays/model-visibility.html, per the M14
// mapping) both need API surface `src/api/models.ts` doesn't expose today
// (no list/reorder-fallbacks or get/set-visibility endpoint) — adding it
// is data-fetching/mutation work, out of scope for a layout pass, so
// they're left out rather than faked with local-only state. The search
// field above the list is likewise not implemented (needs live filtering
// logic, not just relabelling).
//
// The "Toolsets" section that used to live below (pre-existing, M09) is
// removed here, not just relabelled: it was never part of this prototype
// view's own content, and per the M14 mapping it belongs on the new
// settings/toolsets.tsx (from capabilities.html) — its own later M14 commit
// (2026-09-12 review decision). It comes back there, not here.
/**
 * Models settings screen (M09). Exit criterion: "a model switch is
 * reflected in the next `session.info`" — this screen only owns the switch
 * (`setGlobalModel`, scope: 'main'); the chat screen's `session.info`
 * handling (M06/M07, `src/gateway/session-stream/session-info.ts`) already
 * surfaces whatever the backend reports, unchanged by this milestone.
 */
export default function ModelsSettings() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const profile = useStore($activeProfile) || undefined

  const infoQuery = useQuery({
    queryFn: () => getGlobalModelInfo(profile),
    queryKey: ['model-info', profile]
  })

  const optionsQuery = useQuery({
    queryFn: () => getGlobalModelOptions({ includeUnconfigured: false }, profile),
    queryKey: ['model-options', profile]
  })

  const setModelMutation = useMutation({
    mutationFn: (args: { model: string; provider: string }) => setGlobalModel(args.provider, args.model, profile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['model-info', profile] })
    }
  })

  const current = infoQuery.data

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: t.settings.sections.model }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{MODELS_CURRENT_SECTION_TITLE}</Text>
        {infoQuery.isLoading ? (
          <ActivityIndicator color={tokens.mutedForeground} />
        ) : current ? (
          <Text style={[styles.currentModel, { color: tokens.foreground }]}>
            {current.provider} · {current.model}
          </Text>
        ) : (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{String(infoQuery.error)}</Text>
        )}
        {setModelMutation.isPending ? (
          <Text style={[styles.pendingText, { color: tokens.mutedForeground }]}>{MODELS_SWITCHING}</Text>
        ) : null}
        {setModelMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>{String(setModelMutation.error)}</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{MODELS_CHOOSE_SECTION_TITLE}</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{MODELS_CHOOSE_HINT}</Text>
        {optionsQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {optionsQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {optionsQuery.error instanceof Error ? optionsQuery.error.message : String(optionsQuery.error)}
          </Text>
        ) : null}
        {(optionsQuery.data?.providers ?? []).map((provider: ModelOptionProvider) => (
          <View
            key={provider.slug}
            style={[styles.providerBlock, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <Text style={[styles.providerName, { color: tokens.mutedForeground }]}>
              {provider.name}
              {provider.authenticated === false ? ` ${MODELS_NOT_CONFIGURED_SUFFIX}` : ''}
            </Text>
            {(provider.featured_models?.length ? provider.featured_models : (provider.models ?? []).slice(0, 6)).map(
              model => {
                const isCurrent = current?.provider === provider.slug && current.model === model

                return (
                  <TouchableOpacity
                    disabled={provider.authenticated === false}
                    key={model}
                    onPress={() => setModelMutation.mutate({ model, provider: provider.slug })}
                    style={[styles.modelRow, isCurrent ? styles.modelRowActive : null]}
                  >
                    <Text style={[styles.modelName, { color: tokens.foreground }]}>{model}</Text>
                    {isCurrent ? <Text style={[styles.checkmark, { color: tokens.semantic.green }]}>✓</Text> : null}
                  </TouchableOpacity>
                )
              }
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  checkmark: {
    ...type.bodySmall,
    fontWeight: '700'
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  currentModel: {
    ...type.body,
    fontWeight: '700'
  },
  errorText: {
    ...type.caption,
    marginTop: 4
  },
  modelName: {
    ...type.label
  },
  modelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 8
  },
  modelRowActive: {
    opacity: 1
  },
  pendingText: {
    ...type.caption,
    marginTop: 4
  },
  providerBlock: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  providerName: {
    ...type.caption,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase'
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
  }
})
