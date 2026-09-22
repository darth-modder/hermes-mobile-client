// D31 point 7: pins the two upstream success shapes side by side so a future
// edit can't confuse "genuinely accepted" with "already dead" for either
// family. See dead-request.ts's own doc comment for the exact server-side
// line refs each fixture below quotes.

import { describe, expect, it } from 'vitest'

import { isApprovalRespondDead, isClarifyRespondDead, isSecretRespondDead, isSudoRespondDead } from './dead-request'

describe('isApprovalRespondDead: tools/approval.py resolve_gateway_approval() int count', () => {
  it('resolved: 0 (no targets — unknown/expired request_id) is dead', () => {
    expect(isApprovalRespondDead({ resolved: 0 })).toBe(true)
  })

  it('resolved: 1+ (genuinely resolved this call) is not dead', () => {
    expect(isApprovalRespondDead({ resolved: 1 })).toBe(false)
  })

  it('a response with no resolved field at all is not dead (fails open, not closed)', () => {
    expect(isApprovalRespondDead({})).toBe(false)
    expect(isApprovalRespondDead(undefined)).toBe(false)
  })
})

// clarify/sudo/secret all share methods_prompt.py's `_respond(..., allow_expired=True)`.
describe('isClarifyRespondDead / isSudoRespondDead / isSecretRespondDead: shared _respond() shape', () => {
  it('status: "expired" (no pending request for this id) is dead, for all three', () => {
    expect(isClarifyRespondDead({ status: 'expired' })).toBe(true)
    expect(isSudoRespondDead({ status: 'expired' })).toBe(true)
    expect(isSecretRespondDead({ status: 'expired' })).toBe(true)
  })

  it('status: "ok" (genuine success) is not dead, for all three', () => {
    expect(isClarifyRespondDead({ status: 'ok' })).toBe(false)
    expect(isSudoRespondDead({ status: 'ok' })).toBe(false)
    expect(isSecretRespondDead({ status: 'ok' })).toBe(false)
  })

  it('a response with no status field at all is not dead (fails open, not closed)', () => {
    expect(isClarifyRespondDead({})).toBe(false)
    expect(isSudoRespondDead(undefined)).toBe(false)
    expect(isSecretRespondDead({})).toBe(false)
  })

  // clarify.respond also returns {status: 'ok', remaining: [...]} mid-batch —
  // a shape neither "dead" check should trip on, since remaining questions
  // still pending is itself a form of genuine (partial) success.
  it('a mid-batch clarify response (status ok + remaining) is not dead', () => {
    expect(isClarifyRespondDead({ remaining: ['q2'], status: 'ok' } as { status?: string })).toBe(false)
  })
})
