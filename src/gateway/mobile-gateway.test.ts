import { describe, expect, it } from 'vitest'

import { MobileGateway } from './mobile-gateway'

/** Minimal EventTarget-based WebSocket stand-in, matching the pattern
 *  json-rpc-gateway-replay.test.ts already uses for this vendored client. */
class FakeWebSocket extends EventTarget {
  readyState = 0
  url: string

  constructor(url: string) {
    super()
    this.url = url
  }

  send(): void {}

  close(): void {
    this.readyState = 3
  }

  /** RN's WebSocket 'error' event carries `.message` — the DOM `Event` type
   *  doesn't, hence the plain-object dispatch instead of `new Event(...)`. */
  fail(message: string): void {
    this.dispatchEvent(Object.assign(new Event('error'), { message }))
  }
}

describe('MobileGateway.connect() error classification', () => {
  it('names a connection-refused failure instead of the generic message', async () => {
    let socket: FakeWebSocket | undefined
    const gateway = new MobileGateway({
      socketFactory: url => {
        socket = new FakeWebSocket(url)

        return socket as unknown as WebSocket
      }
    })

    const pending = gateway.connect('ws://127.0.0.1:9999/api/ws')

    socket!.fail('java.net.ConnectException: Failed to connect to /127.0.0.1:9999')

    await expect(pending).rejects.toThrow('Connection refused — is the host running?')
  })

  it('names a 401 handshake rejection instead of the generic message', async () => {
    let socket: FakeWebSocket | undefined
    const gateway = new MobileGateway({
      socketFactory: url => {
        socket = new FakeWebSocket(url)

        return socket as unknown as WebSocket
      }
    })

    const pending = gateway.connect('ws://127.0.0.1:9128/api/ws')

    socket!.fail("Expected HTTP 101 response but was '401 Unauthorized'")

    await expect(pending).rejects.toThrow('Authentication failed — check the password.')
  })

  it('preserves the original error as .cause', async () => {
    let socket: FakeWebSocket | undefined
    const gateway = new MobileGateway({
      socketFactory: url => {
        socket = new FakeWebSocket(url)

        return socket as unknown as WebSocket
      }
    })

    const pending = gateway.connect('ws://127.0.0.1:9999/api/ws')

    socket!.fail('java.net.ConnectException: Failed to connect to /127.0.0.1:9999')

    try {
      await pending
      throw new Error('expected connect() to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).cause).toBeInstanceOf(Error)
    }
  })
})
