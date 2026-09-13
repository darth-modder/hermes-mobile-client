import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { getGatewayConnectionState, onGatewayConnectionState } from '../gateway/session-connection'
import { t } from '../lib/t'
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
 * Copy is vendored from `boot.*` (GatewayConnectingOverlay's own sibling
 * strings in en.ts — the desktop's boot-lifecycle namespace, not
 * gateway-connecting.html's page copy, which is only the animated word
 * "CONNECTING" with no vendored string of its own to reuse for a banner
 * shape): `boot.steps.retryingRemoteBackend` while retrying,
 * `boot.errors.gatewayConnectionLost`/`gatewayConnectionLostDetail` once a
 * retry has failed and backoff is pending.
 */
export function ConnectionBanner() {
  const tokens = useTheme()
  const [state, setState] = useState(getGatewayConnectionState)

  useEffect(() => onGatewayConnectionState(setState), [])

  if (state === 'idle' || state === 'open') {
    return null
  }

  const reconnecting = state === 'connecting'

  return (
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.semantic.orange }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>
        {reconnecting ? t.boot.steps.retryingRemoteBackend : t.boot.errors.gatewayConnectionLost}
      </Text>
      {reconnecting ? null : (
        <Text style={[styles.message, { color: tokens.mutedForeground }]}>
          {t.boot.errors.gatewayConnectionLostDetail}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
