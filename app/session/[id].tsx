import { Redirect, useLocalSearchParams } from 'expo-router'

/**
 * Deep-link target: `hermes-android://session/<id>` (M07 task line). Just a
 * redirect — expo-router maps a scheme link straight to the file path that
 * matches its host+pathname (`session/<id>` here), and the real chat screen
 * already lives at `/(main)/sessions/[id]`. A tapped approval notification
 * (M07's other deep-link consumer) opens the same way.
 */
export default function SessionDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <Redirect href={{ params: { id }, pathname: '/(main)/sessions/[id]' }} />
}
