/**
 * The real `expo-notifications` wiring: permission request, the Android
 * notification channel (required on Android O+ or nothing shows), the
 * foreground presentation handler, and tap-to-open — mirrors
 * `useAppLifecycle.ts`'s split (a framework-free policy module plus one hook
 * that does the actual native wiring, mounted once in `app/_layout.tsx`).
 *
 * `expo-notifications` is imported dynamically so this hook's module graph
 * stays native-module-free until it actually runs on a device — nothing here
 * needs to be unit-testable the way `native-notifications.ts`'s pure policy
 * functions are (there is no framework-free logic to test; it's all
 * permission/channel/listener plumbing).
 */

import { useRouter } from 'expo-router'
import { useEffect } from 'react'

import { ANDROID_NOTIFICATION_CHANNEL_ID } from './native-notifications'

export function useNotifications(): void {
  const router = useRouter()

  useEffect(() => {
    let responseSubscription: { remove: () => void } | undefined

    void (async () => {
      const Notifications = await import('expo-notifications')

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false
        })
      })

      await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
        name: 'Hermes',
        importance: Notifications.AndroidImportance.DEFAULT
      })

      const { status } = await Notifications.getPermissionsAsync()

      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync()
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        const storedSessionId = response.notification.request.content.data?.storedSessionId

        if (typeof storedSessionId === 'string' && storedSessionId) {
          router.push({ params: { id: storedSessionId }, pathname: '/(main)/sessions/[id]' })
        }
      })
    })()

    return () => {
      responseSubscription?.remove()
    }
  }, [router])
}
