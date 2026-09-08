import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { setActiveConnection } from '../../src/connections/registry'
import { setConnectionToken } from '../../src/connections/secure'
import type { MobileConnection } from '../../src/connections/types'
import { probeAuthProviders, probeHealth, probeStatus } from '../../src/net/auth/probe'
import { HttpError } from '../../src/net/http'

type DetectedMode = { mode: 'password'; provider: string } | { mode: 'token' } | { mode: 'oauth' }

function newConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Add a connection: URL + label, auto-detects whether the backend is
 * ungated (token mode) or gated with a password provider (M04) — OAuth-gated
 * backends (M08) are detected but not yet completable here.
 */
export default function ConnectScreen() {
  const router = useRouter()
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

      setDetected({ mode: 'oauth' })
      setStatus('Gated backend with no password provider — Nous Portal sign-in is not yet supported here.')
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add a connection</Text>

      <Text style={styles.label}>Label (optional)</Text>
      <TextInput
        onChangeText={setLabel}
        placeholder="My server"
        placeholderTextColor="#5a5a66"
        style={styles.input}
        value={label}
      />

      <Text style={styles.label}>Backend URL</Text>
      <TextInput autoCapitalize="none" onChangeText={setUrl} style={styles.input} value={url} />

      <View style={styles.row}>
        <TouchableOpacity disabled={detecting} onPress={detect} style={styles.button}>
          <Text style={styles.buttonText}>{detecting ? 'Checking…' : 'Detect auth mode'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/connect/scan')} style={styles.button}>
          <Text style={styles.buttonText}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      {detected?.mode === 'token' ? (
        <>
          <Text style={styles.label}>Session token</Text>
          <TextInput autoCapitalize="none" onChangeText={setToken} secureTextEntry style={styles.input} value={token} />
          <TouchableOpacity disabled={connecting || !token} onPress={connectToken} style={styles.button}>
            <Text style={styles.buttonText}>{connecting ? 'Connecting…' : 'Connect'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {detected?.mode === 'password' ? (
        <TouchableOpacity onPress={goToPasswordLogin} style={styles.button}>
          <Text style={styles.buttonText}>Sign in</Text>
        </TouchableOpacity>
      ) : null}
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  status: {
    color: '#3dd68c',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 12
  },
  title: {
    color: '#f2f2f5',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16
  }
})
