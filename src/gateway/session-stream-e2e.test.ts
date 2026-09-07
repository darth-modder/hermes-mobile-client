/**
 * End-to-end fixture (M05 exit criterion): a recorded event log from a real
 * `hermes serve` replays through the reducer to the same final transcript as
 * the session's own `session.resume` history.
 *
 * The fixture (src/gateway/__fixtures__/session-replay.json) was captured
 * live: `session.create` with `source: 'android'`, `prompt.submit` for a long
 * story (2019 `message.delta` events, 11 `reasoning.delta` events, a
 * 16,330-char reply), the full event stream through `message.complete`, and
 * the server's own `session.resume` response for the same session — the
 * oracle this test compares against. Hostname/token never appear in it
 * (captured via a throwaway local token, redacted before saving; see
 * M03/M04's verification logs for the same discipline).
 *
 * This replaces an earlier, much smaller fixture (a 15-char reply delivered
 * as a single `message.delta`) that Opus's re-verification flagged as too
 * small to be evidence: with one delta, its concatenation, `reasoning.
 * available`, and `message.complete` were all byte-identical, so the test
 * could not tell a correct reducer from a broken one that ignores every
 * `message.delta` and just returns `message.complete.text` — and it
 * exercised no coalescing, sealing, or multi-delta ordering at all. The
 * first assertion below closes that gap directly: it checks the LIVE
 * streamed text assembled from `message.delta` events alone, BEFORE
 * `message.complete` ever arrives, against an independent ground truth (the
 * fixture's own ordered concatenation of every delta's raw payload text,
 * computed from the capture — not derived from the reducer under test). A
 * reducer that ignored deltas would show empty/wrong text here even though
 * the final settled text (checked second, exactly as before) would still
 * pass, because `message.complete` legitimately carries its own
 * authoritative final text that overwrites the streamed copy — see
 * `completeAssistantMessage` in message-stream.ts.
 */

import { describe, expect, it } from 'vitest'

import { chatMessageText } from '../upstream/lib/chat-messages'
import type { RpcEvent } from '../upstream/types/hermes'

import fixture from './__fixtures__/session-replay.json'
import { createReducerState, flushSessionDeltas, reduceGatewayEvent } from './session-stream-reducer'

function onlySession(state: ReturnType<typeof createReducerState>) {
  const sessions = [...state.sessions.values()].filter(session => session.messages.length > 0)

  expect(sessions).toHaveLength(1)

  return sessions[0]
}

describe('session-stream-reducer: end-to-end replay against session.resume', () => {
  it('sanity-checks the fixture itself: it is the bigger, multi-delta capture', () => {
    // A regression guard on the fixture, not the reducer — if this ever
    // shrinks back to a single-delta capture, the two tests below quietly
    // stop being evidence again, exactly as Opus's finding described.
    expect(fixture.expected.deltaEventCount).toBeGreaterThan(500)
    expect(fixture.expected.assistantText.length).toBeGreaterThan(1000)
  })

  it('assembles the live streamed text from message.delta alone, before message.complete ever arrives', () => {
    let state = createReducerState()
    const completeIndex = fixture.events.findIndex(e => e.type === 'message.complete')

    expect(completeIndex).toBeGreaterThan(0)

    for (const event of fixture.events.slice(0, completeIndex) as RpcEvent[]) {
      state = reduceGatewayEvent(state, event).state
    }

    state = flushSessionDeltas(state)

    const session = onlySession(state)
    const streaming = session.messages.find(m => m.role === 'assistant')

    expect(streaming).toBeDefined()
    expect(chatMessageText(streaming!)).toBe(fixture.expected.preCompleteDeltaText)
  })

  it('assembles the same final assistant reply text session.resume records', () => {
    let state = createReducerState()

    for (const event of fixture.events as RpcEvent[]) {
      state = reduceGatewayEvent(state, event).state
    }

    state = flushSessionDeltas(state)

    const session = onlySession(state)
    const assistantMessage = session.messages.find(m => m.role === 'assistant')

    expect(assistantMessage).toBeDefined()
    expect(chatMessageText(assistantMessage!)).toBe(fixture.expected.assistantText)
    // The full 16k-char reply, not a coincidentally-short prefix.
    expect(chatMessageText(assistantMessage!).length).toBe(fixture.expected.assistantText.length)
  })
})
