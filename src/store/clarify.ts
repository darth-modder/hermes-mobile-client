// Holds the live `setClarify` effect the reducer emits (src/gateway/
// session-stream/input-requests.ts), keyed by stored session id — the inline
// clarify card reads the active session's entry.

import { atom } from 'nanostores'

import type { ClarifyRequest } from '../gateway/session-stream-reducer'

export const $clarifyRequests = atom<Record<string, ClarifyRequest>>({})

export function setClarifyRequest(storedSessionId: string, request: ClarifyRequest | null): void {
  const current = $clarifyRequests.get()

  if (request === null) {
    if (!(storedSessionId in current)) {
      return
    }

    const next = { ...current }

    delete next[storedSessionId]
    $clarifyRequests.set(next)

    return
  }

  $clarifyRequests.set({ ...current, [storedSessionId]: request })
}
