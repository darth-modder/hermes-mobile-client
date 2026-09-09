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
import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'
import { signOutConnection } from '../../../src/net/auth/logout'
import { type ConnectionTestResult, testConnection } from '../../../src/net/connection-test'
import { setActiveProfile } from '../../../src/store/profile'

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
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Connections' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {connections.length === 0 ? (
          <Text style={styles.emptyText}>No saved connections yet.</Text>
        ) : (
          connections.map(connection => {
            const result = results[connection.id]
            const isActive = connection.id === activeId

            return (
              <View key={connection.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  {editingId === connection.id ? (
                    <TextInput
                      autoFocus
                      onChangeText={setEditingLabel}
                      onSubmitEditing={() => saveLabel(connection)}
                      style={styles.labelInput}
                      value={editingLabel}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => startEditing(connection)} style={styles.labelRow}>
                      <Text numberOfLines={1} style={styles.label}>
                        {connection.label}
                      </Text>
                      {connection.primary ? <Text style={styles.primaryBadge}>★ primary</Text> : null}
                      {isActive ? <Text style={styles.activeBadge}>active</Text> : null}
                    </TouchableOpacity>
                  )}
                </View>

                <Text numberOfLines={1} style={styles.baseUrl}>
                  {connection.baseUrl}
                </Text>
                <Text style={styles.meta}>
                  {AUTH_MODE_LABEL[connection.authMode]}
                  {connection.lastUsedAt ? ` · used ${relativeTime(connection.lastUsedAt)}` : ' · never used'}
                  {connection.needsLogin ? ' · needs sign-in' : ''}
                </Text>

                {result ? (
                  <Text style={[styles.resultText, result.ok ? styles.resultOk : styles.resultFail]}>
                    {result.message}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  {!isActive ? (
                    <TouchableOpacity onPress={() => use(connection)} style={styles.actionButton}>
                      <Text style={styles.actionText}>Use</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    disabled={testing === connection.id}
                    onPress={() => void test(connection)}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionText}>{testing === connection.id ? 'Testing…' : 'Test'}</Text>
                  </TouchableOpacity>
                  {!connection.primary ? (
                    <TouchableOpacity onPress={() => makePrimary(connection)} style={styles.actionButton}>
                      <Text style={styles.actionText}>Set primary</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    disabled={signingOut === connection.id}
                    onPress={() => signOut(connection)}
                    style={styles.actionButton}
                  >
                    <Text style={styles.destructiveText}>
                      {signingOut === connection.id ? 'Signing out…' : 'Sign out'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(connection)} style={styles.actionButton}>
                    <Text style={styles.destructiveText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}

        <TouchableOpacity onPress={() => router.push('/connect')} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add connection</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: '#17171d',
    borderRadius: 6,
    marginRight: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  actionText: {
    color: '#f2f2f5',
    fontSize: 12,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  activeBadge: {
    color: '#3fb950',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8
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
  baseUrl: {
    color: '#8a8a99',
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 4
  },
  card: {
    backgroundColor: '#111116',
    borderColor: '#2a2a33',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  cardHeader: {
    flexDirection: 'row'
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
    fontSize: 12,
    fontWeight: '600'
  },
  emptyText: {
    color: '#5a5a66',
    fontSize: 14,
    marginBottom: 16
  },
  label: {
    color: '#f2f2f5',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600'
  },
  labelInput: {
    borderBottomColor: '#1f6feb',
    borderBottomWidth: 1,
    color: '#f2f2f5',
    flex: 1,
    fontSize: 15,
    paddingVertical: 2
  },
  labelRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row'
  },
  meta: {
    color: '#5a5a66',
    fontSize: 12,
    marginTop: 4
  },
  primaryBadge: {
    color: '#d19a66',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8
  },
  resultFail: {
    color: '#e06c75'
  },
  resultOk: {
    color: '#3fb950'
  },
  resultText: {
    fontSize: 12,
    marginTop: 6
  }
})
