/**
 * Per-session "what's already been spoken" tracking, feeding the vendored
 * `collectUnspokenTurnSpeech` (src/upstream/lib/chat-messages/parts.ts, already used by the
 * desktop's voice-conversation mode) rather than re-deriving "the reply text" from scratch —
 * it already handles multi-bubble turns (tool-call narration + final answer), hidden
 * messages, and streaming/pending state correctly.
 */

import { atom } from 'nanostores'

import { type ChatMessage, collectUnspokenTurnSpeech } from '../upstream/lib/chat-messages'

export const $lastSpokenId = atom<Record<string, string>>({})

function markSpoken(storedSessionId: string, messageId: string): void {
  $lastSpokenId.set({ ...$lastSpokenId.get(), [storedSessionId]: messageId })
}

export interface UnspokenReply {
  id: string
  text: string
}

/** The assistant text not yet spoken for this session, or null when there's nothing new (or
 *  the turn is still streaming — the speak button waits for a settled reply). Does not mark
 *  anything spoken; call `markSpoken`-equivalent only after `speak()` actually succeeds
 *  (see usePushRegistration.ts-style "don't record success you haven't earned" pattern) —
 *  see `speakUnspokenReply` below, which does both in the right order. */
export function unspokenReply(storedSessionId: string, messages: readonly ChatMessage[]): null | UnspokenReply {
  const collected = collectUnspokenTurnSpeech(messages as ChatMessage[], $lastSpokenId.get()[storedSessionId] ?? null)

  if (!collected || collected.pending || !collected.text) {
    return null
  }

  return { id: collected.id, text: collected.text }
}

/** Speaks the unspoken reply for `storedSessionId`, if any, via the given `speak` function
 *  (injected so this stays testable without the native `expo-audio` import — see tts.ts).
 *  Marks it spoken only once `speak` resolves, so a failed request can be retried. */
export async function speakUnspokenReply(
  storedSessionId: string,
  messages: readonly ChatMessage[],
  speak: (text: string) => Promise<void>
): Promise<boolean> {
  const reply = unspokenReply(storedSessionId, messages)

  if (!reply) {
    return false
  }

  await speak(reply.text)
  markSpoken(storedSessionId, reply.id)

  return true
}
