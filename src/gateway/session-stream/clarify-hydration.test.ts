// Ported from apps/desktop/src/app/session/hooks/use-message-stream/
// clarify-hydration.test.tsx. A `clarify.request` must leave an answerable
// inline row even when the `tool.start` that normally mounts it was missed
// (stream reconnect / hydration race) — without it the sidebar says "needs
// input" but the transcript has nowhere to render the choices, so the agent
// blocks forever.

import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '../../upstream/lib/chat-messages'

import { createStreamHarness } from './test-helpers'
import { createSessionState, type Effect } from './types'

const SID = 'session-1'

function clarifyParts(h: ReturnType<typeof createStreamHarness>) {
  return (h.session(SID)?.messages ?? [])
    .flatMap(m => m.parts)
    .filter(p => p.type === 'tool-call' && p.toolName === 'clarify')
}

function latestSetClarify(effects: readonly Effect[]) {
  return [...effects].reverse().find((e): e is Extract<Effect, { type: 'setClarify' }> => e.type === 'setClarify')
}

function seedHydratedMessages(h: ReturnType<typeof createStreamHarness>, messages: ChatMessage[]) {
  const state = h.getState()
  const sessions = new Map(state.sessions)

  sessions.set(SID, { ...createSessionState(SID), messages, streamId: null })
  h.setState({ ...state, sessions })
}

describe('session-stream-reducer: clarify.request stream hydration', () => {
  it('mounts an answerable clarify row when the tool.start row was missed', () => {
    const h = createStreamHarness()

    h.dispatch({
      payload: { choices: ['yes', 'no'], question: 'Ship it?', request_id: 'req-1' },
      session_id: SID,
      type: 'clarify.request'
    })

    const parts = clarifyParts(h)

    expect(parts).toHaveLength(1)
    expect(parts[0].type === 'tool-call' && parts[0].toolCallId).toBe('req-1')
    expect(parts[0].type === 'tool-call' && parts[0].args).toMatchObject({
      choices: ['yes', 'no'],
      question: 'Ship it?'
    })
  })

  it('reveals a clarify prompt raised by the active session', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { choices: ['yes', 'no'], question: 'Ship it?', request_id: 'req-reveal' },
      session_id: SID,
      type: 'clarify.request'
    })

    expect(effects).toContainEqual({ type: 'scrollToBottom', storedSessionId: SID })
  })

  it('does not move the active thread for a background session clarify', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { choices: ['yes', 'no'], question: 'Ship it?', request_id: 'req-background' },
      session_id: 'session-background',
      type: 'clarify.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })

  it('preserves multi-select through the effect and hydrated tool row', () => {
    const h = createStreamHarness()

    const effects = h.dispatch({
      payload: {
        choices: ['read', 'write'],
        multi_select: true,
        question: 'Which permissions?',
        request_id: 'req-multi'
      },
      session_id: SID,
      type: 'clarify.request'
    })

    expect(latestSetClarify(effects)?.request?.multiSelect).toBe(true)

    const part = clarifyParts(h)[0]

    expect(part?.type).toBe('tool-call')

    if (part?.type !== 'tool-call') {
      throw new Error('Expected a hydrated clarify tool call')
    }

    expect(part.args).toMatchObject({ choices: ['read', 'write'], multi_select: true, question: 'Which permissions?' })
  })

  it('merges with the real tool.start row even though its id differs from the request id', () => {
    const h = createStreamHarness()

    h.dispatch({
      payload: { args: { choices: ['a'], question: 'Pick' }, name: 'clarify', tool_id: 'call-abc' },
      session_id: SID,
      type: 'tool.start'
    })
    h.dispatch({
      payload: { choices: ['a'], question: 'Pick', request_id: 'req-2' },
      session_id: SID,
      type: 'clarify.request'
    })

    expect(clarifyParts(h)).toHaveLength(1)
  })

  it('does not duplicate when clarify.request arrives before the tool.start row', () => {
    const h = createStreamHarness()

    h.dispatch({
      payload: { choices: ['a'], question: 'Pick', request_id: 'req-3' },
      session_id: SID,
      type: 'clarify.request'
    })
    h.dispatch({
      payload: { args: { choices: ['a'], question: 'Pick' }, name: 'clarify', tool_id: 'call-xyz' },
      session_id: SID,
      type: 'tool.start'
    })

    expect(clarifyParts(h)).toHaveLength(1)
  })

  it('re-arms a hydrated Codex tool-only clarify in place instead of appending a second card', () => {
    const h = createStreamHarness()

    seedHydratedMessages(h, [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'help me choose' }] },
      {
        id: 'assistant-codex',
        role: 'assistant',
        parts: [
          {
            type: 'tool-call',
            toolCallId: 'call-codex',
            toolName: 'clarify',
            args: { choices: ['a', 'b'], question: 'Pick' },
            argsText: '{"question":"Pick","choices":["a","b"]}'
          }
        ]
      }
    ])

    h.dispatch({
      payload: { choices: ['a', 'b'], question: 'Pick', request_id: 'req-codex' },
      session_id: SID,
      type: 'clarify.request'
    })

    const messages = h.session(SID)!.messages

    expect(messages).toHaveLength(2)
    expect(clarifyParts(h)).toHaveLength(1)
    expect(messages[1]).toMatchObject({ id: 'assistant-codex', pending: true })
    expect(h.session(SID)!.streamId).toBe('assistant-codex')
  })

  it('keeps a hydrated DeepSeek text-plus-clarify row in its original position', () => {
    const h = createStreamHarness()

    seedHydratedMessages(h, [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'inspect this' }] },
      {
        id: 'assistant-deepseek',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'I found two paths; choose one.' },
          {
            type: 'tool-call',
            toolCallId: 'call-deepseek',
            toolName: 'clarify',
            args: { choices: ['safe', 'fast'], question: 'Which path?' },
            argsText: '{"question":"Which path?","choices":["safe","fast"]}'
          }
        ]
      }
    ])

    h.dispatch({
      payload: { choices: ['safe', 'fast'], question: 'Which path?', request_id: 'req-deepseek' },
      session_id: SID,
      type: 'clarify.request'
    })

    const messages = h.session(SID)!.messages

    expect(messages).toHaveLength(2)
    expect(messages[1].id).toBe('assistant-deepseek')
    expect(messages[1].parts.map(part => part.type)).toEqual(['text', 'tool-call'])
    expect(messages[1].pending).toBe(true)
    expect(h.session(SID)!.streamId).toBe('assistant-deepseek')
  })

  it('settles the re-armed provider tool id in place when tool.complete arrives', () => {
    const h = createStreamHarness()

    seedHydratedMessages(h, [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'inspect this' }] },
      {
        id: 'assistant-deepseek',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'I found two paths; choose one.' },
          {
            type: 'tool-call',
            toolCallId: 'call-provider',
            toolName: 'clarify',
            args: { choices: ['safe', 'fast'], question: 'Which path?' },
            argsText: '{"question":"Which path?","choices":["safe","fast"]}'
          }
        ]
      }
    ])

    h.dispatch({
      payload: { choices: ['safe', 'fast'], question: 'Which path?', request_id: 'req-ui' },
      session_id: SID,
      type: 'clarify.request'
    })
    h.dispatch({
      payload: {
        args: { choices: ['safe', 'fast'], question: 'Which path?' },
        name: 'clarify',
        result: { question: 'Which path?', user_response: 'safe' },
        tool_id: 'call-provider'
      },
      session_id: SID,
      type: 'tool.complete'
    })

    const parts = clarifyParts(h)

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ toolCallId: 'call-provider', result: { user_response: 'safe' } })
  })

  it('ignores a late clarify.request after the turn was interrupted', () => {
    const h = createStreamHarness()

    seedHydratedMessages(h, [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'stop this' }] }])

    const state = h.getState()
    const sessions = new Map(state.sessions)

    sessions.set(SID, { ...sessions.get(SID)!, interrupted: true })
    h.setState({ ...state, sessions })

    const effects = h.dispatch({
      payload: { choices: ['a', 'b'], question: 'Pick', request_id: 'req-late' },
      session_id: SID,
      type: 'clarify.request'
    })

    expect(effects.some(e => e.type === 'setClarify')).toBe(false)
    expect(h.session(SID)!.messages).toHaveLength(1)
  })

  it('expires only the matching clarify request and deactivates its card', () => {
    const h = createStreamHarness()

    h.dispatch({
      payload: { args: { choices: ['a'], question: 'Pick' }, name: 'clarify', tool_id: 'call-provider' },
      session_id: SID,
      type: 'tool.start'
    })
    h.dispatch({
      payload: { choices: ['a'], question: 'Pick', request_id: 'req-expire' },
      session_id: SID,
      type: 'clarify.request'
    })

    expect(h.session(SID)!.pendingClarifyRequestId).toBe('req-expire')

    const staleExpireEffects = h.dispatch({
      payload: { request_id: 'req-other' },
      session_id: SID,
      type: 'clarify.expire'
    })

    expect(staleExpireEffects).toHaveLength(0)
    expect(h.session(SID)!.pendingClarifyRequestId).toBe('req-expire')
    expect(clarifyParts(h)[0]).not.toHaveProperty('result')

    const expireEffects = h.dispatch({ payload: { request_id: 'req-expire' }, session_id: SID, type: 'clarify.expire' })

    expect(expireEffects).toContainEqual({ type: 'setClarify', storedSessionId: SID, request: null })
    expect(h.session(SID)!.pendingClarifyRequestId).toBeNull()
    expect(clarifyParts(h)).toHaveLength(1)
    expect(clarifyParts(h)[0]).toHaveProperty('result')
    expect(h.session(SID)!.needsInput).toBe(false)
  })

  it('merges a BATCH tool.start row with its clarify.request (no top-level question)', () => {
    const h = createStreamHarness()

    h.dispatch({
      payload: {
        args: { questions: [{ question: 'Drink?' }, { question: 'Productive when?' }] },
        name: 'clarify',
        tool_id: 'call-batch'
      },
      session_id: SID,
      type: 'tool.start'
    })

    const effects = h.dispatch({
      payload: {
        questions: [
          { qid: 'q0', question: 'Drink?' },
          { qid: 'q1', question: 'Productive when?' }
        ],
        request_id: 'req-batch'
      },
      session_id: SID,
      type: 'clarify.request'
    })

    expect(clarifyParts(h)).toHaveLength(1)
    expect(latestSetClarify(effects)?.request?.questions).toHaveLength(2)
  })

  it('does not duplicate when the batch clarify.request arrives before tool.start', () => {
    const h = createStreamHarness()

    const effects = h.dispatch({
      payload: {
        questions: [
          { qid: 'q0', question: 'Drink?' },
          { qid: 'q1', question: 'Productive when?' }
        ],
        request_id: 'req-batch-2'
      },
      session_id: SID,
      type: 'clarify.request'
    })

    h.dispatch({
      payload: {
        args: { questions: [{ question: 'Drink?' }, { question: 'Productive when?' }] },
        name: 'clarify',
        tool_id: 'call-batch-2'
      },
      session_id: SID,
      type: 'tool.start'
    })

    expect(clarifyParts(h)).toHaveLength(1)
    expect(latestSetClarify(effects)?.request?.questions).toHaveLength(2)
  })
})
