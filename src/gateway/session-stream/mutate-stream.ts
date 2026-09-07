// Pure port of apps/desktop's `mutateStream` (.../use-message-stream/index.ts)
// — patches the in-flight assistant message, seeding it on first touch.
// Centralizes the streamId/groupId bookkeeping every family handler would
// otherwise repeat.

import type { ChatMessage, ChatMessagePart } from '../../upstream/lib/chat-messages'

import { nextStreamMessageId } from './ids'
import type { SessionState } from './types'

export interface MutateStreamOptions {
  pending?: (message: ChatMessage) => boolean
}

/** Returns `session` unchanged when the turn is interrupted — after Stop, late
 *  deltas/tool events for the cancelled turn must not keep growing the
 *  (now-finalized) bubble or seed a new one that looks like it belongs to the
 *  next user message. */
export function mutateStreamingMessage(
  session: SessionState,
  transform: (parts: ChatMessagePart[], message: ChatMessage) => ChatMessagePart[],
  seed: () => ChatMessagePart[],
  opts: MutateStreamOptions = {},
  occurredAt: number = Date.now() / 1000
): SessionState {
  if (session.interrupted) {
    return session
  }

  const streamId = session.streamId ?? nextStreamMessageId('assistant-stream')
  const groupId = session.pendingBranchGroup ?? undefined
  const prev = session.messages
  let nextMessages: ChatMessage[]

  if (!prev.some(m => m.id === streamId)) {
    nextMessages = [
      ...prev,
      { id: streamId, role: 'assistant', parts: seed(), timestamp: occurredAt, pending: true, branchGroupId: groupId }
    ]
  } else {
    nextMessages = prev.map(m =>
      m.id === streamId ? { ...m, parts: transform(m.parts, m), pending: opts.pending ? opts.pending(m) : true } : m
    )
  }

  return { ...session, messages: nextMessages, streamId, sawAssistantPayload: true, awaitingResponse: false }
}
