import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  createWebhook,
  deleteWebhook,
  enableWebhooks,
  getWebhooks,
  setWebhookEnabled
} from '../../../src/api/messaging'
import { ScreenHeader } from '../../../src/components/ScreenHeader'
import { t } from '../../../src/lib/t'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { WebhookRoute } from '../../../src/upstream/types/hermes'

const QUERY_KEY = ['webhooks']

// Replicates: docs/desktop-prototypes/a-main/webhooks.html (PanelList +
// PanelDetail, the disabled-receiver Alert, the create dialog's "Subscription
// created" secret reveal) — collapsed here into one scrolling list, as this
// screen predates M14's list/detail adaptation and a real M09/M10 build isn't
// worth rewriting for layout alone. Labels below come from the vendored
// `t.webhooks` block (D15.4); the screen title stays the drawer's own
// "Webhooks" (`t.shell.statusbar.webhooks`, src/components/drawer-rows.ts)
// rather than the desktop's per-route "Subscriptions (N)" header.
/**
 * Webhooks screen (M10). `/api/webhooks/*` (src/api/messaging.ts, ported by
 * M09 for this milestone to consume). Exit criterion: "Webhook create /
 * enable / delete round-trips" — covers both meanings of "enable" the
 * upstream surface has: the webhook gateway platform as a whole
 * (`POST /api/webhooks/enable`, shown as a banner when off) and one route's
 * own `enabled` flag (`PUT /api/webhooks/{name}/enabled`, the row switch).
 */
export default function WebhooksScreen() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState('')
  const [newSecret, setNewSecret] = useState<null | string>(null)

  const webhooksQuery = useQuery({ queryFn: () => getWebhooks(), queryKey: QUERY_KEY })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const enableGatewayMutation = useMutation({ mutationFn: () => enableWebhooks(), onSuccess: invalidate })

  const createMutation = useMutation({
    mutationFn: () =>
      createWebhook({
        events: events
          .split(',')
          .map(e => e.trim())
          .filter(Boolean),
        name: name.trim(),
        prompt: prompt.trim() || undefined
      }),
    onSuccess: result => {
      setNewSecret(result.secret)
      setName('')
      setPrompt('')
      setEvents('')
      invalidate()
    }
  })

  const toggleMutation = useMutation({
    mutationFn: (args: { name: string; enabled: boolean }) => setWebhookEnabled(args.name, args.enabled),
    onSuccess: invalidate
  })

  const deleteMutation = useMutation({
    mutationFn: (routeName: string) => deleteWebhook(routeName),
    onSuccess: invalidate
  })

  const confirmDelete = (route: WebhookRoute) => {
    Alert.alert(t.webhooks.deleteTitle, `${t.webhooks.deleteDescPrefix}${route.name}${t.webhooks.deleteDescSuffix}`, [
      { style: 'cancel', text: t.common.cancel },
      { onPress: () => deleteMutation.mutate(route.name), style: 'destructive', text: t.webhooks.delete }
    ])
  }

  const data = webhooksQuery.data
  const subscriptions = data?.subscriptions ?? []

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title={t.shell.statusbar.webhooks} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void webhooksQuery.refetch()}
            refreshing={webhooksQuery.isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        {webhooksQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {webhooksQuery.isError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {webhooksQuery.error instanceof Error ? webhooksQuery.error.message : String(webhooksQuery.error)}
            </Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => void webhooksQuery.refetch()}
              style={[styles.retryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.retryText, { color: tokens.primaryForeground }]}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {data && !data.enabled ? (
          <View style={[styles.banner, { backgroundColor: tokens.muted, borderColor: tokens.semantic.orange }]}>
            <Text style={[styles.bannerText, { color: tokens.semantic.orange }]}>{t.webhooks.disabledTitle}</Text>
            <TouchableOpacity
              disabled={enableGatewayMutation.isPending}
              hitSlop={8}
              onPress={() => enableGatewayMutation.mutate()}
              style={styles.bannerButton}
            >
              <Text style={[styles.actionText, { color: tokens.primary }]}>
                {enableGatewayMutation.isPending ? t.webhooks.enabling : t.webhooks.enable}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {newSecret ? (
          <View style={[styles.secretCard, { backgroundColor: tokens.muted, borderColor: tokens.semantic.green }]}>
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{t.webhooks.createdTitle}</Text>
            <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>{t.webhooks.createdSecretHint}</Text>
            <Text selectable style={[styles.secretText, { color: tokens.inlineCodeForeground }]}>
              {newSecret}
            </Text>
            <TouchableOpacity hitSlop={8} onPress={() => setNewSecret(null)} style={styles.actionButton}>
              <Text style={[styles.actionText, { color: tokens.primary }]}>{t.webhooks.done}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {subscriptions.length === 0 && !webhooksQuery.isLoading && !webhooksQuery.isError ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>{t.webhooks.empty}</Text>
        ) : null}

        {subscriptions.map(route => (
          <View key={route.name} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{route.name}</Text>
              <Switch
                onValueChange={value => toggleMutation.mutate({ enabled: value, name: route.name })}
                value={route.enabled}
              />
            </View>
            <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
              {route.url}
            </Text>
            {route.events.length > 0 ? (
              <Text numberOfLines={1} style={[styles.rowMeta, { color: tokens.textQuaternary }]}>
                {t.webhooks.fieldEvents}: {route.events.join(', ')}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <TouchableOpacity hitSlop={8} onPress={() => confirmDelete(route)} style={styles.actionButton}>
                <Text style={[styles.destructiveText, { color: tokens.destructive }]}>{t.webhooks.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>{t.webhooks.newSubscription}</Text>
        <TextInput
          onChangeText={setName}
          placeholder={t.webhooks.fieldNamePlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={name}
        />
        <TextInput
          onChangeText={setPrompt}
          placeholder={t.webhooks.fieldPromptPlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={prompt}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setEvents}
          placeholder={t.webhooks.fieldEventsPlaceholder}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={events}
        />
        <TouchableOpacity
          disabled={createMutation.isPending || !name.trim()}
          onPress={() => createMutation.mutate()}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.addButtonText, { color: tokens.primaryForeground }]}>
            {createMutation.isPending ? t.webhooks.creating : t.webhooks.create}
          </Text>
        </TouchableOpacity>
        {createMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {createMutation.error instanceof Error ? createMutation.error.message : String(createMutation.error)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    marginRight: 16,
    marginTop: 8
  },
  actionText: {
    ...type.label,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  addButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    marginTop: 4,
    paddingVertical: 12
  },
  addButtonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  banner: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 12
  },
  bannerButton: {
    paddingHorizontal: 8
  },
  bannerText: {
    ...type.label,
    flex: 1
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
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
  rowMeta: {
    ...type.caption,
    marginTop: 4
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  secretCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  secretText: {
    ...type.mono,
    marginTop: 6
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
