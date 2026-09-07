import type { GatewayEventPayload } from '../../upstream/lib/chat-messages'
import type { RpcEvent } from '../../upstream/types/hermes'

import type { Effect, ReducerState } from './types'

/** Everything a family handler needs about the event being dispatched — the
 *  routing preamble in session-stream-reducer.ts computes it once per event.
 *  Mirrors apps/desktop's GatewayEventContext (gateway-event/types.ts). */
export interface FamilyContext {
  event: RpcEvent
  payload: GatewayEventPayload | undefined
  /** Resolved **stored** session id (never null when `runtimeSessionId` is
   *  non-null — see resolveStoredSessionId), or null for an unrouted event
   *  (gateway.ready, sessions.changed, ...). */
  storedSessionId: null | string
  /** Routed runtime id (explicit, pinned unscoped stream, or active fallback). */
  runtimeSessionId: null | string
  /** The routed session is the one on screen. */
  isActiveEvent: boolean
  /** Event timestamp in epoch seconds (payload timestamp or receipt time). */
  occurredAt: number
}

/** A family handler consumes matching event types and reports whether it did
 *  (mirrors desktop's boolean-returning GatewayEventHandler) — dispatch stops
 *  at the first taker. */
export type FamilyHandler = (state: ReducerState, ctx: FamilyContext) => HandlerResult

export interface HandlerResult {
  handled: boolean
  state: ReducerState
  effects: Effect[]
}

export function notHandled(state: ReducerState): HandlerResult {
  return { handled: false, state, effects: [] }
}

export function handled(state: ReducerState, effects: Effect[] = []): HandlerResult {
  return { handled: true, state, effects }
}
