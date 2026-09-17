// M15 B "Edit-and-resend": a message's long-press Edit action asks the
// composer to prefill with that message's text — from outside the composer,
// which owns its own per-session draft state (src/store/composer.ts) via a
// plain useState, not a live store subscription (typing must never round-
// trip through a store write on every keystroke). This is a one-shot
// request, not a draft write: the composer applies it once, keyed by a
// counter so two edits in a row are each observable even if the composer
// never re-renders in between — same shape as `$scrollToBottomRequests`.

import { atom } from 'nanostores'

export interface ComposePrefillRequest {
  text: string
  requestId: number
}

export const $composePrefillRequests = atom<Record<string, ComposePrefillRequest>>({})

let nextRequestId = 1

export function requestComposePrefill(storedSessionId: string, text: string): void {
  const current = $composePrefillRequests.get()

  $composePrefillRequests.set({ ...current, [storedSessionId]: { requestId: nextRequestId++, text } })
}
