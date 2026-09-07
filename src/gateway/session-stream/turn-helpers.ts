// Small pure message-assembly helpers hand-ported from
// apps/desktop/src/app/session/hooks/use-prompt-actions/rewind.ts. Both
// functions are dependency-free (only chat-messages, already vendored) and
// used by exactly one call site each in the desktop handlers this milestone
// ports (session-info's running=false settle, and the mid-turn "steer"
// insert this reducer exposes as `appendMidTurnUserMessage` for M06 to call
// directly rather than re-implementing session.redirect's optimistic insert
// here — see M05's steer-arrival-order fixture).

import { type ChatMessage, chatMessageText, completeOpenTimelineParts } from '../../upstream/lib/chat-messages'

/** Seal every message still marked pending (or matching `streamId`) — drop it
 *  if it ended up with no visible content, otherwise mark it settled. Used
 *  when a turn ends without its terminal event (crash, reconnect gap, steer
 *  race) so a stranded "still thinking" bubble doesn't linger mid-transcript
 *  forever. */
export function finalizeInterruptedMessages(
  messages: ChatMessage[],
  streamId?: null | string,
  occurredAt: number = Date.now() / 1000
): ChatMessage[] {
  return messages
    .filter(
      message =>
        !(
          (message.pending || message.id === streamId) &&
          message.parts.length === 0 &&
          !chatMessageText(message).trim()
        )
    )
    .map(message =>
      message.pending || message.id === streamId
        ? {
            ...message,
            completedAt: occurredAt,
            parts: completeOpenTimelineParts(message.parts, occurredAt),
            pending: false
          }
        : message
    )
}

/**
 * Arrival-ordered mid-turn user insert (desktop #73793, #83151).
 *
 * A message inserted while a turn streams must land AFTER every assistant row
 * the user had already watched arrive — never spliced above it. Seals the
 * live stream bubble in place (marked interim so the terminal completion
 * settles onto it or follows it instead of duplicating), appends the new user
 * bubble at the live tail, and clears `streamId` so the turn's next delta
 * seeds a fresh assistant bubble BELOW the insert rather than mutating the
 * sealed one above it.
 */
export function appendMidTurnUserMessage<
  State extends { interimBoundaryPending: boolean; messages: ChatMessage[]; streamId: null | string }
>(state: State, message: ChatMessage): State {
  const liveId = state.streamId
  const sealed = finalizeInterruptedMessages(state.messages, liveId)
  const sealedLiveKept = liveId !== null && sealed.some(row => row.id === liveId)

  const messages = [
    ...(sealedLiveKept ? sealed.map(row => (row.id === liveId ? { ...row, interim: true } : row)) : sealed),
    message
  ]

  return {
    ...state,
    messages,
    streamId: null,
    interimBoundaryPending: state.interimBoundaryPending || sealedLiveKept
  }
}
