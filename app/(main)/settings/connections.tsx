import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deleteConnection,
  getActiveConnection,
  listConnections,
  setPrimaryConnection,
  switchActiveConnection,
  upsertConnection
} from '../../../src/connections/registry'
import { deleteAllConnectionSecrets } from '../../../src/connections/secure'
import type { MobileConnection } from '../../../src/connections/types'
import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { signOutConnection } from '../../../src/net/auth/logout'
import { type ConnectionTestResult, testConnection } from '../../../src/net/connection-test'
import { setActiveProfile } from '../../../src/store/profile'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

function relativeTime(epochMs: number): string {
  const minutes = Math.floor((Date.now() - epochMs) / 60_000)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

const AUTH_MODE_LABEL: Record<MobileConnection['authMode'], string> = {
  oauth: 'Nous Portal',
  password: 'Password',
  token: 'Token'
}

/**
 * Connections settings screen (M09): add / edit / test / delete, primary and
 * last-used. "Add" reuses the existing `/connect` flow (M04/M08) rather than
 * a second add form — that screen already handles auth-mode detection.
 */
export default function ConnectionsSettings() {
  const tokens = useTheme()
  const router = useRouter()
  const [connections, setConnections] = useState<MobileConnection[]>([])
  const [activeId, setActiveId] = useState<null | string>(null)
  const [editingId, setEditingId] = useState<null | string>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [testing, setTesting] = useState<null | string>(null)
  const [results, setResults] = useState<Record<string, ConnectionTestResult>>({})
  const [signingOut, setSigningOut] = useState<null | string>(null)

  const refresh = useCallback(() => {
    setConnections(listConnections())
    setActiveId(getActiveConnection()?.id ?? null)
  }, [])

  useFocusEffect(refresh)

  const startEditing = (connection: MobileConnection) => {
    setEditingId(connection.id)
    setEditingLabel(connection.label)
  }

  const saveLabel = (connection: MobileConnection) => {
    const label = editingLabel.trim()

    if (label) {
      upsertConnection({ ...connection, label })
    }

    setEditingId(null)
    refresh()
  }

  const use = (connection: MobileConnection) => {
    switchActiveConnection(connection.id)
    // A profile name only means something on the backend it was switched
    // active for — carrying one over to a different connection would scope
    // REST calls / session.create to a profile that may not exist there.
    setActiveProfile('')
    refresh()
  }

  const makePrimary = (connection: MobileConnection) => {
    setPrimaryConnection(connection.id)
    refresh()
  }

  const test = async (connection: MobileConnection) => {
    setTesting(connection.id)

    const result = await testConnection(connection)

    setResults(current => ({ ...current, [connection.id]: result }))
    setTesting(null)
  }

  const signOut = (connection: MobileConnection) => {
    Alert.alert('Sign out?', connection.label, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          setSigningOut(connection.id)
          void signOutConnection(connection).finally(() => {
            setSigningOut(null)
            refresh()
          })
        },
        style: 'destructive',
        text: 'Sign out'
      }
    ])
  }

  const remove = (connection: MobileConnection) => {
    Alert.alert('Delete connection?', connection.label, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          deleteConnection(connection.id)
          void deleteAllConnectionSecrets(connection.id, connection.headerNames)
          refresh()
        },
        style: 'destructive',
        text: 'Delete'
      }
    ])
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Connections' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {connections.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.mutedForeground }]}>No saved connections yet.</Text>
        ) : (
          connections.map(connection => {
            const result = results[connection.id]
            const isActive = connection.id === activeId

            return (
              <View
                key={connection.id}
                style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
              >
                <View style={styles.cardHeader}>
                  {editingId === connection.id ? (
                    <TextInput
                      autoFocus
                      onChangeText={setEditingLabel}
                      onSubmitEditing={() => saveLabel(connection)}
                      style={[styles.labelInput, { borderBottomColor: tokens.primary, color: tokens.foreground }]}
                      value={editingLabel}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => startEditing(connection)} style={styles.labelRow}>
                      <Text numberOfLines={1} style={[styles.label, { color: tokens.foreground }]}>
                        {connection.label}
                      </Text>
                      {connection.primary ? (
                        <Text style={[styles.primaryBadge, { color: tokens.semantic.yellow }]}>★ primary</Text>
                      ) : null}
                      {isActive ? (
                        <Text style={[styles.activeBadge, { color: tokens.semantic.green }]}>active</Text>
                      ) : null}
                    </TouchableOpacity>
                  )}
                </View>

                <Text numberOfLines={1} style={[styles.baseUrl, { color: tokens.mutedForeground }]}>
                  {connection.baseUrl}
                </Text>
                <Text style={[styles.meta, { color: tokens.mutedForeground }]}>
                  {AUTH_MODE_LABEL[connection.authMode]}
                  {connection.lastUsedAt ? ` · used ${relativeTime(connection.lastUsedAt)}` : ' · never used'}
                  {connection.needsLogin ? ' · needs sign-in' : ''}
                </Text>

                {result ? (
                  <Text style={[styles.resultText, { color: result.ok ? tokens.semantic.green : tokens.destructive }]}>
                    {result.message}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  {!isActive ? (
                    <TouchableOpacity
                      onPress={() => use(connection)}
                      style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                    >
                      <Text style={[styles.actionText, { color: tokens.secondaryForeground }]}>Use</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    disabled={testing === connection.id}
                    onPress={() => void test(connection)}
                    style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                  >
                    <Text style={[styles.actionText, { color: tokens.secondaryForeground }]}>
                      {testing === connection.id ? 'Testing…' : 'Test'}
                    </Text>
                  </TouchableOpacity>
                  {!connection.primary ? (
                    <TouchableOpacity
                      onPress={() => makePrimary(connection)}
                      style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                    >
                      <Text style={[styles.actionText, { color: tokens.secondaryForeground }]}>Set primary</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    disabled={signingOut === connection.id}
                    onPress={() => signOut(connection)}
                    style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                  >
                    <Text style={[styles.destructiveText, { color: tokens.destructive }]}>
                      {signingOut === connection.id ? 'Signing out…' : 'Sign out'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => remove(connection)}
                    style={[styles.actionButton, { backgroundColor: tokens.secondary }]}
                  >
                    <Text style={[styles.destructiveText, { color: tokens.destructive }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}

        <TouchableOpacity
          onPress={() => router.push('/connect')}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.addButtonText, { color: tokens.primaryForeground }]}>+ Add connection</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    borderRadius: 6,
    marginRight: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  actionText: {
    ...type.caption,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  activeBadge: {
    ...type.caption,
    fontWeight: '700',
    marginLeft: 8
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 12
  },
  addButtonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  baseUrl: {
    ...type.mono,
    marginTop: 4
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  cardHeader: {
    flexDirection: 'row'
  },
  container: {
    flex: 1
  },
  content: {
    padding: 16
  },
  destructiveText: {
    ...type.caption,
    fontWeight: '600'
  },
  emptyText: {
    ...type.bodySmall,
    marginBottom: 16
  },
  label: {
    ...type.body,
    flexShrink: 1,
    fontWeight: '600'
  },
  labelInput: {
    ...type.body,
    borderBottomWidth: 1,
    flex: 1,
    paddingVertical: 2
  },
  labelRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row'
  },
  meta: {
    ...type.caption,
    marginTop: 4
  },
  primaryBadge: {
    ...type.caption,
    fontWeight: '700',
    marginLeft: 8
  },
  resultText: {
    ...type.caption,
    marginTop: 6
  }
})
