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
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader title="Webhooks" />
      <ScrollView contentContainerStyle={styles.content}>
        {webhooksQuery.isLoading ? <ActivityIndicator color="#8a8a99" style={styles.spinner} /> : null}
        {webhooksQuery.isError ? (
          <Text style={styles.errorText}>
            {webhooksQuery.error instanceof Error ? webhooksQuery.error.message : String(webhooksQuery.error)}
          </Text>
        ) : null}

        {data && !data.enabled ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>The webhook gateway is disabled.</Text>
            <TouchableOpacity
              disabled={enableGatewayMutation.isPending}
              onPress={() => enableGatewayMutation.mutate()}
              style={styles.bannerButton}
            >
              <Text style={styles.actionText}>{enableGatewayMutation.isPending ? 'Enabling…' : 'Enable'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {newSecret ? (
          <View style={styles.secretCard}>
            <Text style={styles.rowTitle}>Webhook created</Text>
            <Text style={styles.rowSubtitle}>Secret (shown once) — save it now:</Text>
            <Text selectable style={styles.secretText}>
              {newSecret}
            </Text>
            <TouchableOpacity onPress={() => setNewSecret(null)} style={styles.actionButton}>
              <Text style={styles.actionText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {subscriptions.length === 0 && !webhooksQuery.isLoading ? (
          <Text style={styles.sectionHint}>No webhooks yet.</Text>
        ) : null}

        {subscriptions.map(route => (
          <View key={route.name} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.rowTitle}>{route.name}</Text>
              <Switch
                onValueChange={value => toggleMutation.mutate({ enabled: value, name: route.name })}
                value={route.enabled}
              />
            </View>
            <Text numberOfLines={1} style={styles.rowSubtitle}>
              {route.url}
            </Text>
            {route.events.length > 0 ? (
              <Text numberOfLines={1} style={styles.rowMeta}>
                Events: {route.events.join(', ')}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => confirmDelete(route)} style={styles.actionButton}>
                <Text style={styles.destructiveText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>New webhook</Text>
        <TextInput
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={name}
        />
        <TextInput
          onChangeText={setPrompt}
          placeholder="Prompt (what Hermes does when it fires)"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={prompt}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setEvents}
          placeholder="Events (comma-separated, optional)"
          placeholderTextColor="#5a5a66"
          style={styles.input}
          value={events}
        />
        <TouchableOpacity
          disabled={createMutation.isPending || !name.trim()}
          onPress={() => createMutation.mutate()}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>{createMutation.isPending ? 'Creating…' : 'Create webhook'}</Text>
        </TouchableOpacity>
        {createMutation.isError ? (
          <Text style={styles.errorText}>
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
    color: '#1f6feb',
    fontSize: 13,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 12
  },
  addButtonText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  banner: {
    alignItems: 'center',
    backgroundColor: '#1f1a10',
    borderColor: '#d19a66',
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
    color: '#d19a66',
    flex: 1,
    fontSize: 13
  },
  card: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
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
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    color: '#e06c75',
    fontSize: 13,
    fontWeight: '600'
  },
  errorText: {
    color: '#e06c75',
    fontSize: 12,
    marginTop: 6
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowMeta: {
    color: '#5a5a66',
    fontSize: 11,
    marginTop: 4
  },
  rowSubtitle: {
    color: '#8a8a99',
    fontSize: 12,
    marginTop: 2
  },
  rowTitle: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  secretCard: {
    backgroundColor: '#0f1a12',
    borderColor: '#3fb950',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  secretText: {
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 6
  },
  sectionHint: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 6
  },
  sectionTitle: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  spinner: {
    marginBottom: 12
  }
})
