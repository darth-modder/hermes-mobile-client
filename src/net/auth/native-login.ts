// RFC 8252 native-app login against a gated hermes serve's Nous Portal (or any non-password)
// OAuth provider (M08). No server change: hermes_cli/dashboard_auth/routes.py already exposes
// the whole round trip —
//   GET  /auth/native/authorize?provider=&code_challenge=&code_challenge_method=S256&
//        redirect_uri=http://127.0.0.1:<port>/cb&state=
//   POST /auth/native/token { code, code_verifier } -> { access_token, refresh_token,
//        expires_at, provider, user_id } (hermes_cli/dashboard_auth/routes.py's
//        `_bearer_payload` — no cookie is set on this path, unlike password login)
// This is a fresh implementation, not a literal port of apps/desktop/electron/native-oauth.ts:
// that file is Node/Electron (node:crypto, an http.Server loopback listener, a persistent
// cookie-partitioned BrowserWindow for the *separate* Nous Portal SSO cascade — see
// cloud-discovery.ts's header for why that part doesn't carry over). What IS carried over is
// its shape — PKCE pair + state as pure, testable generation, a `parseTokenResponse`-style
// normalizer that fails loudly on a malformed body rather than storing junk — and the exact
// wire contract, read from the upstream route source above.
//
// Never logs `baseUrl` + token, the redirect URI (carries no secret itself, but AGENTS.md's
// "nothing secret is ever logged" rule is applied to every URL in this file uniformly), or any
// field of the parsed callback/token response.

import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'

import { setConnectionOAuth } from '../../connections/secure'
import { httpRequest } from '../http'

import {
  cancelLoopbackListener,
  LoopbackListenerError,
  startLoopbackListener,
  waitForLoopbackCallback
} from './loopback-listener'

const PKCE_CHALLENGE_METHOD = 'S256'
const VERIFIER_RANDOM_BYTES = 32 // RFC 7636 recommends >= 32; 32 hex-encoded bytes = 64 chars, within the 43-128 range
const STATE_RANDOM_BYTES = 24

export type NativeLoginFailureReason =
  'cancelled' | 'malformed-response' | 'provider-error' | 'state-mismatch' | 'timed-out'

export class NativeLoginError extends Error {
  readonly cause: unknown
  readonly reason: NativeLoginFailureReason

  constructor(reason: NativeLoginFailureReason, message: string, cause?: unknown) {
    super(message)
    this.name = 'NativeLoginError'
    this.reason = reason
    this.cause = cause
  }
}

export interface NativeLoginResult {
  accessToken: string
  expiresAt?: number
  provider: string
  refreshToken?: string
  userId: string
}

interface NativeTokenResponse {
  access_token?: string
  expires_at?: number
  provider?: string
  refresh_token?: string
  user_id?: string
}

/** Hex, not base64url — RFC 7636 only requires the unreserved character set
 *  [A-Za-z0-9-._~]; hex is a trivial subset of it and needs no byte->base64
 *  codec (Hermes has no `btoa` for arbitrary bytes — M02's risk register). */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** expo-crypto's BASE64 digest encoding is standard (padded) base64 — RFC 7636's
 *  challenge is base64url, so `+`/`/`/padding need converting, same as
 *  native-oauth.ts's own `b64url` helper. */
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface PkcePair {
  challenge: string
  verifier: string
}

async function generatePkcePair(): Promise<PkcePair> {
  const randomBytes = await Crypto.getRandomBytesAsync(VERIFIER_RANDOM_BYTES)
  const verifier = toHex(randomBytes)

  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64
  })

  return { challenge: toBase64Url(digest), verifier }
}

async function generateState(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(STATE_RANDOM_BYTES)

  return toHex(randomBytes)
}

function buildAuthorizeUrl(
  baseUrl: string,
  params: { challenge: string; provider?: string; redirectUri: string; state: string }
): string {
  const url = new URL('/auth/native/authorize', baseUrl)

  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', PKCE_CHALLENGE_METHOD)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)

  if (params.provider) {
    url.searchParams.set('provider', params.provider)
  }

  return url.toString()
}

function parseTokenResponse(body: NativeTokenResponse): NativeLoginResult {
  if (!body.access_token) {
    throw new NativeLoginError('malformed-response', 'Sign-in response was missing an access token.')
  }

  return {
    accessToken: body.access_token,
    expiresAt: typeof body.expires_at === 'number' ? body.expires_at : undefined,
    provider: body.provider ?? '',
    refreshToken: body.refresh_token,
    userId: body.user_id ?? ''
  }
}

/**
 * Run one full native login: PKCE pair, loopback listener, Custom Tabs to
 * `/auth/native/authorize`, code exchange, then persist the session under
 * `connectionId`. `[physical]` per M08's exit criteria — whether the
 * device's browser actually issues the loopback GET is OEM-dependent
 * (decision D1); this function itself has no emulator-observable branch on
 * that, since Chrome-on-emulator does redirect correctly in practice.
 *
 * Deliberately does NOT race `openBrowserAsync()` against the loopback wait
 * to detect a user-cancelled tab: on Android (this app's only target —
 * expo-module.config.json declares no "apple" platform) `openBrowserAsync`
 * resolves `{ type: 'opened' }` as soon as the Custom Tab launches, not when
 * it closes — that "wait for dismissal" behavior is iOS-only per
 * expo-web-browser's own docs. The loopback socket's own 2-minute deadline
 * is therefore the only reliable "the user gave up" signal on this
 * platform, and a timeout there is reported as 'timed-out' rather than a
 * generic error so a caller can offer "try again" instead of a stack trace.
 */
export async function nativeLogin(
  connectionId: string,
  baseUrl: string,
  options: { provider?: string } = {}
): Promise<NativeLoginResult> {
  const [pkce, state] = await Promise.all([generatePkcePair(), generateState()])
  const port = await startLoopbackListener()
  const redirectUri = `http://127.0.0.1:${port}/cb`

  try {
    const authorizeUrl = buildAuthorizeUrl(baseUrl, {
      challenge: pkce.challenge,
      provider: options.provider,
      redirectUri,
      state
    })

    await WebBrowser.openBrowserAsync(authorizeUrl)

    let callback: Record<string, string>

    try {
      callback = await waitForLoopbackCallback()
    } catch (error) {
      if (error instanceof LoopbackListenerError && (error.reason === 'timeout' || error.reason === 'cancelled')) {
        throw new NativeLoginError(
          error.reason === 'timeout' ? 'timed-out' : 'cancelled',
          error.reason === 'timeout' ? 'Sign-in timed out — no response after 2 minutes.' : 'Sign-in was cancelled.',
          error
        )
      }

      throw error
    }

    if (callback.error) {
      throw new NativeLoginError(
        'provider-error',
        callback.error_description || `The sign-in provider rejected the request: ${callback.error}`
      )
    }

    if (!callback.state || callback.state !== state) {
      throw new NativeLoginError('state-mismatch', 'Sign-in response did not match this attempt (possible CSRF).')
    }

    if (!callback.code) {
      throw new NativeLoginError('malformed-response', 'Sign-in response was missing an authorization code.')
    }

    const body = await httpRequest<NativeTokenResponse>(baseUrl, '/auth/native/token', {
      body: { code: callback.code, code_verifier: pkce.verifier },
      method: 'POST'
    })

    const result = parseTokenResponse(body)

    await setConnectionOAuth(connectionId, {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      provider: result.provider,
      refreshToken: result.refreshToken,
      userId: result.userId
    })

    return result
  } finally {
    await Promise.allSettled([WebBrowser.dismissBrowser(), cancelLoopbackListener()])
  }
}
