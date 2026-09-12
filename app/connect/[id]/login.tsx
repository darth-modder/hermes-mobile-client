import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { setActiveConnection } from '../../../src/connections/registry'
import type { MobileConnection } from '../../../src/connections/types'
import { buildGatewayWsUrl, createGatewaySocketFactory } from '../../../src/gateway/dial'
import {
  CONNECT_MINTING_TICKET,
  CONNECT_PASSWORD_LABEL,
  CONNECT_SIGNING_IN,
  CONNECT_TEST_WS_TICKET_DIAL,
  CONNECT_USERNAME_LABEL,
  CONNECT_WS_ERROR
} from '../../../src/lib/strings.mobile'
import { t } from '../../../src/lib/t'
import { mintWsTicket, passwordLogin, PasswordLoginError } from '../../../src/net/auth/password-login'
import { probeStatus } from '../../../src/net/auth/probe'
import { useTheme } from '../../../src/theme/provider'
import { radius, type } from '../../../src/theme/type'

// Replicates: no desktop counterpart — docs/desktop-prototypes/d-windows/
// login-window.html documents only the OAuth and Hermes Cloud portal
// windows (its own header: "NOTHING inside the window is Hermes UI"; the
// mock pages are generic external-IdP stand-ins), and neither it nor
// docs/DESKTOP-SCREENS.md nor en.ts names a username/password sign-in form
// at all. A gated-by-username-and-password backend (M04) is real on this
// app but has no desktop screen to replicate; Username/Password field
// labels and "Signing in…" are named in strings.mobile.ts's "app/connect"
// section for exactly that reason. "Sign in" (title/button) and "Connected"
// do have vendored matches (`t.install.signIn`, `t.settings.gateway.
// cloudConnectedTitle`) and are used below.
//
// The "Test WS ticket dial" control below (post-login) has no desktop
// counterpart either and isn't part of any replicated flow — it's an M04/
// M08 connectivity self-check left in deliberately for on-device
// verification of the WS ticket handshake, not a dead control masquerading
// as a real one (it does something real when pressed). Flagging rather than
// removing it: a labels sweep isn't the place to decide whether a
// diagnostic tool stays in the shipped screen.
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

    setWsResult(CONNECT_MINTING_TICKET)

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
        socket.addEventListener('error', () => reject(new Error(CONNECT_WS_ERROR)), { once: true })
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
        <Text style={[styles.title, { color: tokens.foreground }]}>{t.settings.gateway.cloudConnectedTitle}</Text>
        <Text style={[styles.status, { color: tokens.semantic.green }]}>{label || baseUrl}</Text>
        <TouchableOpacity onPress={testWsTicketDial} style={[styles.button, { backgroundColor: tokens.primary }]}>
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>{CONNECT_TEST_WS_TICKET_DIAL}</Text>
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
        <Text style={[styles.title, { color: tokens.foreground }]}>{t.install.signIn}</Text>
        <Text style={[styles.subtitle, { color: tokens.mutedForeground }]}>
          {label || baseUrl} · {provider}
        </Text>

        <Text style={[styles.label, { color: tokens.mutedForeground }]}>{CONNECT_USERNAME_LABEL}</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setUsername}
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={username}
        />

        <Text style={[styles.label, { color: tokens.mutedForeground }]}>{CONNECT_PASSWORD_LABEL}</Text>
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
            {submitting ? CONNECT_SIGNING_IN : t.install.signIn}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.control,
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
    borderRadius: radius.control,
    borderWidth: 1,
    ...type.mono,
    marginBottom: 12,
    minHeight: 48,
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
