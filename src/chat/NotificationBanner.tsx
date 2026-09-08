import { useStore } from '@nanostores/react'
import { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'

import { $notifications, dismissNotification, type NotifyEffect } from '../store/notifications'

const KIND_STYLE: Record<NotifyEffect['kind'], { background: string; border: string }> = {
  error: { background: '#2a1418', border: '#e06c75' },
  info: { background: '#14181c', border: '#1f6feb' },
  warning: { background: '#241c10', border: '#d19a66' }
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

  const style = KIND_STYLE[latest.kind]

  return (
    <TouchableOpacity
      onPress={() => dismissNotification(latest.id)}
      style={[styles.container, { backgroundColor: style.background, borderColor: style.border }]}
    >
      <Text style={styles.title}>{latest.title}</Text>
      <Text numberOfLines={3} style={styles.message}>
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
    color: '#c9d1d9',
    fontSize: 12,
    marginTop: 2
  },
  title: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700'
  }
})
