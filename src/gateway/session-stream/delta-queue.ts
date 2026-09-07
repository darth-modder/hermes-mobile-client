// Pure port of the buffering half of apps/desktop's queueDelta/flushQueuedDeltas
// (.../use-message-stream/index.ts). The desktop bundles buffering AND
// *timing* together (a rAF-adaptive setTimeout decides when to flush); this
// reducer keeps only the buffering — every `message.delta` / `reasoning.delta`
// event pushes into `state.pendingDeltas` instead of touching `messages`
// immediately, and `flushSessionDeltas` is the only thing that turns the
// buffer into a `messages` mutation. WHEN to call `flushSessionDeltas` is
// delta-flush-scheduler.ts's job, entirely outside the reducer (M05: "keep the
// reducer synchronous").

import { appendAssistantTextPart, appendReasoningPart, type ChatMessagePart } from '../../upstream/lib/chat-messages'
import { dedupeGeneratedImageEchoesInParts } from '../../upstream/lib/generated-images'

import { mutateStreamingMessage } from './mutate-stream'
import { updateSession } from './session-keys'
import type { QueuedDelta, ReducerState } from './types'

/** Buffer one delta chunk for `storedSessionId`, coalescing with the previous
 *  entry when it's the same channel (mirrors the desktop's in-place `tail.text
 *  += delta`, done immutably here). A no-op for an empty delta. */
export function queueDelta(
  state: ReducerState,
  storedSessionId: string,
  channel: QueuedDelta['channel'],
  delta: string,
  occurredAt: number = Date.now() / 1000
): ReducerState {
  if (!delta) {
    return state
  }

  const queued = state.pendingDeltas.get(storedSessionId) ?? []
  const tail = queued.at(-1)

  const nextQueued =
    tail?.channel === channel
      ? [...queued.slice(0, -1), { ...tail, text: tail.text + delta }]
      : [...queued, { occurredAt, text: delta, channel }]

  const pendingDeltas = new Map(state.pendingDeltas)
  pendingDeltas.set(storedSessionId, nextQueued)

  return { ...state, pendingDeltas }
}

function applyQueuedDeltas(parts: ChatMessagePart[], queued: QueuedDelta[]): ChatMessagePart[] {
  return queued.reduce(
    (next, delta) =>
      delta.channel === 'assistant'
        ? dedupeGeneratedImageEchoesInParts(appendAssistantTextPart(next, delta.text, delta.occurredAt))
        : appendReasoningPart(next, delta.text, delta.occurredAt),
    parts
  )
}

/** Apply every buffered delta for `storedSessionId` (or every session with a
 *  buffer, when omitted) into `messages`, then clear the buffer. */
export function flushSessionDeltas(state: ReducerState, storedSessionId?: string): ReducerState {
  const ids = storedSessionId ? [storedSessionId] : [...state.pendingDeltas.keys()]
  let next = state

  for (const id of ids) {
    const queued = next.pendingDeltas.get(id)

    if (!queued || queued.length === 0) {
      continue
    }

    const pendingDeltas = new Map(next.pendingDeltas)
    pendingDeltas.delete(id)
    next = { ...next, pendingDeltas }

    const applyQueued = (parts: ChatMessagePart[]) => applyQueuedDeltas(parts, queued)

    next = updateSession(next, id, session =>
      mutateStreamingMessage(session, applyQueued, () => applyQueued([]), {}, queued[0]?.occurredAt)
    ).state
  }

  return next
}
