import type { ChatMessage } from '../upstream/lib/chat-messages'
import type { UsageStats } from '../upstream/types/hermes'

/**
 * Per-message fields this client stamps that upstream's `ChatMessage` does
 * not carry (M15 B, Response stats) — kept out of src/upstream/ because that
 * tree is machine-synced byte-for-byte from hermes-agent (scripts/sync-upstream.mjs)
 * and hand-edits there are silently discarded on the next sync.
 *
 * Both fields are optional, so a plain `ChatMessage` (nothing stamped, e.g. a
 * message hydrated from history) already satisfies this type — no cast is
 * needed to pass one where a `ChatMessageWithExtras` is expected.
 */
export type ChatMessageWithExtras = ChatMessage & {
  /** The model that generated this reply, stamped from the session's own
   *  `model` at the moment `message.complete` lands — see message-stream.ts. */
  model?: string
  /** This message's own token usage, stamped from `message.complete`'s
   *  `usage` field when the server sent one. */
  usage?: Partial<UsageStats>
}
