import { type GatewayClientOptions, JsonRpcGatewayClient, type WebSocketLike } from '../upstream/shared/json-rpc-gateway'
import { classifyConnectReason, describeConnectReason } from '../net/connect-reason'

const REQUEST_TIMEOUT_MS = 30_000

export type MobileGatewayOptions = Pick<GatewayClientOptions, 'onSocketClose' | 'socketFactory'>

/**
 * prompt.submit is effectively fire-and-forget: turn completion is signaled
 * by message.delta / message.complete events, not by the RPC return. Mirrors
 * apps/desktop/src/api/client.ts's PROMPT_SUBMIT_REQUEST_TIMEOUT_MS — matches
 * the backend's agent-turn ceiling (agent.gateway_timeout = 1800s) so the ack
 * timeout only fires when the turn itself would have been abandoned
 * server-side. Pass this as the explicit timeoutMs on prompt.submit calls.
 */
export const PROMPT_SUBMIT_REQUEST_TIMEOUT_MS = 1_800_000

/** RN's WebSocket 'error' event isn't typed with a `.message` — Android's
 *  OkHttp-backed implementation puts the native exception's message there
 *  regardless (see src/net/connect-reason.ts's module docstring). */
function socketErrorMessage(event: unknown): string | undefined {
  const message = (event as { message?: unknown } | undefined)?.message

  return typeof message === 'string' ? message : undefined
}

export class MobileGateway extends JsonRpcGatewayClient {
  private lastSocketError: { message?: string }

  constructor(options: MobileGatewayOptions = {}) {
    const errorBox: { message?: string } = {}

    const socketFactory = (url: string): WebSocketLike => {
      const socket = options.socketFactory?.(url) ?? new WebSocket(url)

      socket.addEventListener('error', event => {
        errorBox.message = socketErrorMessage(event)
      })

      return socket
    }

    super({
      closedErrorMessage: 'Hermes gateway connection closed',
      connectErrorMessage: 'Could not connect to Hermes gateway',
      notConnectedErrorMessage: 'Hermes gateway is not connected',
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      ...options,
      socketFactory
    })

    this.lastSocketError = errorBox
  }

  /**
   * The vendored client (src/upstream/shared/json-rpc-gateway.ts:252,:280)
   * always rejects connect() with the same fixed `connectErrorMessage`,
   * discarding whatever the WebSocket 'error' event actually said. This
   * override replaces that generic rejection with the real cause —
   * classified through M04's reason ladder (src/net/auth/ladder.ts, via
   * src/net/connect-reason.ts) plus the raw detail captured above — so the
   * connect screen and the boot-failure screen (session-list.tsx) show
   * refused/timeout/DNS/TLS/401 instead of one indistinguishable string.
   * Never touches the vendored file itself (AGENTS.md).
   */
  async connect(wsUrl: string): Promise<void> {
    this.lastSocketError.message = undefined

    try {
      await super.connect(wsUrl)
    } catch (error) {
      // The vendored client (json-rpc-gateway.ts:216-283) has exactly two
      // rejection paths: a socket 'error' event, or its own connectTimeoutMs
      // timer. My 'error' listener above (attached in the same socketFactory
      // call, before the vendored one) fires synchronously first whenever
      // it's the former — so no captured message here means it was the
      // latter, not an unclassifiable failure.
      const reason = this.lastSocketError.message
        ? classifyConnectReason({ rawMessage: this.lastSocketError.message })
        : 'timeout'

      throw new Error(describeConnectReason(reason), { cause: error })
    }
  }
}
