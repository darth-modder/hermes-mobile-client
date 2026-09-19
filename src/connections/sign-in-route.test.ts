import { describe, expect, it } from 'vitest'

import { needsSignIn, signInRoute } from './sign-in-route'

describe('signInRoute', () => {
  it('builds the same route shape app/connect/[id]/login.tsx expects', () => {
    expect(signInRoute({ baseUrl: 'http://host:9128', id: 'conn-1', label: 'Throwaway', provider: 'basic' })).toEqual({
      params: { baseUrl: 'http://host:9128', id: 'conn-1', label: 'Throwaway', provider: 'basic' },
      pathname: '/connect/[id]/login'
    })
  })

  it('omits provider when the connection has none', () => {
    expect(signInRoute({ baseUrl: 'http://host', id: 'conn-2', label: 'X' }).params.provider).toBeUndefined()
  })
})

describe('needsSignIn', () => {
  it('is false for null/undefined/no flag, true only when needsLogin is set', () => {
    expect(needsSignIn(null)).toBe(false)
    expect(needsSignIn(undefined)).toBe(false)
    expect(needsSignIn({ needsLogin: false })).toBe(false)
    expect(needsSignIn({})).toBe(false)
    expect(needsSignIn({ needsLogin: true })).toBe(true)
  })
})
