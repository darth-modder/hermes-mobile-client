/**
 * A pure `(state, event) -> { state, effects }` port of the desktop's gateway
 * event dispatcher — apps/desktop/src/app/session/hooks/use-message-stream/
 * gateway-event/{message-stream,tools,status,input-requests,lifecycle,
 * session-info}.ts (handler contract in that directory's types.ts).
 * `desktop-bridge.ts` is deliberately omitted (see input-requests.ts and
 * status.ts for the one event, message.reaction, ported out of it anyway
 * because M05's catalog names it).
 *
 * Zero React / React Native imports — this file and everything under
 * src/gateway/session-stream/ must stay importable from plain Node (see
 * session-stream-reducer.test.ts's import-boundary assertion).
 *
 * Effects are data, not callbacks (AGENTS.md): every side effect this module
 * would otherwise perform — a toast, a haptic, a REST refetch — comes back as
 * an entry in `effects` instead. Nothing outside `src/gateway/session-stream/`
 * is touched.
 */

import { resolveGatewayEventSessionId, UNSCOPED_STREAM_EVENT_TYPES } from '../upstream/lib/gateway-events'
import type { RpcEvent } from '../upstream/types/hermes'

import type { FamilyContext, FamilyHandler } from './session-stream/context'
import { flushSessionDeltas as flushSessionDeltasImpl } from './session-stream/delta-queue'
import { handleInputRequestEvent } from './session-stream/input-requests'
import { handleLifecycleEvent } from './session-stream/lifecycle'
import { handleMessageStreamEvent } from './session-stream/message-stream'
import { handleSessionInfoEvent } from './session-stream/session-info'
import { resolveStoredSessionId, updateSession } from './session-stream/session-keys'
import { handleStatusEvent } from './session-stream/status'
import { handleToolEvent } from './session-stream/tools'
import type { Effect, ReduceResult, ReducerState } from './session-stream/types'

export { restorePendingRequestsFromResume } from './session-stream/resume-pending'
export { bindSession, resolveStoredSessionId, setActiveSession, updateSession } from './session-stream/session-keys'
export { createReducerState, createSessionState } from './session-stream/types'
export type {
  ApprovalRequest,
  ClarifyQuestion,
  ClarifyRequest,
  Effect,
  QueuedDelta,
  ReduceResult,
  ReducerState,
  SecretRequest,
  SessionState,
  SudoRequest
} from './session-stream/types'

/** Events that end an unscoped stream pin — a turn's terminal frames. Mirrors
 *  UNSCOPED_STREAM_END_EVENT_TYPES in src/upstream/lib/gateway-events.ts,
 *  which isn't itself exported. */
const COMPACTION_RESUME_EVENT_TYPES = new Set([
  'message.delta',
  'message.interim',
  'thinking.delta',
  'reasoning.delta',
  'reasoning.available',
  'moa.reference',
  'moa.aggregating',
  'moa.progress',
  'moa.phase',
  'tool.start',
  'tool.progress',
  'tool.generating',
  'tool.complete'
])

// Ordered family handlers; each consumes its own event types and reports
// whether it did, so dispatch stops at the first taker — mirrors the
// desktop's HANDLERS array in gateway-event/index.ts (minus desktop-bridge).
const HANDLERS: FamilyHandler[] = [
  handleLifecycleEvent,
  handleSessionInfoEvent,
  handleMessageStreamEvent,
  handleToolEvent,
  handleInputRequestEvent,
  handleStatusEvent
]

/**
 * The gateway-event reducer. Routes `event` to a stored session id exactly as
 * the desktop's dispatch preamble does (src/upstream/lib/gateway-events.ts,
 * already vendored and shared with it), then hands it to the first family
 * handler that claims it.
 */
export function reduceGatewayEvent(state: ReducerState, event: RpcEvent): ReduceResult {
  const payload = event.payload as FamilyContext['payload']

  const occurredAt =
    typeof payload?.timestamp === 'number' && Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now() / 1000

  const explicitSid = event.session_id || ''

  const route = resolveGatewayEventSessionId({
    activeSessionId: state.activeRuntimeSessionId,
    eventType: event.type,
    explicitSessionId: explicitSid,
    unscopedStreamSessionId: state.unscopedStreamRuntimeSessionId
  })

  let next: ReducerState = { ...state, unscopedStreamRuntimeSessionId: route.nextUnscopedStreamSessionId }

  if (route.drop) {
    return { state: next, effects: [] }
  }

  const runtimeSessionId = route.sessionId

  // Late stragglers: an unscoped stream event attributed via the
  // active-session fallback (no pin) to a session with no live turn belongs
  // to a turn that already ended elsewhere — drop it rather than let it land
  // in a freshly opened chat.
  if (
    runtimeSessionId &&
    !explicitSid &&
    !route.pinned &&
    event.type &&
    event.type !== 'message.start' &&
    UNSCOPED_STREAM_EVENT_TYPES.has(event.type)
  ) {
    const storedId = resolveStoredSessionId(next, runtimeSessionId)
    const existing = next.sessions.get(storedId)

    const hasLiveTurn = Boolean(
      existing && (existing.awaitingResponse || existing.busy || existing.streamId || existing.sawAssistantPayload)
    )

    if (!hasLiveTurn) {
      return { state: next, effects: [] }
    }
  }

  const storedSessionId = runtimeSessionId ? resolveStoredSessionId(next, runtimeSessionId) : null
  const isActiveEvent = Boolean(runtimeSessionId) && runtimeSessionId === next.activeRuntimeSessionId

  // Mid-turn compaction does not emit another message.start — the first
  // model output or tool event after it proves summarization finished and
  // the turn resumed, so retire the "compacting" flag without waiting for
  // the whole turn to complete.
  if (
    storedSessionId &&
    event.type &&
    COMPACTION_RESUME_EVENT_TYPES.has(event.type) &&
    next.compactedTurns.has(storedSessionId)
  ) {
    next = updateSession(next, storedSessionId, session =>
      session.compacting ? { ...session, compacting: false } : session
    ).state
  }

  const ctx: FamilyContext = { event, payload, storedSessionId, runtimeSessionId, isActiveEvent, occurredAt }
  const effects: Effect[] = []

  for (const handler of HANDLERS) {
    const result = handler(next, ctx)

    next = result.state
    effects.push(...result.effects)

    if (result.handled) {
      break
    }
  }

  return { state: next, effects }
}

/** Apply every buffered `message.delta`/`reasoning.delta` chunk for
 *  `storedSessionId` (or every session with a pending buffer, when omitted)
 *  into `messages`. Call this from delta-flush-scheduler.ts's flush callback
 *  — never from inside `reduceGatewayEvent` itself. */
export function flushSessionDeltas(state: ReducerState, storedSessionId?: string): ReducerState {
  return flushSessionDeltasImpl(state, storedSessionId)
}
