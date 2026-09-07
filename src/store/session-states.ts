// The externally-observable mirror of the reducer's ReducerState.sessions +
// runtimeToStored map (M05: "nanostores atoms ... session-states (keyed by
// stored id with a runtime-sid map)"). The reducer itself (src/gateway/
// session-stream-reducer.ts) owns the actual logic and stays a plain data
// structure with zero store/React imports; this module is the one place that
// publishes its output for the rest of the app to subscribe to. Wiring a live
// gateway connection's events through the reducer and into this atom is
// M06's job — this module only owns the atom and the publish step.

import { atom } from 'nanostores'

import type { ReducerState, SessionState } from '../gateway/session-stream-reducer'

export const $sessionStates = atom<Record<string, SessionState>>({})
export const $runtimeToStored = atom<Record<string, string>>({})
export const $activeRuntimeSessionId = atom<null | string>(null)

/** Publish a reducer's ReducerState to the atoms above. Call after every
 *  `reduceGatewayEvent` (or `flushSessionDeltas`, `bindSession`, ...) call. */
export function publishReducerState(state: ReducerState): void {
  const sessions: Record<string, SessionState> = {}

  for (const [id, session] of state.sessions) {
    sessions[id] = session
  }

  const runtimeToStored: Record<string, string> = {}

  for (const [runtimeId, storedId] of state.runtimeToStored) {
    runtimeToStored[runtimeId] = storedId
  }

  $sessionStates.set(sessions)
  $runtimeToStored.set(runtimeToStored)
  $activeRuntimeSessionId.set(state.activeRuntimeSessionId)
}
