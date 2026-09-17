import { describe, expect, it } from 'vitest'

import { checkGatewayUrl, parseGatewayHost } from './gateway-url-guard'

describe('parseGatewayHost', () => {
  it.each([
    ['http://127.0.0.1:9119', '127.0.0.1'],
    ['https://my-pc.tail1234.ts.net:9119', 'my-pc.tail1234.ts.net'],
    // Half-typed, no scheme — the state the guard actually runs in.
    ['127.0.0.1:9119', '127.0.0.1'],
    ['localhost', 'localhost'],
    ['  HTTP://LOCALHOST:9119/  ', 'localhost'],
    ['http://[::1]:9119', '::1'],
    ['[::1]', '::1']
  ])('reads %j as %j', (raw, host) => {
    expect(parseGatewayHost(raw)).toBe(host)
  })

  it.each(['', '   ', 'http://'])('returns null for %j', raw => {
    expect(parseGatewayHost(raw)).toBeNull()
  })
})

describe('checkGatewayUrl — loopback is rejected on both paths', () => {
  const loopback = [
    'http://127.0.0.1:9119',
    '127.0.0.1',
    // The rest of 127.0.0.0/8 reaches the phone identically (RFC 1122).
    'http://127.0.0.2:9119',
    'http://127.255.255.254:9119',
    'localhost',
    'http://localhost:9119',
    'http://foo.localhost:9119',
    'http://[::1]:9119'
  ]

  it.each(loopback)('rejects %j on the tailscale path', raw => {
    expect(checkGatewayUrl(raw, 'tailscale')).toMatchObject({ ok: false, rejection: 'loopback' })
  })

  it.each(loopback)('rejects %j on the url path too', raw => {
    expect(checkGatewayUrl(raw, 'url')).toMatchObject({ ok: false, rejection: 'loopback' })
  })
})

describe('checkGatewayUrl — the unspecified addresses', () => {
  it.each(['0.0.0.0', 'http://0.0.0.0:9119', 'http://[::]:9119'])('rejects %j as unspecified', raw => {
    expect(checkGatewayUrl(raw, 'tailscale')).toMatchObject({ ok: false, rejection: 'unspecified' })
    expect(checkGatewayUrl(raw, 'url')).toMatchObject({ ok: false, rejection: 'unspecified' })
  })
})

describe('checkGatewayUrl — 10.0.2.2 is the one address the two paths disagree on', () => {
  // connect.html:40-43 — rejected on the Tailscale path (the M15 exit
  // criterion), allowed on "Enter a URL", whose own card offers "an emulator
  // host" as a valid answer.
  it('rejects 10.0.2.2 on the tailscale path', () => {
    expect(checkGatewayUrl('http://10.0.2.2:9119', 'tailscale')).toMatchObject({
      ok: false,
      rejection: 'emulator-host'
    })
  })

  it('allows 10.0.2.2 on the url path', () => {
    expect(checkGatewayUrl('http://10.0.2.2:9119', 'url')).toMatchObject({ ok: true })
  })

  it('does not treat the rest of 10.0.2.x as the emulator host', () => {
    expect(checkGatewayUrl('http://10.0.2.3:9119', 'tailscale')).toMatchObject({ ok: true })
    expect(checkGatewayUrl('http://10.0.2.15:9119', 'tailscale')).toMatchObject({ ok: true })
  })
})

describe('checkGatewayUrl — real addresses pass', () => {
  it.each([
    'https://my-pc.tail1234.ts.net:9119',
    'http://myhost.tail1234.ts.net:9119',
    'http://100.101.102.103:9119', // a tailnet CGNAT address
    'http://192.168.1.50:9119',
    'https://hermes.example.com',
    'http://10.0.0.5:9119'
  ])('allows %j on both paths', raw => {
    expect(checkGatewayUrl(raw, 'tailscale')).toMatchObject({ ok: true })
    expect(checkGatewayUrl(raw, 'url')).toMatchObject({ ok: true })
  })

  // A blocklist, not an allowlist: an empty or unparseable field is not an
  // error, it is just not finished.
  it.each(['', '   ', 'http://'])('treats the unfinished %j as ok', raw => {
    expect(checkGatewayUrl(raw, 'tailscale')).toMatchObject({ ok: true, host: null })
  })

  it('does not mistake a hostname that merely starts with the digits', () => {
    expect(checkGatewayUrl('http://127-0-0-1.example.com', 'tailscale')).toMatchObject({ ok: true })
    expect(checkGatewayUrl('http://1270.0.0.1', 'tailscale')).toMatchObject({ ok: true })
  })
})
