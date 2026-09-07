import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { setActiveConnection } from '../../../src/connections/registry'
import type { MobileConnection } from '../../../src/connections/types'
import { buildGatewayWsUrl, createGatewaySocketFactory } from '../../../src/gateway/dial'
import { mintWsTicket, passwordLogin, PasswordLoginError } from '../../../src/net/auth/password-login'
import { probeStatus } from '../../../src/net/auth/probe'

/**
 * Password sign-in for a gated backend (M04). `id`/`baseUrl`/`label`/
 * `provider` come from app/connect/index.tsx's auto-detect step. On success
 * this becomes the active connection; the session lives in cookies (RN's
 * fetch cookie jar, `credentials: 'include'`) — no token is stored for
 * password mode.
 */
export default function PasswordLoginScreen() {
  const router = useRouter()

  const { id, baseUrl, label, provider } = useLocalSearchParams<{
    id: string
    baseUrl: string
    label: string
    provider: string
  }>()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [wsResult, setWsResult] = useState('')

  const testWsTicketDial = async () => {
    if (!baseUrl) {
      return
    }

    setWsResult('Minting ticket…')

    try {
      const { ticket } = await mintWsTicket(baseUrl)
      const url = new URL(baseUrl)

      const wsUrl = buildGatewayWsUrl(
        { host: url.host, protocol: url.protocol as 'http:' | 'https:' },
        { mode: 'ticket', ticket }
      )

      const socketFactory = createGatewaySocketFactory({ mode: 'ticket', ticket })

      // Dial with the exact same factory MobileGateway.connect() would use in
      // ticket mode (dial.ts), just to read back the echoed subprotocol for
      // this on-screen check.
      const socket = socketFactory ? socketFactory(wsUrl) : new WebSocket(wsUrl)

      await new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true })
        socket.addEventListener('error', () => reject(new Error('WS error')), { once: true })
      })

      setWsResult(`WS open — echoed subprotocol: ${socket.protocol || '(none)'}`)
      socket.close()
    } catch (caught) {
      setWsResult(`WS dial failed: ${caught instanceof Error ? caught.message : String(caught)}`)
    }
  }

  const submit = async () => {
    if (!baseUrl || !provider) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await passwordLogin(baseUrl, { provider, username, password })

      const connection: MobileConnection = {
        id: id ?? `conn-${Date.now()}`,
        kind: 'remote',
        label: label || baseUrl,
        baseUrl,
        authMode: 'password',
        provider,
        lastUsedAt: Date.now()
      }

      const statusBody = await probeStatus(baseUrl)

      setActiveConnection({
        ...connection,
        installId: typeof statusBody.install_id === 'string' ? statusBody.install_id : undefined
      })
      setConnected(true)
    } catch (caught) {
      // One error, no retry storm: the request already ran exactly once —
      // this just surfaces its outcome. Nothing here auto-retries.
      setError(
        caught instanceof PasswordLoginError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : String(caught)
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Connected</Text>
        <Text style={styles.status}>{label || baseUrl}</Text>
        <TouchableOpacity onPress={testWsTicketDial} style={styles.button}>
          <Text style={styles.buttonText}>Test WS ticket dial</Text>
        </TouchableOpacity>
        {wsResult ? <Text style={styles.status}>{wsResult}</Text> : null}
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.button}>
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>
        {label || baseUrl} · {provider}
      </Text>

      <Text style={styles.label}>Username</Text>
      <TextInput autoCapitalize="none" onChangeText={setUsername} style={styles.input} value={username} />

      <Text style={styles.label}>Password</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
        value={password}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity disabled={submitting || !username || !password} onPress={submit} style={styles.button}>
        <Text style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    marginBottom: 12,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  container: {
    backgroundColor: '#0b0b0f',
    flexGrow: 1,
    padding: 16
  },
  error: {
    color: '#ff6b6b',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 12
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 6,
    borderWidth: 1,
    color: '#f2f2f5',
    fontFamily: 'monospace',
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  label: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 4,
    marginTop: 4,
    textTransform: 'uppercase'
  },
  status: {
    color: '#3dd68c',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 12
  },
  subtitle: {
    color: '#8a8a99',
    fontSize: 13,
    marginBottom: 16
  },
  title: {
    color: '#f2f2f5',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8
  }
})
