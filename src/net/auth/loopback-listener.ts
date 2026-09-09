// Thin app-facing wrapper over modules/loopback-listener (the Expo native module —
// AGENTS.md/M08: hermes serve's `_validate_loopback_redirect_uri` accepts only
// http://127.0.0.1[:port]/... or http://[::1][:port]/..., so the RFC 8252 native login flow
// needs a real loopback socket on-device rather than a custom URL scheme). Everything here is
// pure error-shaping: the native side is deliberately dumb about *why* a wait failed (see the
// Kotlin module's own doc comment), and this is the one place that turns its four `code`s into
// something native-login.ts can branch on without string-matching `error.message`.

// modules/loopback-listener isn't a published package (see its own package.json) — it lives
// outside node_modules, so it's reached by relative path rather than a bare specifier.
import LoopbackListenerNative from '../../../modules/loopback-listener'

export type LoopbackListenerErrorReason = 'cancelled' | 'not-started' | 'request' | 'start' | 'timeout' | 'unknown'

const CODE_TO_REASON: Record<string, LoopbackListenerErrorReason> = {
  ERR_LOOPBACK_CANCELLED: 'cancelled',
  ERR_LOOPBACK_NOT_STARTED: 'not-started',
  ERR_LOOPBACK_REQUEST: 'request',
  ERR_LOOPBACK_START: 'start',
  ERR_LOOPBACK_TIMEOUT: 'timeout'
}

export class LoopbackListenerError extends Error {
  readonly cause: unknown
  readonly reason: LoopbackListenerErrorReason

  constructor(reason: LoopbackListenerErrorReason, message: string, cause: unknown) {
    super(message)
    this.name = 'LoopbackListenerError'
    this.reason = reason
    this.cause = cause
  }
}

function mapNativeError(error: unknown): LoopbackListenerError {
  const code = error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : ''
  const reason = CODE_TO_REASON[code] ?? 'unknown'

  return new LoopbackListenerError(reason, error instanceof Error ? error.message : String(error), error)
}

/** Binds the loopback socket and returns its port — call before building the
 *  `redirect_uri` the authorize URL needs. */
export async function startLoopbackListener(): Promise<number> {
  try {
    return await LoopbackListenerNative.start()
  } catch (error) {
    throw mapNativeError(error)
  }
}

/** Blocks for the browser's single GET (2-minute lifetime) and resolves with
 *  its raw query parameters — `code`/`state` on success, `error`/`error_description`
 *  on an IdP rejection the gateway forwarded through. Never throws for a
 *  "bad" callback (missing code, wrong state) — that's native-login.ts's
 *  interpretation to make, not this wrapper's. */
export async function waitForLoopbackCallback(): Promise<Record<string, string>> {
  try {
    return await LoopbackListenerNative.waitForCallback()
  } catch (error) {
    throw mapNativeError(error)
  }
}

/** Closes the listener early — cancels a pending `waitForLoopbackCallback()`
 *  with reason 'cancelled'. Safe to call even if nothing is listening
 *  (a no-op on the native side), and never throws — callers use this from
 *  cleanup paths where a failure here shouldn't mask the real error. */
export async function cancelLoopbackListener(): Promise<void> {
  await LoopbackListenerNative.stop().catch(() => undefined)
}
