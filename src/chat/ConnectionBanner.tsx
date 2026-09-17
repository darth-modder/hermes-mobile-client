import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  getConnectionAttention,
  getGatewayConnectionState,
  onConnectionAttention,
  onGatewayConnectionState,
  reconnectAndProbeGateway
} from '../gateway/session-connection'
import {
  BANNER_NEEDS_ATTENTION_TITLE,
  BANNER_NEEDS_LOGIN_DETAIL,
  BANNER_SIGN_IN_AGAIN,
  BANNER_SYNC_NOW
} from '../lib/strings.mobile'
import { t } from '../lib/t'
import { describeConnectReason } from '../net/connect-reason'
import { useTheme } from '../theme/provider'
import { radius, type } from '../theme/type'

/**
 * Replicates: docs/desktop-prototypes/e-overlays/gateway-connecting.html.
 * Its own header comment draws the mobile line explicitly: the full-screen
 * decode-text "CONNECTING" boot mask is "Absent by design ... the phone
 * never boots a backend"; only "reconnect/replay state itself is at parity
 * (Sessions, M07)" — the reconnect mechanism (session-connection.ts's
 * WS-close handling, `reconnectBackoffDelayMs`) is already real, M14's job
 * is only to surface it. Before this component, `onGatewayConnectionState`
 * (session-connection.ts) had a publisher but no subscriber anywhere in the
 * app: a socket dropped and reconnected mid-session with zero visible
 * feedback — the same class of gap `NotificationBanner` closed for
 * transient toast-shaped effects (its own header: "a writer ... but no
 * reader"). This is the persistent "connection banner" half of the M14
 * mapping row only; the full-screen variant is the half the prototype
 * itself marks absent, not built here.
 *
 * **M15 D extends this component; it does not add a second one.** What it
 * already did before this round: subscribe to `onGatewayConnectionState`,
 * render nothing for `idle`/`open`, and otherwise show one of two vendored
 * lines - retrying vs lost - with no cause and no action. The whole file was
 * 77 lines and contained no `Pressable` at all.
 *
 * Three things are new:
 *  1. **The cause.** `onConnectionAttention` (session-connection.ts) carries
 *     M04's classified reason, which until now was only ever *thrown* -
 *     `describeConnectReason(reason)` reached whichever call site happened to
 *     be in flight and nowhere else, which is why this banner could only say
 *     "connection lost" without saying why.
 *  2. **A recovering action.** "Sync now" redials and re-probes through
 *     `reconnectAndProbeGateway()` (the same function that invalidates a
 *     half-open socket), then asks the owning screen to re-resume. A 401
 *     offers "Sign in again" instead, because a redial cannot fix an expired
 *     credential - connect.html:24-27 marks exactly that a `Field:`.
 *  3. **One persistent state, not a toast** (connect.html Behaviour block).
 *
 * `onResume`/`onSignIn` are injected so the screen owning the session decides
 * what re-resuming means; the chat screen passes a resume carrying its bot
 * profile, which is M15 Deviation 5.
 *
 * Copy is vendored from `boot.*` (GatewayConnectingOverlay's own sibling
 * strings in en.ts — the desktop's boot-lifecycle namespace, not
 * gateway-connecting.html's page copy, which is only the animated word
 * "CONNECTING" with no vendored string of its own to reuse for a banner
 * shape): `boot.steps.retryingRemoteBackend` while retrying,
 * `boot.errors.gatewayConnectionLost`/`gatewayConnectionLostDetail` once a
 * retry has failed and backoff is pending.
 */
export interface ConnectionBannerProps {
  /** Runs after a successful redial - the owning screen's chance to re-resume
   *  its session with whatever context it holds (the chat screen's bot
   *  profile, M15 Deviation 5). */
  onResume?: () => Promise<void> | void
  /** Where "Sign in again" goes. Absent on screens with nowhere to send it,
   *  in which case the 401 state shows its reason without an action rather
   *  than a button that does nothing. */
  onSignIn?: () => void
}

export function ConnectionBanner({ onResume, onSignIn }: ConnectionBannerProps = {}) {
  const tokens = useTheme()
  const [state, setState] = useState(getGatewayConnectionState)
  const [attention, setAttention] = useState(getConnectionAttention)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => onGatewayConnectionState(setState), [])
  useEffect(() => onConnectionAttention(setAttention), [])

  const needsLogin = attention?.kind === 'needs-login'

  // A live socket with nothing outstanding is the one case with nothing to
  // say. `needsLogin` is checked first because it must outlive a socket that
  // is technically idle.
  if (!needsLogin && (state === 'idle' || state === 'open')) {
    return null
  }

  const reconnecting = state === 'connecting' && !needsLogin

  const syncNow = async () => {
    setSyncing(true)

    try {
      await reconnectAndProbeGateway()
      await onResume?.()
    } finally {
      setSyncing(false)
    }
  }

  const detail = needsLogin
    ? BANNER_NEEDS_LOGIN_DETAIL
    : attention?.kind === 'unreachable'
      ? describeConnectReason(attention.reason)
      : t.boot.errors.gatewayConnectionLostDetail

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.widgetSurface,
          borderColor: needsLogin ? tokens.destructive : tokens.semantic.orange
        }
      ]}
    >
      <Text style={[styles.title, { color: tokens.foreground }]}>
        {reconnecting ? t.boot.steps.retryingRemoteBackend : BANNER_NEEDS_ATTENTION_TITLE}
      </Text>
      {reconnecting ? null : <Text style={[styles.message, { color: tokens.mutedForeground }]}>{detail}</Text>}

      {reconnecting ? null : (
        <View style={styles.actions}>
          {needsLogin && onSignIn ? (
            <Pressable
              accessibilityLabel={BANNER_SIGN_IN_AGAIN}
              accessibilityRole="button"
              onPress={onSignIn}
              style={[styles.action, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.actionText, { color: tokens.primaryForeground }]}>{BANNER_SIGN_IN_AGAIN}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={BANNER_SYNC_NOW}
            accessibilityRole="button"
            disabled={syncing}
            onPress={() => void syncNow()}
            style={[styles.action, { borderColor: tokens.border, borderWidth: 1 }]}
          >
            {syncing ? (
              <ActivityIndicator color={tokens.mutedForeground} size="small" />
            ) : (
              <Text style={[styles.actionText, { color: tokens.foreground }]}>{BANNER_SYNC_NOW}</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16
  },
  actionText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 4,
    marginHorizontal: 10,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  message: {
    ...type.caption,
    marginTop: 2
  },
  title: {
    ...type.label,
    fontWeight: '700'
  }
})
