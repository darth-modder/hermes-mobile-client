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

import { pushDataToRoute } from './handlers'
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

      // The permission request itself does NOT happen here. Asking at
      // mount fires before a gateway is even connected, on a screen the
      // user hasn't done anything on yet — see notification-permission.ts's
      // header for where it moved and why. Everything above/below this
      // comment (the channel, the handler, tap-to-open, the cold-start tap
      // check) never prompts, so it stays at mount.

      const openFromResponse = (response: { notification: { request: { content: { data?: unknown } } } }) => {
        const route = pushDataToRoute(response.notification.request.content.data)

        if (route) {
          router.push(route)
        }
      }

      // Cold start: the app process didn't exist when the notification (local or a remote
      // push — M11) was tapped, so there's no `change` event to react to — the tap that
      // launched the app is only visible here, once, on mount.
      const lastResponse = await Notifications.getLastNotificationResponseAsync()

      if (lastResponse) {
        openFromResponse(lastResponse)
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(openFromResponse)
    })()

    return () => {
      responseSubscription?.remove()
    }
  }, [router])
}
