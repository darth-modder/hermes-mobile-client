// Adapted from apps/desktop/src/app/session/hooks/use-message-stream/
// session-reclaimed.test.tsx. The desktop drops the cached transcript for a
// reclaimed runtime and asks the resumed pane to refetch it from stored
// history. Decision D2 (project-planning/DECISIONS.md) chose differently for
// this client: session state is keyed by STORED id with a runtime-sid map
// (AGENTS.md "State"), so `session.reclaimed` **rebinds** the runtime id to
// the stored id instead — the transcript already collected under the
// runtime's placeholder key moves over intact, never dropped. These
// assertions are rewritten around that contract; the desktop's tile/wiring
// assertions ($sessionTiles, wiring-cache) don't apply — this client has one
// active session, not desktop's multi-tile panes.

import { describe, expect, it } from 'vitest'

import { createStreamHarness } from './test-helpers'
import { createSessionState } from './types'

function seed(
  h: ReturnType<typeof createStreamHarness>,
  runtimeId: string,
  overrides: Partial<ReturnType<typeof createSessionState>> = {}
) {
  const state = h.getState()
  const sessions = new Map(state.sessions)

  sessions.set(runtimeId, { ...createSessionState(runtimeId), ...overrides })
  h.setState({ ...state, sessions })
}

function reclaim(
  h: ReturnType<typeof createStreamHarness>,
  runtimeId: string,
  storedId: string,
  reason = 'ws_orphan_reap'
) {
  return h.dispatch({
    payload: { reason, session_id: runtimeId, stored_session_id: storedId },
    session_id: '',
    type: 'session.reclaimed'
  })
}

describe('session-stream-reducer: session.reclaimed', () => {
  it('rebinds the reclaimed runtime under the stored id without dropping its transcript', () => {
    const h = createStreamHarness()
    const messages = [{ id: 'm1', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'hi' }] }]

    seed(h, 'live-gone', { messages })

    reclaim(h, 'live-gone', 'stored-1')

    expect(h.session('stored-1')?.messages).toEqual(messages)
    expect(h.session('live-gone')).toBeUndefined()
  })

  it('leaves every other live session alone', () => {
    const h = createStreamHarness()

    seed(h, 'live-gone')
    seed(h, 'live-kept')

    reclaim(h, 'live-gone', 'stored-1')

    expect(h.session('stored-1')).toBeDefined()
    expect(h.session('live-kept')).toBeDefined()
  })

  it('ignores a payload with no runtime id instead of touching anything', () => {
    const h = createStreamHarness()

    seed(h, 'live-a')
    seed(h, 'live-b')

    const before = h.getState().sessions

    reclaim(h, '', 'stored-x')

    expect(h.getState().sessions).toBe(before)
  })

  it('rebinds regardless of which reclaim reason fired', () => {
    for (const reason of ['idle_timeout', 'lru_evict', 'ws_orphan_reap']) {
      const h = createStreamHarness()

      seed(h, 'live-gone')
      reclaim(h, 'live-gone', 'stored-1', reason)

      expect(h.session('stored-1'), reason).toBeDefined()
      expect(h.session('live-gone'), reason).toBeUndefined()
    }
  })

  it('requests a resume when the reclaimed runtime is the active chat', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: 'live-gone' })

    seed(h, 'live-gone')

    const effects = reclaim(h, 'live-gone', 'stored-1')

    expect(effects).toContainEqual({
      type: 'hydrate',
      storedSessionId: 'stored-1',
      runtimeSessionId: null,
      attempts: 3
    })
  })

  it('does not request a resume when a background runtime is reclaimed', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: 'live-kept' })

    seed(h, 'live-gone')
    seed(h, 'live-kept')

    const effects = reclaim(h, 'live-gone', 'stored-1')

    expect(effects.some(e => e.type === 'hydrate')).toBe(false)
  })

  it("always refreshes the session list, since the reclaimed row's ended_at moved", () => {
    const h = createStreamHarness()

    seed(h, 'live-gone')

    const effects = reclaim(h, 'live-gone', 'stored-1')

    expect(effects).toContainEqual({ type: 'refreshSessions' })
  })
})
