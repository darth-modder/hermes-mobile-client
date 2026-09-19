// D23 point 1: one shared piece derives the "Sign in" action from
// `needsLogin`, so the gateway card, Sessions, Bots, Tasks, New session and
// the session screen's own failure card cannot disagree about where it goes
// or when it shows. Pure and tested — every surface below just calls
// `router.push(signInRoute(connection))` from behind `needsSignIn(connection)`.

import type { MobileConnection } from './types'

export interface SignInRoute {
  pathname: '/connect/[id]/login'
  params: { id: string; baseUrl: string; label: string; provider?: string }
}

/** Matches exactly what `app/connect/[id]/login.tsx` reads via
 *  `useLocalSearchParams`. */
export function signInRoute(connection: Pick<MobileConnection, 'id' | 'baseUrl' | 'label' | 'provider'>): SignInRoute {
  return {
    params: { baseUrl: connection.baseUrl, id: connection.id, label: connection.label, provider: connection.provider },
    pathname: '/connect/[id]/login'
  }
}

export function needsSignIn(connection: Pick<MobileConnection, 'needsLogin'> | null | undefined): boolean {
  return Boolean(connection?.needsLogin)
}
