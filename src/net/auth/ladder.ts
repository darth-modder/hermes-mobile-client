/**
 * The reauth ladder (AGENTS.md "Credentials and reauth"): 401 -> refresh/
 * relogin once -> retry -> still 401 -> needsLogin; 403 -> stop; anything
 * else -> backoff, never reauth. Applies identically to HTTP (401/403) and
 * WS close codes (4401/4403).
 *
 * Not a literal port of apps/desktop/electron/native-auth-decisions.ts — that
 * file is OAuth-specific (bearer-vs-cookie routing, native session liveness),
 * and OAuth is M08's scope. What IS carried over is its *pattern*: small,
 * pure, individually-testable decision functions instead of one branchy
 * reauth method, because that file's own docstring explains exactly why —
 * each of its six functions pins a contract that was once a real runtime bug.
 * `classifyFailure` / `nextReauthAction` here are that same style, and
 * `oauthGuardMayHardFail`-shaped reasoning (a hard hint of the gateway's
 * modality must not force a login prompt one is not equipped to satisfy)
 * shows up again once M08 adds an actual `refresh` implementation.
 */

/** `classify` for the common case: an `HttpError` (src/net/http.ts) thrown by
 *  `httpRequest`. Anything else (a network failure with no status, an abort)
 *  classifies as 'other' via an empty signal — never a login prompt. */
export function classifyHttpError(error: unknown): FailureSignal {
  return {
    httpStatus:
      error instanceof Error && 'status' in error ? ((error as { status: unknown }).status as number) : undefined
  }
}

export type FailureClass = 'forbidden' | 'other' | 'unauthorized'

export interface FailureSignal {
  httpStatus?: number
  wsCloseCode?: number
}

/** A confirmed auth failure is 401 or WS close 4401; a confirmed permission
 *  failure is 403 or WS close 4403. Everything else — 5xx, a timeout, a
 *  connection refusal, any other WS close code — is 'other' and must never
 *  trigger a login prompt (AGENTS.md). */
export function classifyFailure(signal: FailureSignal): FailureClass {
  if (signal.httpStatus === 401 || signal.wsCloseCode === 4401) {
    return 'unauthorized'
  }

  if (signal.httpStatus === 403 || signal.wsCloseCode === 4403) {
    return 'forbidden'
  }

  return 'other'
}

export type ReauthAction = 'backoff' | 'needs-login' | 'retry-after-refresh' | 'stop'

/**
 * The ladder's core decision, given what kind of failure this is and whether
 * a refresh+retry has already been attempted for this call.
 *
 * - 'forbidden' always stops — a 403 means the credentials are fine but the
 *   action is not permitted; retrying or reauthenticating cannot fix that.
 * - 'other' always backs off — never reauth on a timeout, 5xx, or connection
 *   refusal (AGENTS.md).
 * - 'unauthorized' tries a refresh+retry exactly once; a second unauthorized
 *   after that means the session is genuinely gone.
 */
export function nextReauthAction(classification: FailureClass, alreadyRetried: boolean): ReauthAction {
  if (classification === 'forbidden') {
    return 'stop'
  }

  if (classification === 'other') {
    return 'backoff'
  }

  return alreadyRetried ? 'needs-login' : 'retry-after-refresh'
}

/** Thrown by `runWithReauthLadder` when the ladder lands on 'needs-login' —
 *  callers should catch this specifically to route to the login screen,
 *  distinct from every other failure the wrapped call can throw. */
export class NeedsLoginError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super('Session expired — sign in again.')
    this.name = 'NeedsLoginError'
    this.cause = cause
  }
}

/** Thrown when the ladder lands on 'stop' (a 403/4403) — never retried,
 *  never treated as a login problem. */
export class ForbiddenError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super('Not permitted.')
    this.name = 'ForbiddenError'
    this.cause = cause
  }
}

export interface ReauthLadderOptions {
  /** Extract the failure signal from a caught error; return null for an
   *  error the ladder should just rethrow untouched (rare — most callers
   *  can classify every error they might see). */
  classify: (error: unknown) => FailureSignal | null
  /**
   * Attempt a silent refresh/relogin. Resolve `true` only if the caller
   * should retry — for password/token connections (M04) there is no silent
   * refresh, so this always resolves `false` and every 401 goes straight to
   * `needs-login`; M08's OAuth mode plugs in a real
   * `POST /auth/native/refresh` here.
   */
  refresh: () => Promise<boolean>
}

/**
 * Runs `fn`, applying the ladder to whatever it throws. 'other' and
 * 'forbidden' failures rethrow as-is (the caller's own backoff policy — see
 * src/upstream/lib/reconnect-backoff.ts for WS reconnects — owns retry
 * timing; this ladder never retries on its own for those). 'unauthorized'
 * attempts one refresh+retry; a second failure (or a refresh that declines)
 * throws `NeedsLoginError`.
 */
export async function runWithReauthLadder<T>(fn: () => Promise<T>, options: ReauthLadderOptions): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const signal = options.classify(error)

    if (!signal) {
      throw error
    }

    const classification = classifyFailure(signal)
    const action = nextReauthAction(classification, false)

    if (action === 'stop') {
      throw new ForbiddenError(error)
    }

    if (action === 'backoff') {
      throw error
    }

    // action === 'retry-after-refresh'
    const refreshed = await options.refresh().catch(() => false)

    if (!refreshed) {
      throw new NeedsLoginError(error)
    }

    try {
      return await fn()
    } catch (retryError) {
      const retrySignal = options.classify(retryError)
      const retryClassification = retrySignal ? classifyFailure(retrySignal) : 'other'
      const retryAction = nextReauthAction(retryClassification, true)

      if (retryAction === 'stop') {
        throw new ForbiddenError(retryError)
      }

      if (retryAction === 'needs-login') {
        throw new NeedsLoginError(retryError)
      }

      throw retryError
    }
  }
}
