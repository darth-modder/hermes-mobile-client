/**
 * Native wiring for Expo push registration — the counterpart to useNotifications.ts's local
 * notification wiring. Mounted once near the app root (app/_layout.tsx). `expo-notifications`
 * and `expo-constants` are imported dynamically, same reasoning as useNotifications.ts: this
 * hook is pure permission/token/listener plumbing with nothing worth unit-testing directly —
 * the policy it calls into (register.ts, handlers.ts) is what's tested.
 *
 * Presence is reported on every `AppState` transition regardless of whether push is currently
 * "enabled" from the user's toggle — a device with no registration on file is a no-op receiver
 * of a presence POST anyway (server 404s/ignores it), and keeping the two independent avoids a
 * stale "foreground" row surviving a toggle-off/toggle-on cycle.
 */

import Constants from 'expo-constants'
import { useEffect } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'

import { registerPushDevice, reportPushPresence, unregisterPushDevice } from './api'
import { needsReRegistration, pushProjectId, readPushRegistration, writePushRegistration } from './register'
import { RotationListenerController } from './rotation-controller'
import { $pushEnabled } from './settings'

async function ensureRegistered(): Promise<void> {
  const projectId = pushProjectId(Constants.expoConfig?.extra)

  if (!projectId) {
    console.log('[push] disabled: no EAS project id (extra.eas.projectId) — run `eas init` to enable push')

    return
  }

  const Notifications = await import('expo-notifications')

  const { status } = await Notifications.getPermissionsAsync()

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()

    if (requested.status !== 'granted') {
      return
    }
  }

  let token: string

  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  } catch (error) {
    console.warn('[push] getExpoPushTokenAsync failed', error)

    return
  }

  const state = readPushRegistration()

  if (!needsReRegistration(state, token)) {
    return
  }

  // A genuine rotation (not first-time registration): drop the old server-side row before
  // registering the new one — device ids are derived from the token (registry.py), so leaving
  // it would accumulate one stale row per rotation with no GC path.
  if (state.deviceId && state.token && state.token !== token) {
    await unregisterPushDevice(state.deviceId)
  }

  const device = await registerPushDevice(token, Platform.OS, Platform.OS === 'android' ? 'Android' : 'iOS')

  if (device) {
    writePushRegistration({ deviceId: device.id, token })
  }
}

async function ensureUnregistered(): Promise<void> {
  const state = readPushRegistration()

  if (state.deviceId) {
    await unregisterPushDevice(state.deviceId)
  }

  writePushRegistration({ deviceId: null, token: null })
}

export function usePushRegistration(): void {
  // One effect drives both registration and the rotation listener off the SAME live `enabled`
  // state (nanostores' `subscribe` calls its listener immediately with the current value, so
  // this also covers the initial mount — no separate "run once on mount" effect needed).
  // RotationListenerController (rotation-controller.ts, unit-tested) owns whether the listener
  // is currently attached as one explicit piece of state, so toggling push off/on can't leave
  // it attached-but-stale the way two independent effects did (the bug fixed in 8f89171: a
  // rotation firing after opt-out silently re-registered the device).
  useEffect(() => {
    let rotationSubscription: { remove: () => void } | undefined
    let cancelled = false

    const controller = new RotationListenerController({
      attach: () => {
        void (async () => {
          const Notifications = await import('expo-notifications')

          if (cancelled) {
            return
          }

          rotationSubscription = Notifications.addPushTokenListener(() => {
            void ensureRegistered()
          })
        })()
      },
      detach: () => {
        rotationSubscription?.remove()
        rotationSubscription = undefined
      }
    })

    const unsubscribe = $pushEnabled.subscribe(enabled => {
      controller.onEnabledChange(enabled)

      if (enabled) {
        void ensureRegistered()
      } else {
        void ensureUnregistered()
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
      controller.dispose()
    }
  }, [])

  useEffect(() => {
    const reportCurrentPresence = (status: AppStateStatus) => {
      const state = readPushRegistration()

      if (state.deviceId) {
        void reportPushPresence(state.deviceId, status === 'active')
      }
    }

    reportCurrentPresence(AppState.currentState)

    const subscription = AppState.addEventListener('change', reportCurrentPresence)

    return () => {
      subscription.remove()
    }
  }, [])
}
