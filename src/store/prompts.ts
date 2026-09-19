// Holds the live `setApproval` / `setSudo` / `setSecret` effects the reducer
// emits (src/gateway/session-stream/input-requests.ts), each keyed by stored
// session id — a background session can raise one and wait for the user to
// switch over.

import { atom } from 'nanostores'

import type { ApprovalRequest, SecretRequest, SudoRequest } from '../gateway/session-stream-reducer'

export const $approvalRequests = atom<Record<string, ApprovalRequest>>({})
export const $sudoRequests = atom<Record<string, SudoRequest>>({})
export const $secretRequests = atom<Record<string, SecretRequest>>({})

export function setApprovalRequest(storedSessionId: null | string, request: ApprovalRequest | null): void {
  if (!storedSessionId) {
    return
  }

  const current = $approvalRequests.get()

  if (request === null) {
    if (!(storedSessionId in current)) {
      return
    }

    const next = { ...current }

    delete next[storedSessionId]
    $approvalRequests.set(next)

    return
  }

  $approvalRequests.set({ ...current, [storedSessionId]: request })
}

export function setSudoRequest(storedSessionId: null | string, request: SudoRequest | null): void {
  if (!storedSessionId) {
    return
  }

  const current = $sudoRequests.get()

  if (request === null) {
    if (!(storedSessionId in current)) {
      return
    }

    const next = { ...current }

    delete next[storedSessionId]
    $sudoRequests.set(next)

    return
  }

  $sudoRequests.set({ ...current, [storedSessionId]: request })
}

export function setSecretRequest(storedSessionId: null | string, request: SecretRequest | null): void {
  if (!storedSessionId) {
    return
  }

  const current = $secretRequests.get()

  if (request === null) {
    if (!(storedSessionId in current)) {
      return
    }

    const next = { ...current }

    delete next[storedSessionId]
    $secretRequests.set(next)

    return
  }

  $secretRequests.set({ ...current, [storedSessionId]: request })
}

export function clearAllPrompts(storedSessionId: string): void {
  setApprovalRequest(storedSessionId, null)
  setSudoRequest(storedSessionId, null)
  setSecretRequest(storedSessionId, null)
}

/** D27: every pending approval/sudo/secret card, across every session, at
 *  once — sign-out's own clear (session-connection.ts), which unlike
 *  `clearAllPrompts` above isn't scoped to one session: the socket the
 *  requests arrived on is gone, so nothing left in either store can still
 *  be answered. */
export function clearEveryPendingPrompt(): void {
  $approvalRequests.set({})
  $sudoRequests.set({})
  $secretRequests.set({})
}
