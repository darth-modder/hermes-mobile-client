import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '../upstream/lib/chat-messages'

import { INITIAL_LATEST_PILL_STATE, nextLatestPillState } from './latest-pill'

function assistantMsg(id: string, opts: Partial<ChatMessage> = {}): ChatMessage {
  return { id, parts: [], role: 'assistant', ...opts }
}

function userMsg(id: string): ChatMessage {
  return { id, parts: [], role: 'user' }
}

describe('nextLatestPillState', () => {
  it('stays at count 0 while at the tail, even as messages settle', () => {
    let state = INITIAL_LATEST_PILL_STATE

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], true)
    expect(state.count).toBe(0)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1'), userMsg('u2'), assistantMsg('a2')], true)
    expect(state.count).toBe(0)
  })

  it('counts a settled assistant message that lands while away from the tail', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    // Reader scrolls away; a new assistant turn settles.
    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(1)
  })

  it('increments once per completed turn, not per re-render of the same settled message', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(1)

    // Same messages, same away state — re-running (e.g. an unrelated
    // delta-flush publish) must not double-count a1.
    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(1)
  })

  it('counts multiple turns that land while away, one per turn', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(1)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1'), userMsg('u2'), assistantMsg('a2')], false)
    expect(state.count).toBe(2)
  })

  it('does not count a message that is still pending (mid-stream)', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1', { pending: true })], false)
    expect(state.count).toBe(0)

    // The same turn then settles — now it counts, exactly once.
    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1', { pending: false })], false)
    expect(state.count).toBe(1)
  })

  it('does not count a hidden message', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1', { hidden: true })], false)
    expect(state.count).toBe(0)
  })

  it('returning to the tail clears the count', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(1)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], true)
    expect(state.count).toBe(0)
  })

  it('a turn that settles after the reader is back at the tail does not carry over once they scroll away again', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [userMsg('u1')], true)

    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(1)

    // Reader returns to the tail — a1 is now "seen".
    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], true)
    expect(state.count).toBe(0)

    // Scrolling away again with nothing new landing yet must stay at 0.
    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1')], false)
    expect(state.count).toBe(0)

    // Only a genuinely new turn counts.
    state = nextLatestPillState(state, [userMsg('u1'), assistantMsg('a1'), userMsg('u2'), assistantMsg('a2')], false)
    expect(state.count).toBe(1)
  })

  it('never counts a user message', () => {
    let state = nextLatestPillState(INITIAL_LATEST_PILL_STATE, [], true)

    state = nextLatestPillState(state, [userMsg('u1')], false)
    expect(state.count).toBe(0)
  })
})
