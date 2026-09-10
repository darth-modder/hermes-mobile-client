import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { setActiveConnection } from '../../../src/connections/registry'
import type { MobileConnection } from '../../../src/connections/types'
import { buildGatewayWsUrl, createGatewaySocketFactory } from '../../../src/gateway/dial'
import { mintWsTicket, passwordLogin, PasswordLoginError } from '../../../src/net/auth/password-login'
import { probeStatus } from '../../../src/net/auth/probe'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

/**
 * Password sign-in for a gated backend (M04). `id`/`baseUrl`/`label`/
 * `provider` come from app/connect/index.tsx's auto-detect step. On success
 * this becomes the active connection; the session lives in cookies (RN's
 * fetch cookie jar, `credentials: 'include'`) — no token is stored for
 * password mode.
 */
export default function PasswordLoginScreen() {
  const router = useRouter()
  const tokens = useTheme()

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
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
        <Text style={[styles.title, { color: tokens.foreground }]}>Connected</Text>
        <Text style={[styles.status, { color: tokens.semantic.green }]}>{label || baseUrl}</Text>
        <TouchableOpacity onPress={testWsTicketDial} style={[styles.button, { backgroundColor: tokens.primary }]}>
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Test WS ticket dial</Text>
        </TouchableOpacity>
        {wsResult ? <Text style={[styles.status, { color: tokens.semantic.green }]}>{wsResult}</Text> : null}
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={[styles.button, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: tokens.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: tokens.foreground }]}>Sign in</Text>
        <Text style={[styles.subtitle, { color: tokens.mutedForeground }]}>
          {label || baseUrl} · {provider}
        </Text>

        <Text style={[styles.label, { color: tokens.mutedForeground }]}>Username</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setUsername}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={username}
        />

        <Text style={[styles.label, { color: tokens.mutedForeground }]}>Password</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setPassword}
          secureTextEntry
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={password}
        />

        {error ? <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text> : null}

        <TouchableOpacity
          disabled={submitting || !username || !password}
          onPress={submit}
          style={[styles.button, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 6,
    justifyContent: 'center',
    marginBottom: 12,
    marginRight: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  container: {
    flexGrow: 1,
    padding: 16
  },
  safeArea: {
    flex: 1
  },
  error: {
    ...type.mono,
    marginBottom: 12
  },
  input: {
    borderRadius: 6,
    borderWidth: 1,
    ...type.mono,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  label: {
    ...type.caption,
    marginBottom: 4,
    marginTop: 4,
    textTransform: 'uppercase'
  },
  status: {
    ...type.mono,
    marginBottom: 12
  },
  subtitle: {
    ...type.label,
    marginBottom: 16
  },
  title: {
    ...type.title,
    fontWeight: '600',
    marginBottom: 8
  }
})
