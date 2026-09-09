import { describe, expect, it, vi } from 'vitest'

const native = {
  start: vi.fn(),
  stop: vi.fn(async () => undefined),
  waitForCallback: vi.fn()
}

vi.mock('../../../modules/loopback-listener', () => ({ default: native }))

const { cancelLoopbackListener, LoopbackListenerError, startLoopbackListener, waitForLoopbackCallback } =
  await import('./loopback-listener')

function codedError(code: string, message = code) {
  const error = new Error(message) as Error & { code: string }

  error.code = code

  return error
}

describe('startLoopbackListener', () => {
  it('resolves with the native port on success', async () => {
    native.start.mockResolvedValueOnce(54321)

    await expect(startLoopbackListener()).resolves.toBe(54321)
  })

  it('maps ERR_LOOPBACK_START to reason "start"', async () => {
    native.start.mockRejectedValueOnce(codedError('ERR_LOOPBACK_START'))

    await expect(startLoopbackListener()).rejects.toMatchObject({ name: 'LoopbackListenerError', reason: 'start' })
  })
})

describe('waitForLoopbackCallback', () => {
  it('resolves with the raw params on success, without interpreting them', async () => {
    native.waitForCallback.mockResolvedValueOnce({ code: 'abc', state: 'xyz' })

    await expect(waitForLoopbackCallback()).resolves.toEqual({ code: 'abc', state: 'xyz' })
  })

  it.each([
    ['ERR_LOOPBACK_TIMEOUT', 'timeout'],
    ['ERR_LOOPBACK_CANCELLED', 'cancelled'],
    ['ERR_LOOPBACK_NOT_STARTED', 'not-started'],
    ['ERR_LOOPBACK_REQUEST', 'request'],
    ['ERR_SOMETHING_UNMAPPED', 'unknown']
  ])('maps native code %s to reason %s', async (code, reason) => {
    native.waitForCallback.mockRejectedValueOnce(codedError(code))

    const error = await waitForLoopbackCallback().catch((error: unknown) => error)

    expect(error).toBeInstanceOf(LoopbackListenerError)
    expect((error as InstanceType<typeof LoopbackListenerError>).reason).toBe(reason)
  })
})

describe('cancelLoopbackListener', () => {
  it('never throws, even if the native stop() rejects', async () => {
    native.stop.mockRejectedValueOnce(new Error('boom'))

    await expect(cancelLoopbackListener()).resolves.toBeUndefined()
  })
})
