import { describe, expect, it } from 'vitest'

import { findConnectionByUrl, normalizeGatewayUrl } from './existing-connection'
import type { MobileConnection } from './types'

describe('normalizeGatewayUrl', () => {
  it('strips a trailing slash', () => {
    expect(normalizeGatewayUrl('http://10.0.2.2:9128/')).toBe('http://10.0.2.2:9128')
  })

  it('lowercases scheme and host so a re-typed URL still matches', () => {
    expect(normalizeGatewayUrl('HTTP://My-Host:9128')).toBe('http://my-host:9128')
  })

  it('is stable for an already-normalized URL', () => {
    expect(normalizeGatewayUrl('https://gateway.example.org')).toBe('https://gateway.example.org')
  })
})

describe('findConnectionByUrl', () => {
  const existing: MobileConnection = {
    authMode: 'password',
    baseUrl: 'http://10.0.2.2:9128',
    id: 'conn-existing',
    kind: 'remote',
    label: 'Throwaway'
  }

  it('finds a connection whose baseUrl normalises equal to the given one', () => {
    expect(findConnectionByUrl('http://10.0.2.2:9128/', [existing])).toBe(existing)
    expect(findConnectionByUrl('HTTP://10.0.2.2:9128', [existing])).toBe(existing)
  })

  it('returns null when no connection matches — D24.1.3 never mints a second id otherwise', () => {
    expect(findConnectionByUrl('http://10.0.2.2:9127', [existing])).toBeNull()
  })

  it('returns null against an empty registry', () => {
    expect(findConnectionByUrl('http://10.0.2.2:9128', [])).toBeNull()
  })
})
