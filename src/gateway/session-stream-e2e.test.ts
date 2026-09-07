/**
 * End-to-end fixture (M05 exit criterion): a recorded event log from a real
 * `hermes serve` replays through the reducer to the same final transcript as
 * the session's own `session.resume` history.
 *
 * The fixture (src/gateway/__fixtures__/session-replay.json) was captured
 * live: `session.create` with `source: 'android'`, `prompt.submit`, the full
 * event stream through `message.complete`, and the server's own
 * `session.resume` response for the same session — the oracle this test
 * compares against. Hostname/token never appear in it (captured via a
 * throwaway local token, redacted before saving; see M03/M04's verification
 * logs for the same discipline). It also includes one unrelated
 * `session.reclaimed` broadcast for a different, already-dead session from
 * a prior run — real noise the reducer must ignore, not filtered out.
 */

import { describe, expect, it } from 'vitest'

import { chatMessageText } from '../upstream/lib/chat-messages'
import type { RpcEvent } from '../upstream/types/hermes'

import fixture from './__fixtures__/session-replay.json'
import { createReducerState, flushSessionDeltas, reduceGatewayEvent } from './session-stream-reducer'

describe('session-stream-reducer: end-to-end replay against session.resume', () => {
  it('assembles the same assistant reply text session.resume records', () => {
    let state = createReducerState()

    for (const event of fixture.events as RpcEvent[]) {
      state = reduceGatewayEvent(state, event).state
    }

    state = flushSessionDeltas(state)

    // Every event in the fixture carries the same runtime session_id (or is
    // unscoped) — with no explicit stored id ever bound, the reducer's
    // placeholder-key behavior means that runtime id doubles as the stored
    // key. Find it by scanning for the one session with messages instead of
    // hardcoding the captured id, so the fixture can be re-captured under a
    // different session id without this test changing.
    const sessions = [...state.sessions.values()].filter(session => session.messages.length > 0)

    expect(sessions).toHaveLength(1)

    const assistantMessage = sessions[0].messages.find(m => m.role === 'assistant')

    expect(assistantMessage).toBeDefined()
    expect(chatMessageText(assistantMessage!)).toBe(fixture.expected.assistantText)
  })

  it('ignores the unrelated session.reclaimed broadcast for a session it never saw', () => {
    let state = createReducerState()

    for (const event of fixture.events as RpcEvent[]) {
      state = reduceGatewayEvent(state, event).state
    }

    // The captured log's stray session.reclaimed names a stored id from a
    // different, prior session. It must not have materialized a session
    // entry of its own.
    const reclaimed = fixture.events.find(e => e.type === 'session.reclaimed') as
      { payload: { stored_session_id?: string } } | undefined

    expect(reclaimed).toBeDefined()
    expect(state.sessions.has(reclaimed!.payload.stored_session_id!)).toBe(false)
  })
})
