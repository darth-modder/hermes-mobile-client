import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { setActiveConnection } from '../../src/connections/registry'
import { setConnectionToken } from '../../src/connections/secure'
import type { MobileConnection } from '../../src/connections/types'
import { nativeLogin, NativeLoginError } from '../../src/net/auth/native-login'
import { probeAuthProviders, probeHealth, probeStatus } from '../../src/net/auth/probe'
import { HttpError } from '../../src/net/http'
import { useTheme } from '../../src/theme/provider'
import { type } from '../../src/theme/type'

type DetectedMode = { mode: 'password'; provider: string } | { mode: 'token' } | { mode: 'oauth'; provider?: string }

function newConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Add a connection: URL + label, auto-detects whether the backend is
 * ungated (token mode), gated with a password provider (M04), or gated with
 * an OAuth provider such as Nous Portal (M08, via nativeLogin() and a
 * Custom Tab).
 */
export default function ConnectScreen() {
  const router = useRouter()
  const tokens = useTheme()
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('http://127.0.0.1:9119')
  const [token, setToken] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [detected, setDetected] = useState<DetectedMode | null>(null)
  const [status, setStatus] = useState('')

  const baseUrl = url.trim().replace(/\/+$/, '')

  const detect = async () => {
    setDetecting(true)
    setStatus('')
    setDetected(null)

    try {
      const health = await probeHealth(baseUrl)

      if (!health.auth_required) {
        setDetected({ mode: 'token' })
        setStatus(`Ungated backend (version ${health.version ?? '?'}) — token mode.`)

        return
      }

      const providers = await probeAuthProviders(baseUrl)
      const passwordProvider = providers.find(p => p.supports_password)

      if (passwordProvider) {
        setDetected({ mode: 'password', provider: passwordProvider.name })
        setStatus(`Gated backend — password sign-in via "${passwordProvider.display_name ?? passwordProvider.name}".`)

        return
      }

      const oauthProvider = providers.find(p => !p.supports_password)

      setDetected({ mode: 'oauth', provider: oauthProvider?.name })
      setStatus(
        oauthProvider
          ? `Gated backend — sign in with ${oauthProvider.display_name ?? oauthProvider.name}.`
          : 'Gated backend with no registered auth provider — cannot sign in yet.'
      )
    } catch (error) {
      setStatus(`Could not reach ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setDetecting(false)
    }
  }

  const connectToken = async () => {
    setConnecting(true)
    setStatus('')

    const id = newConnectionId()

    try {
      const connection: MobileConnection = {
        id,
        kind: 'remote',
        label: label.trim() || baseUrl,
        baseUrl,
        authMode: 'token'
      }

      // Verify the token actually works before saving it as the active
      // connection — a wrong token should fail loudly here, not silently at
      // the next screen.
      const statusBody = await probeStatus(baseUrl, { token })

      await setConnectionToken(id, token)
      setActiveConnection({
        ...connection,
        installId: typeof statusBody.install_id === 'string' ? statusBody.install_id : undefined,
        lastUsedAt: Date.now()
      })

      setStatus(`Connected — install_id=${statusBody.install_id ?? '(none)'}`)
      router.replace({ params: { id: 'new' }, pathname: '/(main)/sessions/[id]' })
    } catch (error) {
      const message =
        error instanceof HttpError
          ? `Token rejected (HTTP ${error.status}).`
          : error instanceof Error
            ? error.message
            : String(error)

      setStatus(`Connect failed: ${message}`)
    } finally {
      setConnecting(false)
    }
  }

  /**
   * OAuth sign-in (M08): opens a Custom Tab via nativeLogin() straight from
   * this screen — unlike password mode there's no form to fill first, so
   * this doesn't route to a child screen the way goToPasswordLogin() does.
   * Mirrors connectToken()'s persist-then-navigate shape: nativeLogin()
   * itself already writes the bearer payload to SecureStore
   * (setConnectionOAuth), this just records the connection metadata and
   * verifies the fresh access token actually works before entering the app.
   */
  const connectOAuth = async () => {
    if (detected?.mode !== 'oauth') {
      return
    }

    setConnecting(true)
    setStatus('Opening sign-in…')

    const id = newConnectionId()

    try {
      const result = await nativeLogin(id, baseUrl, { provider: detected.provider })

      const connection: MobileConnection = {
        id,
        kind: 'remote',
        label: label.trim() || baseUrl,
        baseUrl,
        authMode: 'oauth',
        provider: result.provider || detected.provider
      }

      const statusBody = await probeStatus(baseUrl, { token: result.accessToken })

      setActiveConnection({
        ...connection,
        installId: typeof statusBody.install_id === 'string' ? statusBody.install_id : undefined,
        lastUsedAt: Date.now()
      })

      setStatus(`Connected — install_id=${statusBody.install_id ?? '(none)'}`)
      router.replace({ params: { id: 'new' }, pathname: '/(main)/sessions/[id]' })
    } catch (error) {
      // NativeLoginError's own message already distinguishes cancelled/timed-out/
      // state-mismatch/invalid-code/provider-error/malformed-response — no need
      // to remap it here, same as how PasswordLoginError is handled below.
      const message = error instanceof NativeLoginError || error instanceof Error ? error.message : String(error)

      setStatus(`Sign-in failed: ${message}`)
    } finally {
      setConnecting(false)
    }
  }

  const goToPasswordLogin = () => {
    if (detected?.mode !== 'password') {
      return
    }

    const id = newConnectionId()

    router.push({
      pathname: '/connect/[id]/login',
      params: { id, baseUrl, label: label.trim() || baseUrl, provider: detected.provider }
    })
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: tokens.background }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>Add a connection</Text>

      <Text style={[styles.label, { color: tokens.mutedForeground }]}>Label (optional)</Text>
      <TextInput
        onChangeText={setLabel}
        placeholder="My server"
        placeholderTextColor={tokens.mutedForeground}
        style={[styles.input, { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }]}
        value={label}
      />

      <Text style={[styles.label, { color: tokens.mutedForeground }]}>Backend URL</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setUrl}
        style={[styles.input, { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }]}
        value={url}
      />

      <View style={styles.row}>
        <TouchableOpacity
          disabled={detecting}
          onPress={detect}
          style={[styles.button, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>
            {detecting ? 'Checking…' : 'Detect auth mode'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/connect/scan')}
          style={[styles.button, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {status ? <Text style={[styles.status, { color: tokens.semantic.green }]}>{status}</Text> : null}

      {detected?.mode === 'token' ? (
        <>
          <Text style={[styles.label, { color: tokens.mutedForeground }]}>Session token</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setToken}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
            ]}
            value={token}
          />
          <TouchableOpacity
            disabled={connecting || !token}
            onPress={connectToken}
            style={[styles.button, { backgroundColor: tokens.primary }]}
          >
            <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {detected?.mode === 'password' ? (
        <TouchableOpacity onPress={goToPasswordLogin} style={[styles.button, { backgroundColor: tokens.primary }]}>
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Sign in</Text>
        </TouchableOpacity>
      ) : null}

      {detected?.mode === 'oauth' ? (
        <TouchableOpacity
          disabled={connecting}
          onPress={connectOAuth}
          style={[styles.button, { backgroundColor: tokens.primary }]}
        >
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>
            {connecting ? 'Signing in…' : 'Sign in with Portal'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    marginBottom: 12,
    marginRight: 8,
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  status: {
    ...type.mono,
    marginBottom: 12
  },
  title: {
    ...type.title,
    fontWeight: '600',
    marginBottom: 16
  }
})
