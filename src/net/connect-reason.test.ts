import { describe, expect, it } from 'vitest'

import { classifyConnectReason, describeConnectReason } from './connect-reason'

describe('classifyConnectReason', () => {
  it('classifies a 401 status as unauthorized, reusing M04 ladder', () => {
    expect(classifyConnectReason({ httpStatus: 401 })).toBe('unauthorized')
  })

  it('classifies a 403 status as forbidden', () => {
    expect(classifyConnectReason({ httpStatus: 403 })).toBe('forbidden')
  })

  it('classifies a 4401 WS close code as unauthorized', () => {
    expect(classifyConnectReason({ wsCloseCode: 4401 })).toBe('unauthorized')
  })

  it('classifies a raw connection-refused message', () => {
    expect(
      classifyConnectReason({ rawMessage: 'java.net.ConnectException: Failed to connect to /127.0.0.1:9999' })
    ).toBe('refused')
  })

  it('classifies a raw timeout message', () => {
    expect(classifyConnectReason({ rawMessage: 'java.net.SocketTimeoutException: failed to connect' })).toBe('timeout')
  })

  it('classifies a raw DNS failure message', () => {
    expect(
      classifyConnectReason({ rawMessage: 'java.net.UnknownHostException: nowhere.invalid: No address associated' })
    ).toBe('dns')
  })

  it('classifies a raw TLS failure message', () => {
    expect(classifyConnectReason({ rawMessage: 'javax.net.ssl.SSLHandshakeException: Trust anchor not found' })).toBe(
      'tls'
    )
  })

  it('classifies a 401-shaped WS handshake rejection with no parsed status', () => {
    expect(classifyConnectReason({ rawMessage: "Expected HTTP 101 response but was '401 Unauthorized'" })).toBe(
      'unauthorized'
    )
  })

  it('falls back to unreachable when there is no status and no recognizable message', () => {
    expect(classifyConnectReason({})).toBe('unreachable')
    expect(classifyConnectReason({ rawMessage: 'Network request failed' })).toBe('unreachable')
  })
})

describe('describeConnectReason', () => {
  it('has non-empty text for every reason', () => {
    const reasons = ['dns', 'forbidden', 'refused', 'timeout', 'tls', 'unauthorized', 'unreachable'] as const

    for (const reason of reasons) {
      expect(describeConnectReason(reason).length).toBeGreaterThan(0)
    }
  })
})
