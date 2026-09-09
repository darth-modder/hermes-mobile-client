import { describe, expect, it } from 'vitest'

import { pushDataToRoute } from './handlers'

describe('push/handlers pushDataToRoute', () => {
  it('returns null for missing or non-object data', () => {
    expect(pushDataToRoute(undefined)).toBeNull()
    expect(pushDataToRoute(null)).toBeNull()
    expect(pushDataToRoute('nope')).toBeNull()
  })

  it('returns null when neither session_id nor storedSessionId is present', () => {
    expect(pushDataToRoute({ kind: 'approval' })).toBeNull()
  })

  it('resolves a remote push payload by session_id', () => {
    expect(pushDataToRoute({ kind: 'approval', session_id: 'sess-1' })).toEqual({
      params: { id: 'sess-1' },
      pathname: '/(main)/sessions/[id]'
    })
  })

  it('resolves an existing local-notification payload by storedSessionId', () => {
    expect(pushDataToRoute({ storedSessionId: 'sess-2' })).toEqual({
      params: { id: 'sess-2' },
      pathname: '/(main)/sessions/[id]'
    })
  })

  it('prefers session_id when both are present', () => {
    expect(pushDataToRoute({ session_id: 'remote', storedSessionId: 'local' })).toEqual({
      params: { id: 'remote' },
      pathname: '/(main)/sessions/[id]'
    })
  })

  it('returns null for a non-string session id', () => {
    expect(pushDataToRoute({ session_id: 42 })).toBeNull()
    expect(pushDataToRoute({ session_id: '' })).toBeNull()
  })
})
