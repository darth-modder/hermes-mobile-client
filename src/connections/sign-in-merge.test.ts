import { describe, expect, it } from 'vitest'

import { mergeSignedInConnection } from './sign-in-merge'
import type { MobileConnection } from './types'

describe('mergeSignedInConnection', () => {
  const existing: MobileConnection = {
    authMode: 'password',
    baseUrl: 'http://10.0.2.2:9128',
    headerNames: ['CF-Access-Client-Id', 'CF-Access-Client-Secret'],
    id: 'conn-existing',
    installId: 'install-abc',
    kind: 'remote',
    label: 'Home gateway',
    needsLogin: true,
    org: 'acme',
    primary: true,
    provider: 'basic'
  }

  it('carries headerNames over from the existing entry — the exact regression Opus found', () => {
    const merged = mergeSignedInConnection(existing, {
      baseUrl: existing.baseUrl,
      id: existing.id,
      label: existing.label,
      provider: 'basic'
    })

    expect(merged.headerNames).toEqual(existing.headerNames)
  })

  it('carries the label over when re-sign-in passes an empty one', () => {
    const merged = mergeSignedInConnection(existing, {
      baseUrl: existing.baseUrl,
      id: existing.id,
      label: '',
      provider: 'basic'
    })

    expect(merged.label).toBe('Home gateway')
  })

  it('carries installId, org and primary over untouched', () => {
    const merged = mergeSignedInConnection(existing, {
      baseUrl: existing.baseUrl,
      id: existing.id,
      label: existing.label,
      provider: 'basic'
    })

    expect(merged.installId).toBe('install-abc')
    expect(merged.org).toBe('acme')
    expect(merged.primary).toBe(true)
  })

  it('clears needsLogin — a sign-in that reached this point already succeeded', () => {
    const merged = mergeSignedInConnection(existing, {
      baseUrl: existing.baseUrl,
      id: existing.id,
      label: existing.label,
      provider: 'basic'
    })

    expect(merged.needsLogin).toBe(false)
  })

  it('prefers an explicitly-passed label over the existing one', () => {
    const merged = mergeSignedInConnection(existing, {
      baseUrl: existing.baseUrl,
      id: existing.id,
      label: 'Renamed',
      provider: 'basic'
    })

    expect(merged.label).toBe('Renamed')
  })

  it('has nothing to preserve for a fresh Add — existing is null', () => {
    const merged = mergeSignedInConnection(null, {
      baseUrl: 'http://10.0.2.2:9129',
      id: 'conn-new',
      label: '',
      provider: 'basic'
    })

    expect(merged).toMatchObject({
      authMode: 'password',
      baseUrl: 'http://10.0.2.2:9129',
      id: 'conn-new',
      kind: 'remote',
      label: 'http://10.0.2.2:9129',
      needsLogin: false,
      provider: 'basic'
    })
    expect(merged.headerNames).toBeUndefined()
  })
})
