import { describe, expect, it, vi } from 'vitest'

import { HttpError } from '../http'

import {
  classifyFailure,
  classifyHttpError,
  ForbiddenError,
  NeedsLoginError,
  nextReauthAction,
  runWithReauthLadder
} from './ladder'

describe('classifyFailure', () => {
  it('classifies 401 and WS close 4401 as unauthorized', () => {
    expect(classifyFailure({ httpStatus: 401 })).toBe('unauthorized')
    expect(classifyFailure({ wsCloseCode: 4401 })).toBe('unauthorized')
  })

  it('classifies 403 and WS close 4403 as forbidden', () => {
    expect(classifyFailure({ httpStatus: 403 })).toBe('forbidden')
    expect(classifyFailure({ wsCloseCode: 4403 })).toBe('forbidden')
  })

  it('classifies everything else — 5xx, timeouts, other WS codes — as other', () => {
    expect(classifyFailure({ httpStatus: 500 })).toBe('other')
    expect(classifyFailure({ httpStatus: 503 })).toBe('other')
    expect(classifyFailure({ wsCloseCode: 1006 })).toBe('other')
    expect(classifyFailure({})).toBe('other')
  })
})

describe('nextReauthAction', () => {
  it('forbidden always stops, regardless of retry state', () => {
    expect(nextReauthAction('forbidden', false)).toBe('stop')
    expect(nextReauthAction('forbidden', true)).toBe('stop')
  })

  it('other always backs off, never reauths', () => {
    expect(nextReauthAction('other', false)).toBe('backoff')
    expect(nextReauthAction('other', true)).toBe('backoff')
  })

  it('unauthorized retries once then needs login', () => {
    expect(nextReauthAction('unauthorized', false)).toBe('retry-after-refresh')
    expect(nextReauthAction('unauthorized', true)).toBe('needs-login')
  })
})

describe('classifyHttpError', () => {
  it('reads the status off an HttpError', () => {
    expect(classifyHttpError(new HttpError('nope', 401, null))).toEqual({ httpStatus: 401 })
  })

  it('yields an empty signal (classifies as other) for a non-HttpError', () => {
    expect(classifyHttpError(new Error('network down'))).toEqual({ httpStatus: undefined })
    expect(classifyFailure(classifyHttpError(new Error('network down')))).toBe('other')
  })
})

describe('runWithReauthLadder', () => {
  it('returns the result on success without ever calling refresh', async () => {
    const refresh = vi.fn(async () => true)
    const result = await runWithReauthLadder(async () => 'ok', { classify: classifyHttpError, refresh })

    expect(result).toBe('ok')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('401 -> refresh succeeds -> retries once -> returns the retry result', async () => {
    let calls = 0

    const fn = vi.fn(async () => {
      calls += 1

      if (calls === 1) {
        throw new HttpError('unauthorized', 401, null)
      }

      return 'ok-after-refresh'
    })

    const refresh = vi.fn(async () => true)

    const result = await runWithReauthLadder(fn, { classify: classifyHttpError, refresh })

    expect(result).toBe('ok-after-refresh')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('401 -> refresh declines -> throws NeedsLoginError without retrying', async () => {
    const fn = vi.fn(async () => {
      throw new HttpError('unauthorized', 401, null)
    })

    const refresh = vi.fn(async () => false)

    await expect(runWithReauthLadder(fn, { classify: classifyHttpError, refresh })).rejects.toBeInstanceOf(
      NeedsLoginError
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('401 -> refresh succeeds -> retry still 401 -> throws NeedsLoginError, refresh called only once', async () => {
    const fn = vi.fn(async () => {
      throw new HttpError('unauthorized', 401, null)
    })

    const refresh = vi.fn(async () => true)

    await expect(runWithReauthLadder(fn, { classify: classifyHttpError, refresh })).rejects.toBeInstanceOf(
      NeedsLoginError
    )
    expect(fn).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('403 stops immediately — never calls refresh, never retries', async () => {
    const fn = vi.fn(async () => {
      throw new HttpError('forbidden', 403, null)
    })

    const refresh = vi.fn(async () => true)

    await expect(runWithReauthLadder(fn, { classify: classifyHttpError, refresh })).rejects.toBeInstanceOf(
      ForbiddenError
    )
    expect(fn).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a 500 backs off — rethrows the original error, never calls refresh', async () => {
    const original = new HttpError('server error', 500, null)

    const fn = vi.fn(async () => {
      throw original
    })

    const refresh = vi.fn(async () => true)

    await expect(runWithReauthLadder(fn, { classify: classifyHttpError, refresh })).rejects.toBe(original)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a network error with no status backs off the same way', async () => {
    const original = new Error('fetch failed')

    const fn = vi.fn(async () => {
      throw original
    })

    const refresh = vi.fn(async () => true)

    await expect(runWithReauthLadder(fn, { classify: classifyHttpError, refresh })).rejects.toBe(original)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a WS close 4401 goes through the same ladder as an HTTP 401', async () => {
    let calls = 0

    const fn = vi.fn(async () => {
      calls += 1

      if (calls === 1) {
        throw { wsCloseCode: 4401 }
      }

      return 'reconnected'
    })

    const refresh = vi.fn(async () => true)

    const classify = (error: unknown) =>
      error && typeof error === 'object' && 'wsCloseCode' in error
        ? { wsCloseCode: (error as { wsCloseCode: number }).wsCloseCode }
        : null

    const result = await runWithReauthLadder(fn, { classify, refresh })

    expect(result).toBe('reconnected')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('a WS close 4403 stops like an HTTP 403', async () => {
    const fn = vi.fn(async () => {
      throw { wsCloseCode: 4403 }
    })

    const refresh = vi.fn(async () => true)

    const classify = (error: unknown) =>
      error && typeof error === 'object' && 'wsCloseCode' in error
        ? { wsCloseCode: (error as { wsCloseCode: number }).wsCloseCode }
        : null

    await expect(runWithReauthLadder(fn, { classify, refresh })).rejects.toBeInstanceOf(ForbiddenError)
    expect(refresh).not.toHaveBeenCalled()
  })
})
