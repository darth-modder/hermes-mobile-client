// Holds the live `scrollToBottom` effect the reducer emits (a new message, an
// interactive prompt appearing, ...) — the transcript reads the active
// session's request and bumps `maintainVisibleContentPosition`'s target back
// to the tail. A counter, not a boolean: two requests in a row (e.g. an
// approval card following a completed reply) must each be observable even if
// the transcript never re-renders between them.

import { atom } from 'nanostores'

export const $scrollToBottomRequests = atom<Record<string, number>>({})

export function requestScrollToBottom(storedSessionId: string): void {
  const current = $scrollToBottomRequests.get()
  $scrollToBottomRequests.set({ ...current, [storedSessionId]: (current[storedSessionId] ?? 0) + 1 })
}
