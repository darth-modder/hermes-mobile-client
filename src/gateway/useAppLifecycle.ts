import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { AppLifecycle } from './lifecycle'
import { closeGatewayConnection, reconnectAndProbeGateway } from './session-connection'

function toLifecycleStatus(status: AppStateStatus): 'active' | 'background' | 'inactive' {
  return status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : 'background'
}

/**
 * Mounted once near the app root (app/_layout.tsx). `AppLifecycle` itself is
 * framework-free (src/gateway/lifecycle.ts) and unit-tested there — this
 * hook is just the `AppState` wiring: real listener in, real
 * close/reconnect-and-probe callbacks out.
 *
 * `expo-network` connectivity-change wiring (the other half of M07's
 * "network switch" survival) is not in this hook yet — see
 * M07-sessions-and-lifecycle.md's Deviations for why.
 */
export function useAppLifecycle(): void {
  const lifecycleRef = useRef<AppLifecycle | null>(null)

  useEffect(() => {
    const lifecycle = new AppLifecycle({
      closeConnection: closeGatewayConnection,
      reconnectAndProbe: reconnectAndProbeGateway
    })

    lifecycleRef.current = lifecycle

    const subscription = AppState.addEventListener('change', status => {
      lifecycle.handleAppStateChange(toLifecycleStatus(status))
    })

    return () => {
      subscription.remove()
      lifecycle.dispose()
      lifecycleRef.current = null
    }
  }, [])
}
