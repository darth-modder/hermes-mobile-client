// Shared test harness for the ported fixtures below. Not itself a test file
// (no `.test.ts` suffix, so vitest's `src/**/*.test.ts` include pattern skips
// it) — a thin wrapper around the real reducer, standing in for the
// desktop's `renderMessageStream` test-harness.tsx (React-rendering harness;
// this one drives the pure reducer directly, per M05: "adapt assertions to
// the reducer's output; do not copy React rendering").
//
// Auto-flushes buffered deltas after every dispatched event by default — the
// fixtures ported here assert on final transcript state, not on the
// buffering/timing behavior itself (that's delta-flush-scheduler.test.ts's
// job). Pass `autoFlush: false` to a harness that wants to inspect
// pre-flush state.

import type { RpcEvent } from '../../upstream/types/hermes'
import { createReducerState, flushSessionDeltas, reduceGatewayEvent, setActiveSession } from '../session-stream-reducer'
import type { Effect, ReducerState, SessionState } from '../session-stream-reducer'

export interface StreamHarnessOptions {
  activeRuntimeSessionId?: null | string
  autoFlush?: boolean
  initialState?: ReducerState
}

export function createStreamHarness(options: StreamHarnessOptions = {}) {
  let state = options.initialState ?? createReducerState()

  if (options.activeRuntimeSessionId !== undefined) {
    state = setActiveSession(state, options.activeRuntimeSessionId)
  }

  const autoFlush = options.autoFlush ?? true
  const allEffects: Effect[] = []

  return {
    dispatch(event: RpcEvent): Effect[] {
      const result = reduceGatewayEvent(state, event)

      state = result.state

      if (autoFlush) {
        state = flushSessionDeltas(state)
      }

      allEffects.push(...result.effects)

      return result.effects
    },
    flush(storedSessionId?: string): void {
      state = flushSessionDeltas(state, storedSessionId)
    },
    session(storedSessionId: string): SessionState | undefined {
      return state.sessions.get(storedSessionId)
    },
    getState(): ReducerState {
      return state
    },
    setState(next: ReducerState): void {
      state = next
    },
    get effects(): readonly Effect[] {
      return allEffects
    }
  }
}
