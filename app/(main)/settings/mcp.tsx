import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
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

import { addMcpServer, listMcpServers, removeMcpServer, setMcpServerEnabled, testMcpServer } from '../../../src/api/mcp'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'
import type { McpServerSummary } from '../../../src/upstream/types/hermes'

/**
 * MCP settings screen (M09). Exit criterion: "MCP server add and test
 * succeed" — manual add (name + command-or-url) covers it without the
 * catalog-browse UI (see `src/api/mcp.ts`'s header for what's cut).
 */
export default function McpSettings() {
  const tokens = useTheme()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [testMessages, setTestMessages] = useState<Record<string, string>>({})

  const serversQuery = useQuery({ queryFn: () => listMcpServers(), queryKey: ['mcp-servers'] })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })

  const addMutation = useMutation({
    mutationFn: () => {
      const trimmedTarget = target.trim()
      const isUrl = /^https?:\/\//.test(trimmedTarget)

      return addMcpServer({
        name: name.trim(),
        ...(isUrl ? { url: trimmedTarget } : { command: trimmedTarget })
      })
    },
    onSuccess: () => {
      setName('')
      setTarget('')
      invalidate()
    }
  })

  const toggleMutation = useMutation({
    mutationFn: (args: { enabled: boolean; name: string }) => setMcpServerEnabled(args.name, args.enabled),
    onSuccess: invalidate
  })

  const removeMutation = useMutation({
    mutationFn: (serverName: string) => removeMcpServer(serverName),
    onSuccess: invalidate
  })

  const confirmRemove = (serverName: string) => {
    Alert.alert('Remove MCP server?', serverName, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => removeMutation.mutate(serverName), style: 'destructive', text: 'Remove' }
    ])
  }

  const testMutation = useMutation({
    mutationFn: (serverName: string) => testMcpServer(serverName),
    onSuccess: (result, serverName) => {
      const message = result.ok
        ? `${result.tools.length} tool${result.tools.length === 1 ? '' : 's'} found.`
        : `Failed: ${result.error ?? 'unknown error'}`

      setTestMessages(current => ({ ...current, [serverName]: message }))
    },
    onError: (err, serverName) => {
      setTestMessages(current => ({ ...current, [serverName]: err instanceof Error ? err.message : String(err) }))
    }
  })

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'MCP' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void serversQuery.refetch()}
            refreshing={serversQuery.isRefetching}
            tintColor={tokens.mutedForeground}
          />
        }
      >
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Servers</Text>
        {serversQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {serversQuery.isError ? (
          <View>
            <Text style={[styles.errorText, { color: tokens.destructive }]}>
              {serversQuery.error instanceof Error ? serversQuery.error.message : String(serversQuery.error)}
            </Text>
            <TouchableOpacity onPress={() => void serversQuery.refetch()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: tokens.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {(serversQuery.data?.servers ?? []).map((server: McpServerSummary) => (
          <View key={server.name} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.rowTitle, { color: tokens.foreground }]}>{server.name}</Text>
              <Switch
                onValueChange={value => toggleMutation.mutate({ enabled: value, name: server.name })}
                value={server.enabled}
              />
            </View>
            <Text numberOfLines={1} style={[styles.rowSubtitle, { color: tokens.mutedForeground }]}>
              {server.transport} · {server.url ?? server.command ?? '—'}
            </Text>
            {testMessages[server.name] ? (
              <Text style={[styles.testMessage, { color: tokens.mutedForeground }]}>{testMessages[server.name]}</Text>
            ) : null}
            <View style={styles.actions}>
              <TouchableOpacity
                disabled={testMutation.isPending && testMutation.variables === server.name}
                onPress={() => testMutation.mutate(server.name)}
                style={styles.actionButton}
              >
                <Text style={[styles.actionText, { color: tokens.primary }]}>
                  {testMutation.isPending && testMutation.variables === server.name ? 'Testing…' : 'Test'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmRemove(server.name)} style={styles.actionButton}>
                <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {serversQuery.data?.servers.length === 0 ? (
          <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>No MCP servers configured.</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Add a server</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setName}
          placeholder="name"
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={name}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setTarget}
          placeholder="command, or https:// url"
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={target}
        />
        <TouchableOpacity
          disabled={addMutation.isPending || !name.trim() || !target.trim()}
          onPress={() => addMutation.mutate()}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.addButtonText, { color: tokens.primaryForeground }]}>
            {addMutation.isPending ? 'Adding…' : 'Add server'}
          </Text>
        </TouchableOpacity>
        {addMutation.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {addMutation.error instanceof Error ? addMutation.error.message : String(addMutation.error)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    marginRight: 16
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
    marginTop: 6
  },
  retryText: {
    ...type.label,
    fontWeight: '600'
  },
  rowSubtitle: {
    ...type.caption,
    marginTop: 2
  },
  rowTitle: {
    ...type.bodySmall,
    fontWeight: '600'
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
  testMessage: {
    ...type.caption,
    marginTop: 6
  }
})
