import { useStore } from '@nanostores/react'
import { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'

import { $notifications, dismissNotification, type NotifyEffect } from '../store/notifications'
import { type MobileTokens, useTheme } from '../theme/provider'

function borderForKind(tokens: MobileTokens, kind: NotifyEffect['kind']): string {
  switch (kind) {
    case 'error':
      return tokens.destructive

    case 'warning':
      return tokens.semantic.orange

    case 'info':

    default:
      return tokens.primary
  }
}

const DEFAULT_DURATION_MS = 5000

/**
 * Renders the reducer's `notify` effect (src/store/notifications.ts) —
 * before this component existed, `notify()` had a writer (session-connection.ts,
 * Composer.tsx, SessionHeader.tsx) but no reader, so every error toast
 * (a failed send, a failed attachment upload, ...) fired into an atom
 * nothing subscribed to and the user never saw it. Found live, on-device,
 * this round: an attachment upload failed silently with zero visible
 * feedback — the exact class of bug this component closes.
 */
export function NotificationBanner() {
  const tokens = useTheme()
  const notifications = useStore($notifications)
  const latest = notifications[notifications.length - 1]

  useEffect(() => {
    if (!latest) {
      return
    }

    const timer = setTimeout(() => dismissNotification(latest.id), latest.durationMs ?? DEFAULT_DURATION_MS)

    return () => clearTimeout(timer)
  }, [latest])

  if (!latest) {
    return null
  }

  return (
    <TouchableOpacity
      onPress={() => dismissNotification(latest.id)}
      style={[
        styles.container,
        { backgroundColor: tokens.widgetSurface, borderColor: borderForKind(tokens, latest.kind) }
      ]}
    >
      <Text style={[styles.title, { color: tokens.foreground }]}>{latest.title}</Text>
      <Text numberOfLines={3} style={[styles.message, { color: tokens.mutedForeground }]}>
        {latest.message}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    marginHorizontal: 10,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  message: {
    fontSize: 12,
    marginTop: 2
  },
  title: {
    fontSize: 13,
    fontWeight: '700'
  }
})
