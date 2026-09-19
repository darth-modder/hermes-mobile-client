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

  it('drops the scheme default port — D27: :80 for http, :443 for https', () => {
    expect(normalizeGatewayUrl('http://hermes.example.com:80')).toBe('http://hermes.example.com')
    expect(normalizeGatewayUrl('https://hermes.example.com:443')).toBe('https://hermes.example.com')
  })

  it('treats a default-port URL and its bare equivalent as the same address', () => {
    expect(normalizeGatewayUrl('http://10.0.2.2:80/')).toBe(normalizeGatewayUrl('http://10.0.2.2'))
  })

  it('keeps a non-default port', () => {
    expect(normalizeGatewayUrl('http://10.0.2.2:9128')).toBe('http://10.0.2.2:9128')
  })

  it('lowercases scheme and host but preserves a path\'s case — D27: "path otherwise kept"', () => {
    expect(normalizeGatewayUrl('HTTP://My-Host:9128/API/Status')).toBe('http://my-host:9128/API/Status')
  })

  it('falls back to trim-and-lowercase for a string with no scheme, instead of throwing', () => {
    expect(normalizeGatewayUrl('10.0.2.2:9128')).toBe('10.0.2.2:9128')
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
