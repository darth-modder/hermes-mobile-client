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
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'

import { registerPushDevice, reportPushPresence, unregisterPushDevice } from './api'
import { needsReRegistration, pushProjectId, readPushRegistration, writePushRegistration } from './register'
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
  const enabled = $pushEnabled.get()
  const enabledRef = useRef(enabled)

  useEffect(() => {
    return $pushEnabled.subscribe(next => {
      enabledRef.current = next

      if (next) {
        void ensureRegistered()
      } else {
        void ensureUnregistered()
      }
    })
  }, [])

  useEffect(() => {
    if (!enabledRef.current) {
      return
    }

    void ensureRegistered()

    let rotationSubscription: { remove: () => void } | undefined

    void (async () => {
      const Notifications = await import('expo-notifications')

      rotationSubscription = Notifications.addPushTokenListener(() => {
        void ensureRegistered()
      })
    })()

    return () => {
      rotationSubscription?.remove()
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
