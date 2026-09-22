// D31 point 6 / D32: pins mergeInflightIntoMessages's own scope cut — see its
// doc comment for the full design and why each excluded shape is excluded.

import { describe, expect, it } from 'vitest'

import { createReducerState } from '../session-stream-reducer'

import { mergeInflightIntoMessages } from './inflight-merge'
import { updateSession } from './session-keys'

const SID = 'session-1'

function stateWithUserMessage() {
  return updateSession(createReducerState(), SID, session => ({
    ...session,
    messages: [{ id: 'user-1', parts: [{ text: 'are you there?', timestamp: 1, type: 'text' as const }], role: 'user' }]
  })).state
}

describe('mergeInflightIntoMessages: the plain streaming case', () => {
  it('appends a pending assistant row seeded from inflight.assistant, after the user message', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, { assistant: 'Yes, still h', streaming: true })

    const messages = next.sessions.get(SID)?.messages ?? []

    expect(messages).toHaveLength(2)
    expect(messages[0].id).toBe('user-1')
    expect(messages[1]).toMatchObject({ pending: true, role: 'assistant' })
    expect(messages[1].parts).toEqual([{ text: 'Yes, still h', timestamp: expect.any(Number), type: 'text' }])
  })

  it('sets session.streamId to the new row so a live delta right after finds it instead of minting a second one', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, { assistant: 'Yes, still h', streaming: true })

    const session = next.sessions.get(SID)

    expect(session?.streamId).toBeTruthy()
    expect(session?.messages.some(m => m.id === session.streamId)).toBe(true)
  })

  it('a following live message.delta appends to the SAME row rather than creating a second one', async () => {
    const { reduceGatewayEvent } = await import('../session-stream-reducer')
    const { flushSessionDeltas } = await import('./delta-queue')

    const state = stateWithUserMessage()
    const merged = mergeInflightIntoMessages(state, SID, { assistant: 'Yes, still h', streaming: true })
    const streamIdBefore = merged.sessions.get(SID)?.streamId

    const { state: afterDelta } = reduceGatewayEvent(merged, {
      payload: { text: 'ere.' },
      session_id: SID,
      type: 'message.delta'
    })

    const flushed = flushSessionDeltas(afterDelta, SID)

    const messages = flushed.sessions.get(SID)?.messages ?? []
    const assistantRows = messages.filter(m => m.role === 'assistant')

    expect(assistantRows).toHaveLength(1)
    expect(assistantRows[0].id).toBe(streamIdBefore)
    expect(assistantRows[0].parts).toEqual([{ text: 'Yes, still here.', timestamp: expect.any(Number), type: 'text' }])
  })
})

describe('mergeInflightIntoMessages: excluded shapes leave the state unchanged', () => {
  it('inflight absent (undefined): no-op', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, undefined)

    expect(next).toBe(state)
  })

  it('inflight explicitly null (the cold-resume shape): no-op', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, null)

    expect(next).toBe(state)
  })

  it('inflight.streaming is false (a retained, no-longer-live snapshot): no-op', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, { assistant: 'partial', streaming: false })

    expect(next).toBe(state)
  })

  it('inflight carries an error: left alone — routes through applyFailAssistantMessage in a follow-up, not here', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, {
      assistant: 'partial before the failure',
      error: 'API call failed after 3 retries: rate limited',
      streaming: true
    })

    expect(next).toBe(state)
  })

  it('inflight carries error_surface (structured failure descriptor): left alone even with no plain error string', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, {
      assistant: 'partial before the failure',
      error_surface: { code: 'rate_limited', layer: 'provider', retryable: true },
      streaming: true
    })

    expect(next).toBe(state)
  })

  it('inflight.assistant is empty: no-op — nothing to show yet', () => {
    const state = stateWithUserMessage()

    const next = mergeInflightIntoMessages(state, SID, { assistant: '', streaming: true })

    expect(next).toBe(state)
  })
})
