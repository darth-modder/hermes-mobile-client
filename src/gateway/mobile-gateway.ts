import { JsonRpcGatewayClient } from '../upstream/shared/json-rpc-gateway'

const REQUEST_TIMEOUT_MS = 30_000

/**
 * prompt.submit is effectively fire-and-forget: turn completion is signaled
 * by message.delta / message.complete events, not by the RPC return. Mirrors
 * apps/desktop/src/api/client.ts's PROMPT_SUBMIT_REQUEST_TIMEOUT_MS — matches
 * the backend's agent-turn ceiling (agent.gateway_timeout = 1800s) so the ack
 * timeout only fires when the turn itself would have been abandoned
 * server-side. Pass this as the explicit timeoutMs on prompt.submit calls.
 */
export const PROMPT_SUBMIT_REQUEST_TIMEOUT_MS = 1_800_000

export class MobileGateway extends JsonRpcGatewayClient {
  constructor() {
    super({
      closedErrorMessage: 'Hermes gateway connection closed',
      connectErrorMessage: 'Could not connect to Hermes gateway',
      notConnectedErrorMessage: 'Hermes gateway is not connected',
      requestTimeoutMs: REQUEST_TIMEOUT_MS
    })
  }
}
