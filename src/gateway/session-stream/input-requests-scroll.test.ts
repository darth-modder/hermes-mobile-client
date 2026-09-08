// M06 fix (Opus re-verification, 2026-09-08): the ListHeaderComponent that
// mounts ApprovalCard/SudoCard/SecretCard sits at the inverted FlashList's
// visual bottom edge, off-screen until the list scrolls there. clarify.request
// already pushed a `scrollToBottom` effect for the active session; approval,
// sudo and secret requests did not, so a request could render with its
// action buttons entirely absent from the accessibility tree until the user
// scrolled manually. This covers all three, mirroring the existing
// clarify.request coverage in clarify-hydration.test.ts.

import { describe, expect, it } from 'vitest'

import { createStreamHarness } from './test-helpers'

const SID = 'session-1'

describe('session-stream-reducer: blocking-input requests reveal themselves', () => {
  it('scrolls to bottom for an approval.request on the active session', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { command: 'rm -rf /tmp/x', description: 'delete in root path', request_id: 'req-approve' },
      session_id: SID,
      type: 'approval.request'
    })

    expect(effects).toContainEqual({ type: 'scrollToBottom', storedSessionId: SID })
  })

  it('does not scroll a background session for an approval.request', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { command: 'rm -rf /tmp/x', description: 'delete in root path', request_id: 'req-approve-bg' },
      session_id: 'session-background',
      type: 'approval.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })

  it('scrolls to bottom for a sudo.request on the active session', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { request_id: 'req-sudo' },
      session_id: SID,
      type: 'sudo.request'
    })

    expect(effects).toContainEqual({ type: 'scrollToBottom', storedSessionId: SID })
  })

  it('does not scroll a background session for a sudo.request', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { request_id: 'req-sudo-bg' },
      session_id: 'session-background',
      type: 'sudo.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })

  it('scrolls to bottom for a secret.request on the active session', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret' },
      session_id: SID,
      type: 'secret.request'
    })

    expect(effects).toContainEqual({ type: 'scrollToBottom', storedSessionId: SID })
  })

  it('does not scroll a background session for a secret.request', () => {
    const h = createStreamHarness({ activeRuntimeSessionId: SID })

    const effects = h.dispatch({
      payload: { env_var: 'API_KEY', prompt: 'Enter your key', request_id: 'req-secret-bg' },
      session_id: 'session-background',
      type: 'secret.request'
    })

    expect(effects.some(e => e.type === 'scrollToBottom')).toBe(false)
  })
})
