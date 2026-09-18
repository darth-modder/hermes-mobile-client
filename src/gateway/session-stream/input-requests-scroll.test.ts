// D25: the ListHeaderComponent this test file used to cover
// (ApprovalCard/SudoCard/SecretCard sitting at the inverted FlashList's
// visual bottom edge, invisible until scrolled there) no longer exists —
// the four blocking cards dock above the composer instead, independent of
// scroll position (src/chat/InputDock.tsx). The scrollToBottom effect these
// requests used to push to compensate is retired: forcing the transcript
// to the tail when a request arrives would violate D25.8's "a request
// arriving while the reader is scrolled up... the transcript position must
// not jump."

import { describe, expect, it } from 'vitest'

import { createStreamHarness } from './test-helpers'

const SID = 'session-1'

describe('session-stream-reducer: blocking-input requests no longer force-scroll (D25)', () => {
  it('does not scroll for an approval.request, active session or not', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { command: 'rm -rf /tmp/x', description: 'delete in root path', request_id: 'req-approve' },
      session_id: SID,
      type: 'approval.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })

  it('does not scroll for a sudo.request, active session or not', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { request_id: 'req-sudo' },
      session_id: SID,
      type: 'sudo.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })

  it('does not scroll for a secret.request, active session or not', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret' },
      session_id: SID,
      type: 'secret.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })
})
