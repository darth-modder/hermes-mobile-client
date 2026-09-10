import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useTheme } from '../../../src/theme/provider'
import type { WebhookRoute } from '../../../src/upstream/types/hermes'

const QUERY_KEY = ['webhooks']

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
    Alert.alert('Delete webhook?', route.name, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => deleteMutation.mutate(route.name), style: 'destructive', text: 'Delete' }
    ])
  }

  const data = webhooksQuery.data
  const subscriptions = data?.subscriptions ?? []

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <ScreenHeader title="Webhooks" />
      <ScrollView contentContainerStyle={styles.content}>
        {webhooksQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} style={styles.spinner} /> : null}
        {webhooksQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {webhooksQuery.error instanceof Error ? webhooksQuery.error.message : String(webhooksQuery.error)}
          </Text>
        ) : null}

        {data && !data.enabled ? (
          <View style={[styles.banner, { backgroundColor: tokens.muted, borderColor: tokens.semantic.orange }]}>
            <Text style={[styles.bannerText, { color: tokens.semantic.orange }]}>The webhook gateway is disabled.</Text>
            <TouchableOpacity
              disabled={enableGatewayMutation.isPending}
              onPress={() => enableGatewayMutation.mutate()}
              style={styles.bannerButton}
            >
              <Text style={[styles.actionText, { color: tokens.primary }]}>
                {enableGatewayMutation.isPending ? 'Enabling…' : 'Enable'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {newSecret ? (
          <View style={[styles.secretCard, { backgroundColor: tokens.muted, borderColor: tokens.semantic.green }]}>
            <Text style={[styles.rowTitle, { color: tokens.foreground }]}>Webhook created</Text>
            <Text style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
              Secret (shown once) — save it now:
            </Text>
            <Text selectable style={[styles.secretText, { color: tokens.inlineCodeForeground }]}>
              {newSecret}
            </Text>
            <TouchableOpacity onPress={() => setNewSecret(null)} style={styles.actionButton}>
              <Text style={[styles.actionText, { color: tokens.primary }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {subscriptions.length === 0 && !webhooksQuery.isLoading ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No webhooks yet.</Text>
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
                Events: {route.events.join(', ')}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => confirmDelete(route)} style={styles.actionButton}>
                <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>New webhook</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={name}
        />
        <TextInput
          onChangeText={setPrompt}
          placeholder="Prompt (what Hermes does when it fires)"
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
          placeholder="Events (comma-separated, optional)"
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
            {createMutation.isPending ? 'Creating…' : 'Create webhook'}
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
    fontSize: 13,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 12
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  banner: {
    alignItems: 'center',
    borderRadius: 8,
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
    flex: 1,
    fontSize: 13
  },
  card: {
    borderRadius: 10,
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
    fontSize: 13,
    fontWeight: '600'
  },
  errorText: {
    fontSize: 12,
    marginTop: 6
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowMeta: {
    fontSize: 11,
    marginTop: 4
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  secretCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  secretText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 6
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 6
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginBottom: 12
  }
})
