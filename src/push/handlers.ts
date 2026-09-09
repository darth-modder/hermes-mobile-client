/**
 * Turns a notification's `data` payload into a route — shared by the warm-app tap listener
 * and a cold-start launch (`getLastNotificationResponseAsync`), which both hand back the
 * same `{ data }` shape (useNotifications.ts). Covers both a remote push
 * (`{ kind, session_id }` — server-plugin/hermes-push's publisher.py) and the existing local
 * notification shape (`{ storedSessionId }` — native-notifications.ts): pushed through to the
 * route param as-is, no runtime-to-stored translation, matching
 * native-notifications.ts's own documented convention that an unbound runtime id is its own
 * stored id.
 */

export interface PushRoute {
  params: { id: string }
  pathname: '/(main)/sessions/[id]'
}

export function pushDataToRoute(data: unknown): null | PushRoute {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const sessionId = record.session_id ?? record.storedSessionId

  if (typeof sessionId !== 'string' || !sessionId) {
    return null
  }

  return { params: { id: sessionId }, pathname: '/(main)/sessions/[id]' }
}
