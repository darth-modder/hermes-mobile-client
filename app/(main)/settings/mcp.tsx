import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Servers</Text>
        {serversQuery.isLoading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {serversQuery.isError ? (
          <Text style={[styles.errorText, { color: tokens.destructive }]}>
            {serversQuery.error instanceof Error ? serversQuery.error.message : String(serversQuery.error)}
          </Text>
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
              <TouchableOpacity onPress={() => removeMutation.mutate(server.name)} style={styles.actionButton}>
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
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600'
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
  testMessage: {
    fontSize: 12,
    marginTop: 6
  }
})
