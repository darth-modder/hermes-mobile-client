// Pure counting logic for the jump-to-latest pill (M15 B, "Jump-to-latest"):
// docs/mobile-prototypes/chat.html:23,178-179 — "the pill counts the turns
// that landed while away and returns to the tail on tap." Kept out of
// Transcript.tsx so the counting rules (what counts as "landed", when the
// count resets) are unit-testable without mounting FlashList.

import type { ChatMessage } from '../upstream/lib/chat-messages'

export interface LatestPillState {
  /** Number of assistant turns that completed while the reader was away
   *  from the tail, since the last time they were at it. */
  count: number
  /** Ids of settled assistant messages already accounted for — either
   *  counted (while away) or seen-and-ignored (while at the tail) — so a
   *  message already-settled message never gets counted twice. */
  knownSettledIds: ReadonlySet<string>
}

export const INITIAL_LATEST_PILL_STATE: LatestPillState = { count: 0, knownSettledIds: new Set() }

function settledAssistantIds(messages: readonly ChatMessage[]): string[] {
  return messages.filter(m => m.role === 'assistant' && !m.pending && !m.hidden).map(m => m.id)
}

/**
 * Recomputes pill state from the current message list and whether the
 * reader is at the tail right now. Called on every messages/scroll change —
 * a no-op (returns `state` unchanged) when nothing relevant moved, so it's
 * safe to run from a plain effect without extra memoization.
 *
 * - At the tail: the count is always 0 (nothing to announce) and every
 *   currently-settled message is marked known, so scrolling away later only
 *   counts turns that settle AFTER this point.
 * - Away from the tail: each settled assistant message not already known
 *   bumps the count by one and is marked known, so it is never counted
 *   again even if this function re-runs before the reader returns to the
 *   tail (e.g. another unrelated message arrives).
 */
export function nextLatestPillState(
  state: LatestPillState,
  messages: readonly ChatMessage[],
  isAtTail: boolean
): LatestPillState {
  const settledIds = settledAssistantIds(messages)
  const settledIdSet = new Set(settledIds)
  let newlySettled = 0
  let idsChanged = false
  const nextKnown = new Set(state.knownSettledIds)

  for (const id of settledIds) {
    if (!nextKnown.has(id)) {
      nextKnown.add(id)
      idsChanged = true

      if (!isAtTail) {
        newlySettled++
      }
    }
  }

  // Drop known ids no longer present (branch switch, compaction) so this
  // set can't grow without bound across a long session.
  for (const id of nextKnown) {
    if (!settledIdSet.has(id)) {
      nextKnown.delete(id)
      idsChanged = true
    }
  }

  if (isAtTail) {
    return state.count === 0 && !idsChanged ? state : { count: 0, knownSettledIds: nextKnown }
  }

  if (newlySettled === 0) {
    return idsChanged ? { count: state.count, knownSettledIds: nextKnown } : state
  }

  return { count: state.count + newlySettled, knownSettledIds: nextKnown }
}
