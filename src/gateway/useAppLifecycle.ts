import * as Network from 'expo-network'
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { AppLifecycle, type NetworkLifecycleState } from './lifecycle'
import { closeGatewayConnection, reconnectAndProbeGateway } from './session-connection'

function toLifecycleStatus(status: AppStateStatus): 'active' | 'background' | 'inactive' {
  return status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : 'background'
}

/** M07 task line: "if closed, reset backoff and redial; if open, ping probe."
 *  `isInternetReachable` is undefined until the first native event lands, so
 *  an unknown state is treated as `open` rather than firing a spurious
 *  reconnect before the module has reported anything. */
function toNetworkLifecycleState(state: Network.NetworkState): NetworkLifecycleState {
  return state.isConnected && state.isInternetReachable !== false ? 'open' : 'closed'
}

/**
 * Mounted once near the app root (app/_layout.tsx). `AppLifecycle` itself is
 * framework-free (src/gateway/lifecycle.ts) and unit-tested there — this
 * hook is just the real wiring: `AppState` for background/foreground,
 * `expo-network` for connectivity changes, real close/reconnect-and-probe
 * callbacks out.
 */
export function useAppLifecycle(): void {
  const lifecycleRef = useRef<AppLifecycle | null>(null)

  useEffect(() => {
    const lifecycle = new AppLifecycle({
      closeConnection: closeGatewayConnection,
      reconnectAndProbe: reconnectAndProbeGateway
    })

    lifecycleRef.current = lifecycle

    const appStateSubscription = AppState.addEventListener('change', status => {
      lifecycle.handleAppStateChange(toLifecycleStatus(status))
    })

    let previousNetworkState: NetworkLifecycleState = 'open'

    const networkSubscription = Network.addNetworkStateListener(state => {
      const next = toNetworkLifecycleState(state)

      lifecycle.handleNetworkChange(next, previousNetworkState)
      previousNetworkState = next
    })

    return () => {
      appStateSubscription.remove()
      networkSubscription.remove()
      lifecycle.dispose()
      lifecycleRef.current = null
    }
  }, [])
}
