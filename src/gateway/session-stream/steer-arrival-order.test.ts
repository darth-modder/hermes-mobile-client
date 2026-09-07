// Adapted from apps/desktop/src/app/session/hooks/use-message-stream/
// steer-arrival-order.test.tsx (repro for "when I steer it often sends out
// of order — a user bubble way above", #73793/#83151 class).
//
// The desktop test drives BOTH the gateway-event reducer AND
// usePromptActions.redirectPrompt (the `session.redirect` RPC round trip,
// optimistic insert, rollback-on-rejection) through one harness. M05 only
// ports the gateway-event reducer — `redirectPrompt` is a prompt-action, not
// a gateway event, and belongs to a later milestone's composer/steer
// feature. What IS ported here is the ordering primitive that action would
// call: `appendMidTurnUserMessage` (turn-helpers.ts), the exact function
// `appendSessionTextMessage({appendAfterActiveReply: true})` delegates to
// upstream. These tests call it directly to stand in for "the steer action
// ran", then drive the real reducer for everything after — pinning the same
// invariant the desktop fixture does: the steer bubble lands after every
// assistant row already streamed, and every later delta/tool/completion
// lands below it, never spliced above or merged into the sealed bubble.

import { describe, expect, it } from 'vitest'

import { type ChatMessage, chatMessageText } from '../../upstream/lib/chat-messages'

import { createStreamHarness } from './test-helpers'
import { appendMidTurnUserMessage } from './turn-helpers'
import { createSessionState } from './types'

const SID = 'steer-order-session'

/** Stands in for the desktop's `redirectPrompt` optimistic insert — the one
 *  piece of that action's behavior this reducer actually owns. */
function steer(h: ReturnType<typeof createStreamHarness>, text: string) {
  const state = h.getState()
  const session = state.sessions.get(SID) ?? createSessionState(SID)

  const message: ChatMessage = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'user',
    parts: [{ type: 'text', text }]
  }

  const updated = appendMidTurnUserMessage(session, message)
  const sessions = new Map(state.sessions)

  sessions.set(SID, updated)
  h.setState({ ...state, sessions })
}

function transcript(h: ReturnType<typeof createStreamHarness>) {
  return (h.session(SID)?.messages ?? []).map(message => `${message.role}:${chatMessageText(message).slice(0, 30)}`)
}

describe('session-stream-reducer: steer mid-turn keeps arrival order', () => {
  it('orders pre-steer output -> steer -> post-steer output -> settled reply', () => {
    const h = createStreamHarness()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({ payload: { text: 'first half of the answer' }, session_id: SID, type: 'message.delta' })

    h.dispatch({
      payload: { args: { command: 'true' }, name: 'terminal', tool_id: 't1' },
      session_id: SID,
      type: 'tool.start'
    })
    h.dispatch({ payload: { name: 'terminal', result: 'ok', tool_id: 't1' }, session_id: SID, type: 'tool.complete' })

    steer(h, 'actually do it differently')

    h.dispatch({ payload: { text: 'rebuilt answer after the steer' }, session_id: SID, type: 'message.delta' })

    const midTurn = h.session(SID)!.messages
    const steerIndex = midTurn.findIndex(message => message.role === 'user')
    const preSteer = midTurn.slice(0, steerIndex)
    const postSteer = midTurn.slice(steerIndex + 1)

    expect(steerIndex, `steer bubble missing: ${transcript(h).join(' | ')}`).toBeGreaterThan(0)
    expect(preSteer.some(message => chatMessageText(message).includes('first half'))).toBe(true)
    expect(preSteer.every(message => message.role === 'assistant')).toBe(true)
    expect(preSteer.every(message => message.pending !== true)).toBe(true)
    expect(postSteer.length).toBeGreaterThan(0)
    expect(postSteer.some(message => chatMessageText(message).includes('rebuilt answer'))).toBe(true)

    h.dispatch({
      payload: { text: 'rebuilt answer after the steer — done' },
      session_id: SID,
      type: 'message.complete'
    })

    const settled = h.session(SID)!.messages
    const settledSteerIndex = settled.findIndex(message => message.role === 'user')
    const tail = settled.at(-1)

    expect(settledSteerIndex).toBe(steerIndex)
    expect(tail?.role).toBe('assistant')
    expect(chatMessageText(tail!)).toContain('rebuilt answer after the steer — done')
    expect(settled.every(message => message.pending !== true)).toBe(true)
    expect(settled.indexOf(tail!)).toBeGreaterThan(settledSteerIndex)
  })

  it('steer with no post-steer deltas: completion settles above, bubble stays at the tail', () => {
    const h = createStreamHarness()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({ payload: { text: 'the whole reply already streamed' }, session_id: SID, type: 'message.delta' })

    steer(h, 'one more thing')

    h.dispatch({ payload: { text: 'the whole reply already streamed' }, session_id: SID, type: 'message.complete' })

    const messages = h.session(SID)!.messages
    const steerIndex = messages.findIndex(message => message.role === 'user')

    expect(steerIndex).toBe(messages.length - 1)
    expect(messages.filter(message => chatMessageText(message).includes('whole reply already streamed'))).toHaveLength(
      1
    )
    expect(messages.every(message => message.pending !== true)).toBe(true)
  })

  it('a second steer in the same turn stays below the first (contiguous run, both below prior output)', () => {
    const h = createStreamHarness()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({ payload: { text: 'output before any steer' }, session_id: SID, type: 'message.delta' })

    steer(h, 'first correction')

    h.dispatch({ payload: { text: 'output after first steer' }, session_id: SID, type: 'message.delta' })

    steer(h, 'second correction')

    h.dispatch({ payload: { text: 'final output' }, session_id: SID, type: 'message.delta' })
    h.dispatch({ payload: { text: 'final output' }, session_id: SID, type: 'message.complete' })

    const roles = h.session(SID)!.messages.map(message => `${message.role}:${chatMessageText(message).slice(0, 24)}`)

    expect(roles, roles.join(' | ')).toEqual([
      'assistant:output before any steer',
      'user:first correction',
      'assistant:output after first steer',
      'user:second correction',
      'assistant:final output'
    ])
  })

  it('a discarded (never-inserted) steer leaves the stream to settle normally, with no stray user row', () => {
    const h = createStreamHarness()

    h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
    h.dispatch({ payload: { text: 'streaming along' }, session_id: SID, type: 'message.delta' })

    // The gateway rejected the redirect — the caller never inserts the
    // optimistic bubble at all (desktop's discardOptimisticMessage removes
    // exactly what steer() above would have added, so simply not calling it
    // is the same end state).

    expect(h.session(SID)!.messages.some(message => message.role === 'user')).toBe(false)

    h.dispatch({ payload: { text: 'streaming along — done' }, session_id: SID, type: 'message.complete' })

    expect(chatMessageText(h.session(SID)!.messages.at(-1)!)).toContain('done')
  })
})
