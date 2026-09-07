// Ported from apps/desktop/src/app/session/hooks/use-message-stream/
// interim-sealing.test.tsx. Same scenarios, driven straight through
// reduceGatewayEvent instead of a rendered hook — see test-helpers.ts.

import { describe, expect, it } from 'vitest'

import { chatMessageText } from '../../upstream/lib/chat-messages'

import { createStreamHarness } from './test-helpers'
import { createSessionState } from './types'

const SID = 'session-1'

function harnessWithActive() {
  return createStreamHarness({ activeRuntimeSessionId: SID })
}

function start(h: ReturnType<typeof harnessWithActive>) {
  h.dispatch({ payload: {}, session_id: SID, type: 'message.start' })
}

function delta(h: ReturnType<typeof harnessWithActive>, text: string) {
  h.dispatch({ payload: { text }, session_id: SID, type: 'message.delta' })
}

function interim(h: ReturnType<typeof harnessWithActive>, text: string) {
  h.dispatch({ payload: { already_streamed: true, text }, session_id: SID, type: 'message.interim' })
}

function complete(h: ReturnType<typeof harnessWithActive>, text: string) {
  h.dispatch({ payload: { text }, session_id: SID, type: 'message.complete' })
}

function completePreviewed(h: ReturnType<typeof harnessWithActive>, text: string) {
  h.dispatch({ payload: { response_previewed: true, text }, session_id: SID, type: 'message.complete' })
}

function assistantMessages(h: ReturnType<typeof harnessWithActive>): string[] {
  const session = h.session(SID)

  return (session?.messages ?? [])
    .filter(m => m.role === 'assistant' && !m.hidden)
    .map(m => chatMessageText(m))
    .filter(Boolean)
}

describe('session-stream-reducer interim text sealing', () => {
  it('preserves interim text that the final response does not include', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'awaaaaa clean!! tsc zero errors')
    interim(h, 'awaaaaa clean!! tsc zero errors')
    complete(h, 'All checks passed.')

    const texts = assistantMessages(h)

    expect(texts).toContain('awaaaaa clean!! tsc zero errors')
    expect(texts).toContain('All checks passed.')
  })

  it('hydrates an empty completion when the live transcript still ends with the user message', () => {
    const h = harnessWithActive()

    h.setState({
      ...h.getState(),
      sessions: new Map([
        [
          SID,
          {
            ...createSessionState(SID),
            messages: [{ id: 'user-1', parts: [{ text: 'finish the task', type: 'text' }], role: 'user' }]
          }
        ]
      ])
    })

    start(h)
    const effects = h.dispatch({ payload: { text: '' }, session_id: SID, type: 'message.complete' })

    expect(effects).toContainEqual({ type: 'hydrate', storedSessionId: SID, runtimeSessionId: SID, attempts: 3 })
  })

  it('marks sealed interim bubbles interim and leaves the final reply unmarked', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'Let me check the files.')
    interim(h, 'Let me check the files.')
    delta(h, 'Now the second pass.')
    interim(h, 'Now the second pass.')
    complete(h, 'All done.')

    const assistants = h.session(SID)!.messages.filter(m => m.role === 'assistant' && !m.hidden)
    const byText = (text: string) => assistants.find(m => chatMessageText(m) === text)

    expect(byText('Let me check the files.')?.interim).toBe(true)
    expect(byText('Now the second pass.')?.interim).toBe(true)
    expect(byText('All done.')?.interim).toBeFalsy()
  })

  it('clears the interim mark when a previewed final settles onto the interim bubble', () => {
    const h = harnessWithActive()

    start(h)
    interim(h, 'same reply')
    completePreviewed(h, 'same reply')

    const assistants = h.session(SID)!.messages.filter(m => m.role === 'assistant' && !m.hidden)

    expect(assistants).toHaveLength(1)
    expect(assistants[0].interim).toBeFalsy()
  })

  it('dedupes interim text when the final response includes it', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'Let me check the files.')
    interim(h, 'Let me check the files.')
    complete(h, 'Let me check the files. Everything looks good.')

    const texts = assistantMessages(h)

    expect(texts).not.toContain('Let me check the files.Let me check the files.')
    expect(texts.some(t => t.includes('Let me check the files. Everything looks good.'))).toBe(true)
  })

  it('clears interimBoundaryPending at turn end so the next turn starts clean', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'interim text')
    interim(h, 'interim text')
    complete(h, 'final text')

    expect(h.session(SID)!.interimBoundaryPending).toBe(false)

    start(h)
    expect(h.session(SID)!.interimBoundaryPending).toBe(false)

    complete(h, 'new turn final')

    const texts = assistantMessages(h)

    expect(texts[texts.length - 1]).toBe('new turn final')
  })

  it('finalizes an interim segment without settling the turn', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'streaming text')
    interim(h, 'streaming text')

    expect(h.session(SID)!.busy).toBe(true)
    expect(h.session(SID)!.interimBoundaryPending).toBe(true)
  })

  it('settles an identical final onto a non-previewed interim (tool-call turn) instead of duplicating (#63679)', () => {
    const h = harnessWithActive()

    start(h)
    interim(h, 'same reply')
    complete(h, 'same reply')

    const texts = assistantMessages(h)

    expect(texts.filter(t => t === 'same reply')).toHaveLength(1)
  })

  it('settles a prefix-extended final onto a non-previewed interim (streamed + trailing delta)', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'partial')
    interim(h, 'partial')
    complete(h, 'partial answer continued')

    const texts = assistantMessages(h)

    expect(texts.filter(t => t.includes('partial'))).toHaveLength(1)
    expect(texts[0]).toBe('partial answer continued')
  })

  it('settles final onto interim even after message.start reset the boundary flag (#74560)', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'partial')
    interim(h, 'partial')
    start(h)
    complete(h, 'partial answer continued')

    const texts = assistantMessages(h)

    expect(texts.filter(t => t.includes('partial'))).toHaveLength(1)
    expect(texts[0]).toBe('partial answer continued')
  })

  it('appends a distinct previewed final after a message.start reset instead of overwriting the interim', () => {
    const h = harnessWithActive()

    start(h)
    interim(h, 'old interim text')
    start(h)
    completePreviewed(h, 'totally new answer')

    const texts = assistantMessages(h)

    expect(texts).toContain('old interim text')
    expect(texts).toContain('totally new answer')
    expect(texts).toHaveLength(2)
  })

  it('appends a genuinely different final as its own bubble (two real assistant segments)', () => {
    const h = harnessWithActive()

    start(h)
    interim(h, 'let me check the files')
    complete(h, 'the answer is 42')

    const texts = assistantMessages(h)

    expect(texts).toContain('let me check the files')
    expect(texts).toContain('the answer is 42')
    expect(texts).toHaveLength(2)
  })

  it('settles an identical final completion onto the interim when response_previewed', () => {
    const h = harnessWithActive()

    start(h)
    interim(h, 'same reply')
    completePreviewed(h, 'same reply')

    const texts = assistantMessages(h)

    expect(texts.filter(t => t === 'same reply')).toHaveLength(1)
  })

  it('settles a prefix-matched final onto the interim when response_previewed', () => {
    const h = harnessWithActive()

    start(h)
    interim(h, 'partial answer')
    completePreviewed(h, 'partial answer with more detail')

    const texts = assistantMessages(h)

    expect(texts.filter(t => t.includes('partial answer'))).toHaveLength(1)
    expect(texts[0]).toBe('partial answer with more detail')
  })

  it('dedupes partial-stream-then-nudge: streamed prefix + interim + previewed final settles to one bubble', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'partial streamed')
    interim(h, 'partial streamed')
    completePreviewed(h, 'partial streamed answer continued')

    const texts = assistantMessages(h)

    expect(texts.filter(t => t.includes('partial streamed'))).toHaveLength(1)
    expect(texts[0]).toBe('partial streamed answer continued')
  })

  it('ignores malformed message.interim payload', () => {
    const h = harnessWithActive()

    start(h)
    h.dispatch({ session_id: SID, type: 'message.interim' })
    h.dispatch({ payload: { text: '' }, session_id: SID, type: 'message.interim' })
    h.dispatch({ payload: { text: undefined }, session_id: SID, type: 'message.interim' })

    expect(h.session(SID)!.busy).toBe(true)
    expect(h.session(SID)!.interimBoundaryPending).toBe(false)
  })

  it('clears interimBoundaryPending on message.start', () => {
    const h = harnessWithActive()

    start(h)
    delta(h, 'interim text')
    interim(h, 'interim text')
    expect(h.session(SID)!.interimBoundaryPending).toBe(true)

    start(h)
    expect(h.session(SID)!.interimBoundaryPending).toBe(false)
  })
})
