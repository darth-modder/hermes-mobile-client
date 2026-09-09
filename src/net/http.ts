/** Typed error for a non-2xx REST response, carrying the parsed (or raw-text) body. */
export class HttpError extends Error {
  readonly body: unknown
  readonly status: number

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

export interface HttpRequestOptions {
  body?: unknown
  /** 'include' sends/stores cookies — required for the password-login flow's
   *  session cookies (M04). Omitted by default so token-mode callers (M03)
   *  are unaffected. */
  credentials?: 'include' | 'omit' | 'same-origin'
  headers?: Record<string, string>
  method?: string
  /** Backend-connection scoping — appended as ?profile=. */
  profile?: string
  timeoutMs?: number
  /** Session token (dev/loopback) or access token (gated) — sent as Authorization: Bearer. */
  token?: string
}

const DEFAULT_TIMEOUT_MS = 15_000

function parseBody(text: string): unknown {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * fetch wrapper for /api/* REST calls: Authorization: Bearer, ?profile=
 * scoping, a timeout (so a wedged backend can't hang a caller forever), and
 * a typed error carrying the parsed response body. Never logs `url` or
 * `token` — both can carry secrets.
 *
 * The timeout races `fetch()` itself rather than relying solely on
 * `AbortController.abort()` to make `fetch()`'s own promise settle (M11
 * Defect 3): confirmed live against a backend that accepted a `/api/audio/
 * speak` request and never answered — the 180s deadline fired
 * (`controller.abort()` ran) but the awaited `fetch()` promise never
 * rejected, leaving the caller hung indefinitely with no error. Mirrors
 * `upstream/shared/json-rpc-gateway.ts`'s own RPC timeout, which settles its
 * pending promise itself rather than trusting the WebSocket transport to
 * notice a cancellation — the same reasoning applies here to `fetch`.
 * `controller.abort()` is still called, best-effort, for the platforms where
 * it does release the underlying connection.
 */
export async function httpRequest<T>(baseUrl: string, path: string, options: HttpRequestOptions = {}): Promise<T> {
  const url = new URL(path, baseUrl)

  if (options.profile) {
    url.searchParams.set('profile', options.profile)
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`request timed out after ${Math.round(timeoutMs / 1000)}s: ${path}`))
    }, timeoutMs)
  })

  try {
    const response = await Promise.race([
      fetch(url.toString(), {
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        ...(options.credentials ? { credentials: options.credentials } : {}),
        headers: {
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        },
        method: options.method ?? 'GET',
        signal: controller.signal
      }),
      timeoutPromise
    ])

    const body = parseBody(await response.text())

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} ${path}`, response.status, body)
    }

    return body as T
  } finally {
    clearTimeout(timer!)
  }
}
