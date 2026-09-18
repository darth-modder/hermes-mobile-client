import { describe, expect, it } from 'vitest'

import { checkGatewayUrl, isUnencryptedGatewayUrl, parseGatewayHost } from './gateway-url-guard'

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

describe('isUnencryptedGatewayUrl', () => {
  // http vs https, on the same remote host: the scheme is the whole question.
  it.each([
    'http://my-pc.tail1234.ts.net:9119',
    'http://192.168.1.50:9119',
    'http://100.101.102.103:9119',
    'http://hermes.example.com',
    // Case and surrounding whitespace come free with a typed field.
    '  HTTP://192.168.1.50:9119  '
  ])('warns for the remote cleartext %j', raw => {
    expect(isUnencryptedGatewayUrl(raw)).toBe(true)
  })

  it.each(['https://my-pc.tail1234.ts.net:9119', 'https://192.168.1.50:9119', 'https://hermes.example.com'])(
    'stays quiet for the encrypted %j',
    raw => {
      expect(isUnencryptedGatewayUrl(raw)).toBe(false)
    }
  )

  // Nothing leaves the device for any of these, so there is nothing to
  // encrypt. `10.0.2.2` is the one that can actually be reached: the
  // "Enter a URL" path allows it on purpose.
  it.each(['http://localhost:9119', 'http://127.0.0.1:9119', 'http://10.0.2.2:9128', 'http://LOCALHOST:9119'])(
    'stays quiet for the local %j',
    raw => {
      expect(isUnencryptedGatewayUrl(raw)).toBe(false)
    }
  )

  // Same rule as the guard's: a field that is not finished is not a claim
  // about transport. `baseUrl` is dialled exactly as typed, so a scheme-less
  // entry never becomes a cleartext request — it fails to parse instead.
  it.each(['', '   ', '192.168.1.50:9119', 'my-pc.tail1234.ts.net:9119', 'http://'])(
    'stays quiet for the schemeless or unfinished %j',
    raw => {
      expect(isUnencryptedGatewayUrl(raw)).toBe(false)
    }
  )

  // 127.0.0.1 is spelled out in the brief; the rest of 127.0.0.0/8 is not,
  // and it is unreachable from the phone anyway — but it is remote-shaped, so
  // record which way this actually falls rather than leaving it to a reader's
  // guess. `checkGatewayUrl` rejects it outright, so the screen never gets
  // this far.
  it('treats the rest of 127.0.0.0/8 as remote, which the guard rejects first', () => {
    expect(isUnencryptedGatewayUrl('http://127.0.0.2:9119')).toBe(true)
    expect(checkGatewayUrl('http://127.0.0.2:9119', 'url')).toMatchObject({ ok: false })
  })
})
