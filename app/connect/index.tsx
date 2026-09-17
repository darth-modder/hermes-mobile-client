import { useRouter } from 'expo-router'
import { useState } from 'react'
// `Clipboard` from react-native, matching src/chat/Transcript.tsx:6,155 —
// `expo-clipboard` is not a dependency of this project (checked package.json).
import { Clipboard, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { setActiveConnection } from '../../src/connections/registry'
import { setConnectionToken } from '../../src/connections/secure'
import type { MobileConnection } from '../../src/connections/types'
import { UNAFFILIATED_NOTICE } from '../../src/lib/app-identity'
import {
  CONNECT_BACK_TO_STEPS,
  CONNECT_CHECKLIST_COMMANDS,
  CONNECT_COPY_CHECKLIST,
  CONNECT_COPY_CHECKLIST_HINT,
  CONNECT_DETECT_LABEL,
  CONNECT_GUIDE_HINT,
  CONNECT_GUIDE_LINK,
  CONNECT_NEXT_URL,
  CONNECT_NO_AUTH_PROVIDER,
  CONNECT_NOTHING_SENT_YET,
  CONNECT_SCAN_QR,
  CONNECT_STEP_AUTH_DESC,
  CONNECT_STEP_AUTH_TITLE,
  CONNECT_STEP_GATEWAY_DESC,
  CONNECT_STEP_GATEWAY_TITLE,
  CONNECT_STEP_TAILNET_DESC,
  CONNECT_STEP_TAILNET_TITLE,
  CONNECT_STEPS_SUBTITLE,
  CONNECT_STEPS_TITLE,
  CONNECT_TAILSCALE_DESC,
  CONNECT_TAILSCALE_RECOMMENDED,
  CONNECT_TAILSCALE_TITLE,
  CONNECT_THIS_COMPUTER_TITLE,
  CONNECT_URL_DESC,
  CONNECT_URL_HINT_TAILSCALE,
  CONNECT_URL_PLACEHOLDER,
  CONNECT_URL_TITLE,
  CONNECT_USE_COMPUTER_ADDRESS_DESC,
  CONNECT_USE_COMPUTER_ADDRESS_TITLE,
  CONNECTING_DOC_URL,
  CONNECTION_AUTH_MODE_LABEL,
  connectOauthStatus,
  connectPasswordStatus,
  connectRejectedEmulatorHost,
  connectRejectedLoopback,
  connectRejectedUnspecified,
  connectSucceededStatus,
  connectUngatedStatus
} from '../../src/lib/strings.mobile'
import { t } from '../../src/lib/t'
import { nativeLogin, NativeLoginError } from '../../src/net/auth/native-login'
import { probeAuthProviders, probeHealth, probeStatus } from '../../src/net/auth/probe'
import { checkGatewayUrl, type GatewayUrlMode } from '../../src/net/gateway-url-guard'
import { HttpError } from '../../src/net/http'
import { useTheme } from '../../src/theme/provider'
import { radius, type } from '../../src/theme/type'

type DetectedMode = { mode: 'password'; provider: string } | { mode: 'token' } | { mode: 'oauth'; provider?: string }

function newConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Replicates: docs/desktop-prototypes/e-overlays/onboarding.html's
// `#onboarding=remote`/`remote-token` views (the "Connect to existing
// Hermes" form: `install.remoteSetupTitle`/`remoteSetupDesc`, Gateway URL,
// Authentication box, Session token, Test connection / Apply and
// reconnect), plus docs/desktop-prototypes/d-windows/login-window.html for
// the OAuth hand-off itself. NOT the same prototype's provider picker /
// API-key grid — that view chooses a *model provider* for an
// already-connected gateway and its mobile parity is Settings → Providers
// (settings/providers.tsx, already ported); this screen only ever
// establishes the gateway connection. The M14 doc's own overlay-mapping
// table row ("the provider picker and API-key form are the desktop's,
// minus local providers") reads as if it applied here, but onboarding.
// html's own header comment draws the line explicitly ("Provider sign-in is
// at parity [...] the remote form maps to mobile's connection setup") —
// followed that more specific, more authoritative source per the M14 doc's
// own "read the comment block" instruction, flagging the mapping-table
// wording as loose rather than silently rewriting it.
//
// Kept this screen's existing single-screen shape (URL + explicit "Detect"
// button, then inline auth fields) rather than splitting into desktop's
// separate Test-connection/Apply-and-reconnect steps — a compliance sweep,
// not a rebuild; only labels, field order and vendoring changed here. The
// desktop probes as you type and never shows an explicit "detect" action;
// this app needs one, so `CONNECT_DETECT_LABEL` (strings.mobile.ts) has no
// vendored source.
//
// Add a connection: URL + label, auto-detects whether the backend is
// ungated (token mode), gated with a password provider (M04), or gated with
// an OAuth provider such as Nous Portal (M08, via nativeLogin() and a
// Custom Tab).

export default function ConnectScreen() {
  const router = useRouter()
  const tokens = useTheme()
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [detected, setDetected] = useState<DetectedMode | null>(null)
  const [status, setStatus] = useState('')
  // `null` is the `:start` view's two cards; the other two are the entry paths
  // (connect.html `:start` → `:steps` → `:url`, or `:start` → `:url`). Held as
  // one screen's state rather than three routes because the prototype models
  // them as views of one screen and this file's header records the deliberate
  // choice to keep it a single screen.
  const [step, setStep] = useState<'steps' | 'url' | null>(null)
  const [mode, setMode] = useState<GatewayUrlMode>('tailscale')

  const baseUrl = url.trim().replace(/\/+$/, '')

  // Runs on every render, so on every keystroke — the prototype's Behaviour
  // block requires the field to turn destructive as you type rather than on
  // submit ("there is nothing to test").
  const guard = checkGatewayUrl(url, mode)

  const guardError = guard.ok
    ? null
    : guard.rejection === 'emulator-host'
      ? connectRejectedEmulatorHost(guard.host ?? url)
      : guard.rejection === 'unspecified'
        ? connectRejectedUnspecified(guard.host ?? url)
        : connectRejectedLoopback(guard.host ?? url)

  const detect = async () => {
    // Belt and braces: the button is already disabled while the guard is
    // unhappy, but `detect` is the only thing that dials, so it refuses too.
    if (!guard.ok) {
      return
    }

    setDetecting(true)
    setStatus('')
    setDetected(null)

    try {
      const health = await probeHealth(baseUrl)

      if (!health.auth_required) {
        setDetected({ mode: 'token' })
        setStatus(connectUngatedStatus(health.version ?? '?'))

        return
      }

      const providers = await probeAuthProviders(baseUrl)
      const passwordProvider = providers.find(p => p.supports_password)

      if (passwordProvider) {
        setDetected({ mode: 'password', provider: passwordProvider.name })
        setStatus(connectPasswordStatus(passwordProvider.display_name ?? passwordProvider.name))

        return
      }

      const oauthProvider = providers.find(p => !p.supports_password)

      setDetected({ mode: 'oauth', provider: oauthProvider?.name })
      setStatus(
        oauthProvider ? connectOauthStatus(oauthProvider.display_name ?? oauthProvider.name) : CONNECT_NO_AUTH_PROVIDER
      )
    } catch (error) {
      setStatus(`${t.install.probeError} ${error instanceof Error ? error.message : String(error)}`)
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

      setStatus(connectSucceededStatus(statusBody.install_id))
      router.replace({ params: { id: 'new' }, pathname: '/(main)/sessions/[id]' })
    } catch (error) {
      const message =
        error instanceof HttpError
          ? `Token rejected (HTTP ${error.status}).`
          : error instanceof Error
            ? error.message
            : String(error)

      setStatus(`${t.settings.connections.saveFailed}: ${message}`)
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
    setStatus(t.onboarding.startingSignIn(CONNECTION_AUTH_MODE_LABEL.oauth))

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

      setStatus(connectSucceededStatus(statusBody.install_id))
      router.replace({ params: { id: 'new' }, pathname: '/(main)/sessions/[id]' })
    } catch (error) {
      // NativeLoginError's own message already distinguishes cancelled/timed-out/
      // state-mismatch/invalid-code/provider-error/malformed-response — no need
      // to remap it here, same as how PasswordLoginError is handled below.
      const message = error instanceof NativeLoginError || error instanceof Error ? error.message : String(error)

      setStatus(`${t.onboarding.signInFailed} ${message}`)
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
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: tokens.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: tokens.foreground }]}>{t.install.remoteSetupTitle}</Text>
        <Text style={[styles.subtitle, { color: tokens.mutedForeground }]}>{t.install.remoteSetupDesc}</Text>

        {/* connect.html `:start` — two entry cards, the recommended one first
            and carrying the reason, then the host-side guide. */}
        {step === null ? (
          <>
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { color: tokens.foreground }]}>{CONNECT_TAILSCALE_TITLE}</Text>
                <View style={[styles.badge, { backgroundColor: tokens.bgTertiary }]}>
                  <Text style={[styles.badgeText, { color: tokens.textSecondary }]}>
                    {CONNECT_TAILSCALE_RECOMMENDED}
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardDesc, { color: tokens.textSecondary }]}>{CONNECT_TAILSCALE_DESC}</Text>
              <TouchableOpacity
                accessibilityLabel={CONNECT_TAILSCALE_TITLE}
                onPress={() => {
                  setMode('tailscale')
                  setStep('steps')
                }}
                style={[styles.blockButton, { backgroundColor: tokens.primary }]}
              >
                <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>{CONNECT_TAILSCALE_TITLE}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <Text style={[styles.cardTitle, { color: tokens.foreground }]}>{CONNECT_URL_TITLE}</Text>
              <Text style={[styles.cardDesc, { color: tokens.textSecondary }]}>{CONNECT_URL_DESC}</Text>
              <TouchableOpacity
                accessibilityLabel={CONNECT_URL_TITLE}
                onPress={() => {
                  setMode('url')
                  setStep('url')
                }}
                style={[styles.blockButton, { borderColor: tokens.border, borderWidth: 1 }]}
              >
                <Text style={[styles.buttonText, { color: tokens.foreground }]}>{CONNECT_URL_TITLE}</Text>
              </TouchableOpacity>
            </View>

            {/* Task 3's host recipe, linked from the screen that needs it. */}
            <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <Text style={[styles.cardTitle, { color: tokens.foreground }]}>{CONNECT_THIS_COMPUTER_TITLE}</Text>
              <Text style={[styles.cardDesc, { color: tokens.textSecondary }]}>{CONNECT_GUIDE_HINT}</Text>
              <TouchableOpacity
                accessibilityLabel={CONNECT_GUIDE_LINK}
                onPress={() => void Linking.openURL(CONNECTING_DOC_URL)}
                style={[styles.blockButton, { borderColor: tokens.border, borderWidth: 1 }]}
              >
                <Text style={[styles.buttonText, { color: tokens.foreground }]}>{CONNECT_GUIDE_LINK}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* connect.html `:steps` — three steps, then the pasteable checklist. */}
        {step === 'steps' ? (
          <>
            <Text style={[styles.label, { color: tokens.mutedForeground }]}>{CONNECT_STEPS_TITLE}</Text>
            <Text style={[styles.subtitle, { color: tokens.mutedForeground }]}>{CONNECT_STEPS_SUBTITLE}</Text>
            {[
              [CONNECT_STEP_TAILNET_TITLE, CONNECT_STEP_TAILNET_DESC],
              [CONNECT_STEP_GATEWAY_TITLE, CONNECT_STEP_GATEWAY_DESC],
              [CONNECT_STEP_AUTH_TITLE, CONNECT_STEP_AUTH_DESC]
            ].map(([stepTitle, stepDesc]) => (
              <View key={stepTitle} style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
                <Text style={[styles.cardTitle, { color: tokens.foreground }]}>{stepTitle}</Text>
                <Text style={[styles.cardDesc, { color: tokens.textSecondary }]}>{stepDesc}</Text>
              </View>
            ))}

            <Text style={[styles.checklist, { backgroundColor: tokens.bgTertiary, color: tokens.foreground }]}>
              {CONNECT_CHECKLIST_COMMANDS}
            </Text>
            <TouchableOpacity
              accessibilityLabel={CONNECT_COPY_CHECKLIST}
              onPress={() => Clipboard.setString(CONNECT_CHECKLIST_COMMANDS)}
              style={[styles.blockButton, { borderColor: tokens.border, borderWidth: 1 }]}
            >
              <Text style={[styles.buttonText, { color: tokens.foreground }]}>{CONNECT_COPY_CHECKLIST}</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: tokens.textTertiary }]}>{CONNECT_COPY_CHECKLIST_HINT}</Text>

            <TouchableOpacity
              accessibilityLabel={CONNECT_NEXT_URL}
              onPress={() => setStep('url')}
              style={[styles.blockButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>{CONNECT_NEXT_URL}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 'url' ? (
          <>
            <Text style={[styles.label, { color: tokens.mutedForeground }]}>{t.settings.connections.labelTitle}</Text>
            <TextInput
              onChangeText={setLabel}
              placeholder={t.settings.connections.labelPlaceholder}
              placeholderTextColor={tokens.mutedForeground}
              style={[
                styles.input,
                { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
              ]}
              value={label}
            />

            <Text style={[styles.label, { color: tokens.mutedForeground }]}>{t.install.remoteUrlTitle}</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setUrl}
              // Tailnet-shaped. It was `http://127.0.0.1:9119`, which
              // connect.html:17-19 names as the thing to stop suggesting.
              placeholder={CONNECT_URL_PLACEHOLDER}
              placeholderTextColor={tokens.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.input,
                  borderColor: guardError ? tokens.destructive : tokens.border,
                  color: tokens.foreground
                }
              ]}
              value={url}
            />
            {/* "The error IS the guard sentence: rule plus reason, in the field,
            not a toast" (connect.html `:rejected`). */}
            {guardError ? (
              <Text style={[styles.guardError, { color: tokens.destructive }]}>{guardError}</Text>
            ) : (
              <Text style={[styles.hint, { color: tokens.textTertiary }]}>{CONNECT_URL_HINT_TAILSCALE}</Text>
            )}

            <View style={styles.row}>
              <TouchableOpacity
                // Disabled while the guard is unhappy: there is nothing to test.
                disabled={detecting || !guard.ok}
                onPress={detect}
                style={[styles.button, { backgroundColor: tokens.primary, opacity: detecting || !guard.ok ? 0.5 : 1 }]}
              >
                <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>
                  {detecting ? t.install.probing : CONNECT_DETECT_LABEL}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/connect/scan')}
                style={[styles.button, { backgroundColor: tokens.primary }]}
              >
                <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>{CONNECT_SCAN_QR}</Text>
              </TouchableOpacity>
            </View>

            {status ? <Text style={[styles.status, { color: tokens.semantic.green }]}>{status}</Text> : null}
            {guard.ok && !detected ? (
              <Text style={[styles.hint, { color: tokens.textTertiary }]}>{CONNECT_NOTHING_SENT_YET}</Text>
            ) : null}

            {guardError ? (
              <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
                <Text style={[styles.cardTitle, { color: tokens.foreground }]}>
                  {CONNECT_USE_COMPUTER_ADDRESS_TITLE}
                </Text>
                <Text style={[styles.cardDesc, { color: tokens.textSecondary }]}>
                  {CONNECT_USE_COMPUTER_ADDRESS_DESC}
                </Text>
                {mode === 'tailscale' ? (
                  <TouchableOpacity
                    accessibilityLabel={CONNECT_BACK_TO_STEPS}
                    onPress={() => setStep('steps')}
                    style={[styles.blockButton, { borderColor: tokens.border, borderWidth: 1 }]}
                  >
                    <Text style={[styles.buttonText, { color: tokens.foreground }]}>{CONNECT_BACK_TO_STEPS}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {detected?.mode === 'token' ? (
              <>
                <Text style={[styles.label, { color: tokens.mutedForeground }]}>{t.install.tokenTitle}</Text>
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
                    {connecting ? t.settings.gateway.cloudConnecting : t.settings.gateway.cloudConnect}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {detected?.mode === 'password' ? (
              <TouchableOpacity
                onPress={goToPasswordLogin}
                style={[styles.button, { backgroundColor: tokens.primary }]}
              >
                <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>{t.install.signIn}</Text>
              </TouchableOpacity>
            ) : null}

            {detected?.mode === 'oauth' ? (
              <TouchableOpacity
                disabled={connecting}
                onPress={connectOAuth}
                style={[styles.button, { backgroundColor: tokens.primary }]}
              >
                <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>
                  {connecting
                    ? t.settings.gateway.cloudConnecting
                    : t.install.signInWith(CONNECTION_AUTH_MODE_LABEL.oauth)}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        <Text style={[styles.unaffiliatedNotice, { color: tokens.mutedForeground }]}>{UNAFFILIATED_NOTICE}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.control,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  badgeText: {
    ...type.caption,
    fontWeight: '600'
  },
  blockButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14
  },
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
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  cardDesc: {
    ...type.bodySmall,
    marginTop: 4
  },
  cardHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  cardTitle: {
    ...type.body,
    fontWeight: '600'
  },
  checklist: {
    ...type.mono,
    borderRadius: radius.control,
    marginTop: 4,
    padding: 12
  },
  container: {
    flexGrow: 1,
    padding: 16
  },
  guardError: {
    ...type.caption,
    marginBottom: 8,
    marginTop: -4
  },
  hint: {
    ...type.caption,
    marginBottom: 8,
    marginTop: -4
  },
  safeArea: {
    flex: 1
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  status: {
    ...type.mono,
    marginBottom: 12
  },
  subtitle: {
    ...type.bodySmall,
    marginBottom: 16
  },
  title: {
    ...type.title,
    fontWeight: '600',
    marginBottom: 4
  },
  unaffiliatedNotice: {
    ...type.caption,
    marginTop: 24,
    paddingHorizontal: 8,
    textAlign: 'center'
  }
})
