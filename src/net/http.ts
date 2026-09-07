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
 * scoping, an AbortController timeout (so a wedged backend can't hang a
 * caller forever), and a typed error carrying the parsed response body.
 * Never logs `url` or `token` — both can carry secrets.
 */
export async function httpRequest<T>(baseUrl: string, path: string, options: HttpRequestOptions = {}): Promise<T> {
  const url = new URL(path, baseUrl)

  if (options.profile) {
    url.searchParams.set('profile', options.profile)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url.toString(), {
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      method: options.method ?? 'GET',
      signal: controller.signal
    })

    const body = parseBody(await response.text())

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} ${path}`, response.status, body)
    }

    return body as T
  } finally {
    clearTimeout(timer)
  }
}
