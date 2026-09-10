/**
 * The connection glue layer M06 adds: owns the one live `MobileGateway`
 * socket (AGENTS.md / M04: one active connection in v1), feeds every inbound
 * frame through the pure `session-stream-reducer`, publishes the result into
 * `src/store/*` atoms, and exposes the RPC-calling functions the chat screen
 * needs (submit/stop/steer/btw, the four blocking-input `*.respond` calls,
 * attachments, slash-command completion).
 *
 * Nothing in here re-derives transcript state: `reduceGatewayEvent` /
 * `flushSessionDeltas` (src/gateway/session-stream-reducer.ts) own that, and
 * every side effect they describe is dispatched here into the matching store
 * — never recomputed. This module owns WHEN a frame reaches the reducer and
 * WHERE its effects land; the reducer owns WHAT they mean.
 *
 * Deviation (documented in M06-chat-screen.md): the reauth ladder
 * (src/net/auth/ladder.ts) is wired here at the WS-close boundary, not around
 * every RPC call. A live gateway session's failure mode is a 4401/4403 socket
 * close, not an HTTP 401 mid-request — `runWithReauthLadder`'s HTTP-shaped
 * retry doesn't fit a socket that just went away. `classifyFailure`'s table
 * (401/4401 -> unauthorized, 403/4403 -> forbidden) is reused directly against
 * the close code instead. Token/password connections (M04) have no silent
 * refresh, so an unauthorized close always lands on `needsLogin` — matching
 * `nextReauthAction`'s "no refresh available" branch. M08 plugs in OAuth's
 * real refresh (src/net/auth/token-refresh.ts) for exactly that branch: a
 * 4401 on an oauth connection attempts one `refreshConnectionOAuth` before
 * falling back to `needsLogin`, then redials on success so the reconnect
 * that already handles a plain dropped socket (M07) also covers "the token
 * just needed renewing".
 *
 * M08 Defect 1 fix: that WS-close branch requires a socket that was already
 * open, which a dead refresh token never produces — `resolveAuth`'s ws-ticket
 * mint 401s first and `ensureGatewayConnection()` just rejects. See
 * `flagOauthSessionExpiredIfConfirmed` below for the pre-connect mirror of
 * this same `needsLogin` decision.
 */

import { getActiveConnection, updateActiveConnection } from '../connections/registry'
import { getConnectionHeaders, getConnectionOAuth, getConnectionToken } from '../connections/secure'
import type { MobileConnection } from '../connections/types'
import { hapticStreamStart, hapticSubmit } from '../lib/haptics'
import { ensureFreshOAuthAccessToken, refreshConnectionOAuth } from '../net/auth/token-refresh'
import { HttpError, httpRequest } from '../net/http'
import { dispatchNativeNotification } from '../push/native-notifications'
import { setClarifyRequest } from '../store/clarify'
import { notifyCronChanged, notifyPairingChanged, notifyPlatformsChanged } from '../store/live-sync'
import { notify } from '../store/notifications'
import { getActiveProfile } from '../store/profile'
import { setApprovalRequest, setSecretRequest, setSudoRequest } from '../store/prompts'
import { requestScrollToBottom } from '../store/scroll'
import { publishReducerState } from '../store/session-states'
import { requestSessionListRefresh } from '../store/sessions'
import { publishTodosFromReducerState } from '../store/todos'
import { ingestBackendSkin } from '../theme/backend-skin'
import { type ChatMessage, textPart, toChatMessages } from '../upstream/lib/chat-messages'
import { reconnectBackoffDelayMs } from '../upstream/lib/reconnect-backoff'
import { type ConnectionState, JsonRpcGatewayError } from '../upstream/shared/json-rpc-gateway'
import type { HermesSkin } from '../upstream/shared/skin'
import type {
  GatewayReadyPayload,
  RpcEvent,
  SessionCreateResponse,
  SessionMessage,
  SessionResumeResponse
} from '../upstream/types/hermes'

import { DeltaFlushScheduler } from './delta-flush-scheduler'
import { buildGatewayWsUrl, createGatewaySocketFactory, type DialAuth, type DialTarget } from './dial'
import { MobileGateway, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from './mobile-gateway'
import {
  bindSession,
  createReducerState,
  type Effect,
  flushSessionDeltas,
  reduceGatewayEvent,
  type ReducerState,
  restorePendingRequestsFromResume,
  updateSession
} from './session-stream-reducer'

const DELTA_EVENT_TYPES = new Set(['message.delta', 'reasoning.delta'])

let gateway: MobileGateway | null = null
let reducerState: ReducerState = createReducerState()
let scheduler: DeltaFlushScheduler | null = null
let disposeEvents: (() => void) | null = null
let disposeLiveSyncEvents: (() => void) | null = null

const stateListeners = new Set<(state: ConnectionState) => void>()

/** Subscribe to the live gateway's connection state (idle/connecting/open/closed/error). */
export function onGatewayConnectionState(listener: (state: ConnectionState) => void): () => void {
  stateListeners.add(listener)

  return () => stateListeners.delete(listener)
}

function publishAll(): void {
  publishReducerState(reducerState)
  publishTodosFromReducerState(reducerState)
}

function flushDeltas(): void {
  const startedAt = Date.now()
  reducerState = flushSessionDeltas(reducerState)
  publishAll()
  scheduler?.reportFlushCost(Date.now() - startedAt)
}

/** Best-effort reconnect for a session the UI is (or was) actively looking
 *  at — the reducer's `hydrate` effect (session.reclaimed while active, or a
 *  turn recovered from a lost connection). Never throws; a final failure
 *  surfaces as a `notify` toast instead of an unhandled rejection. */
async function rehydrateSession(storedSessionId: string | null, attempts: number): Promise<void> {
  if (!storedSessionId) {
    return
  }

  const totalAttempts = Math.max(1, attempts)

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      await resumeSession(storedSessionId)

      return
    } catch (error) {
      if (attempt === totalAttempts - 1) {
        notify({
          type: 'notify',
          id: `hydrate-failed-${storedSessionId}`,
          kind: 'error',
          title: 'Reconnect failed',
          message: error instanceof Error ? error.message : String(error)
        })

        return
      }

      await new Promise(resolve => setTimeout(resolve, reconnectBackoffDelayMs(attempt)))
    }
  }
}

function dispatchEffects(effects: Effect[]): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'notify':
        notify(effect)

        break

      case 'scrollToBottom':
        requestScrollToBottom(effect.storedSessionId)

        break

      case 'refreshSessions':
        requestSessionListRefresh()

        break

      case 'hydrate':
        void rehydrateSession(effect.storedSessionId, effect.attempts ?? 1)

        break

      case 'setClarify':
        if (effect.storedSessionId) {
          setClarifyRequest(effect.storedSessionId, effect.request)

          if (effect.request) {
            void dispatchNativeNotification({
              body: effect.request.question,
              kind: 'input',
              sessionId: effect.storedSessionId,
              title: 'Hermes needs input'
            })
          }
        }

        break

      case 'setApproval':
        setApprovalRequest(effect.storedSessionId, effect.request)

        if (effect.request) {
          void dispatchNativeNotification({
            body: effect.request.command || effect.request.description,
            kind: 'approval',
            sessionId: effect.storedSessionId,
            title: 'Approval needed'
          })
        }

        break

      case 'setSudo':
        setSudoRequest(effect.storedSessionId, effect.request)

        if (effect.request) {
          void dispatchNativeNotification({
            body: 'A command needs your sudo password.',
            kind: 'input',
            sessionId: effect.storedSessionId,
            title: 'Hermes needs input'
          })
        }

        break

      case 'setSecret':
        setSecretRequest(effect.storedSessionId, effect.request)

        if (effect.request) {
          void dispatchNativeNotification({
            body: effect.request.prompt || effect.request.envVar,
            kind: 'input',
            sessionId: effect.storedSessionId,
            title: 'Hermes needs input'
          })
        }

        break

      case 'haptic':
        if (effect.kind === 'streamStart') {
          hapticStreamStart()
        } else {
          hapticSubmit()
        }

        break

      // No sound asset this app ships (M13 Step 6/D) — stays a no-op, documented in docs/PARITY.md.
      case 'sound':
        break
    }
  }
}

function handleGatewayEvent(event: RpcEvent): void {
  const { state, effects } = reduceGatewayEvent(reducerState, event)

  reducerState = state
  dispatchEffects(effects)

  if (DELTA_EVENT_TYPES.has(event.type)) {
    // Buffered by the reducer (session.pendingDeltas) — coalesced into a
    // single tail-only re-render by the scheduler instead of one publish per
    // delta (M06's perf criterion: no dropped frames on a 2k-message thread).
    scheduler?.schedule()
  } else {
    publishAll()
  }
}

/**
 * AGENTS.md "Credentials and reauth", applied to the WS close code directly
 * (mirrors `src/net/auth/ladder.ts`'s HTTP 401/403 classification exactly —
 * 4401/4403 are that rule's WS-close spelling):
 *   - 4401 (confirmed unauthorized) on token/password connections (M04) ->
 *     mark the connection `needsLogin` immediately — no silent refresh
 *     exists for either mode.
 *   - 4401 on an oauth connection (M08) -> `recoverOauthUnauthorizedClose`
 *     attempts one `refreshConnectionOAuth` first; only a refresh that
 *     fails (a confirmed dead refresh token, or one that can't be attempted
 *     right now) falls through to `needsLogin`.
 *   - 4403 (confirmed forbidden) -> left as an ordinary closed state, no
 *     login prompt. Forbidden means the credentials are fine but the action
 *     isn't permitted; a login screen cannot fix that.
 *   - Every other close code (timeout, 5xx-equivalent, connection refusal,
 *     a plain drop) -> also left as an ordinary closed state. Never a login
 *     prompt — the reconnect/backoff path (src/upstream/lib/
 *     reconnect-backoff.ts) owns retrying those, not this function.
 */
export function handleSocketClose(connection: MobileConnection, code: number): void {
  if (code !== 4401) {
    return
  }

  if (connection.authMode === 'oauth') {
    void recoverOauthUnauthorizedClose(connection)

    return
  }

  void updateActiveConnection(current => (current.id === connection.id ? { ...current, needsLogin: true } : current))
}

/** The oauth half of the 4401 branch above. A refresh that rotates the
 *  token doesn't itself reopen the socket — this redials via
 *  `ensureGatewayConnection()`, the same path M07's foreground-return probe
 *  uses; a failed redial here is swallowed exactly like it already is for
 *  that caller (the next foreground/network-restore event, or the user's
 *  own retry, tries again — this function has no fresher signal to act on
 *  than that one already does). */
async function recoverOauthUnauthorizedClose(connection: MobileConnection): Promise<void> {
  const refreshed = await refreshConnectionOAuth(connection.id, connection.baseUrl)

  if (!refreshed) {
    await updateActiveConnection(current => (current.id === connection.id ? { ...current, needsLogin: true } : current))

    return
  }

  await ensureGatewayConnection().catch(() => undefined)
}

async function resolveAuth(connection: MobileConnection): Promise<DialAuth> {
  if (connection.authMode === 'token') {
    const token = await getConnectionToken(connection.id)

    if (!token) {
      throw new Error('No stored session token for this connection')
    }

    return { mode: 'token', token }
  }

  // Password/OAuth (gated): mint a single-use WS ticket over the existing
  // cookie session (password) or bearer token (OAuth, M08) — browsers/RN
  // cannot set Authorization on a WebSocket upgrade, hence the ticket.
  // `ensureFreshOAuthAccessToken` is the proactive leg of M08's refresh
  // (expires_at - 60s): a token about to expire is rotated here, before the
  // ticket mint that would otherwise 401 and only then trigger the reactive
  // path above.
  const oauthAccessToken =
    connection.authMode === 'oauth' ? await ensureFreshOAuthAccessToken(connection.id, connection.baseUrl) : undefined

  try {
    const { ticket } = await httpRequest<{ ticket: string; ttl_seconds: number }>(
      connection.baseUrl,
      '/api/auth/ws-ticket',
      {
        credentials: 'include',
        method: 'POST',
        token: oauthAccessToken ?? undefined
      }
    )

    return { mode: 'ticket', ticket }
  } catch (error) {
    await flagOauthSessionExpiredIfConfirmed(connection, error)

    throw error
  }
}

/**
 * Pre-connect mirror of `handleSocketClose`'s 4401 oauth branch above — added
 * for M08 Defect 1: when the refresh token is already dead, the proactive
 * `ensureFreshOAuthAccessToken` call returns null, this ws-ticket mint 401s,
 * `ensureGatewayConnection()` rejects, and **no socket ever opens** — so
 * `handleSocketClose` never runs and `needsLogin` was never reached. This is
 * the common path: a refresh token dies while the app is closed, and the
 * user opens it later with nothing but a Retry button that can never
 * succeed.
 *
 * Only flips `needsLogin` when the refresh attempt above already *confirmed*
 * the session is gone — `token-refresh.ts`'s `doRefresh` clears the stored
 * OAuth session on a confirmed 401 `session_expired`, but leaves it
 * untouched on a merely unreachable provider (503/timeout). This function
 * reads that same stored session back rather than trusting the ws-ticket
 * call's own 401 (which fires either way once there is no bearer token to
 * send) — AGENTS.md requires a transient failure never trigger a login
 * prompt, and `nextReauthAction`'s "second unauthorized after refresh means
 * the session is genuinely gone" only holds once the refresh itself is
 * confirmed exhausted.
 */
async function flagOauthSessionExpiredIfConfirmed(connection: MobileConnection, error: unknown): Promise<void> {
  if (connection.authMode !== 'oauth' || !(error instanceof HttpError) || error.status !== 401) {
    return
  }

  const stillStored = await getConnectionOAuth(connection.id)

  if (stillStored) {
    return
  }

  await updateActiveConnection(current => (current.id === connection.id ? { ...current, needsLogin: true } : current))
}

/** Establish the one live gateway connection for the active `MobileConnection`.
 *  A no-op (returns the existing socket) if one is already open. */
export async function ensureGatewayConnection(): Promise<MobileGateway> {
  if (gateway && gateway.connectionState === 'open') {
    return gateway
  }

  const connection = getActiveConnection()

  if (!connection) {
    throw new Error('No active connection — add one first')
  }

  const auth = await resolveAuth(connection)

  const headers =
    connection.headerNames && connection.headerNames.length > 0
      ? await getConnectionHeaders(connection.id, connection.headerNames)
      : undefined

  const baseUrl = new URL(connection.baseUrl)

  const target: DialTarget = {
    host: baseUrl.host,
    protocol: baseUrl.protocol === 'https:' ? 'https:' : 'http:',
    profile: connection.provider
  }

  disposeEvents?.()
  disposeLiveSyncEvents?.()
  gateway?.close()

  const instance = new MobileGateway({
    onSocketClose: event => {
      handleSocketClose(connection, event.code)

      return false
    },
    socketFactory: createGatewaySocketFactory(auth, headers)
  })

  disposeEvents = instance.onAny(handleGatewayEvent)

  // M10: global `*.changed` broadcasts (tui_gateway/change_watcher.py) have
  // no session_id and nothing for the reducer to route them to — a plain
  // tick per event, same shape as apps/desktop's store/live-sync.ts, is all
  // the cron/webhooks/channels screens need to know "go refetch".
  const offCron = instance.on('cron.changed', () => notifyCronChanged())
  const offPlatforms = instance.on('platforms.changed', () => notifyPlatformsChanged())
  const offPairing = instance.on('pairing.changed', () => notifyPairingChanged())

  // M13: skin sync (D14). `gateway.ready`'s embedded skin seeds the registry
  // without repainting (a fresh connect must never override a persisted user
  // pick); `skin.changed` is the live broadcast that does repaint. Mirrors
  // apps/desktop/src/app/session/hooks/use-message-stream/gateway-event/
  // lifecycle.ts's two `ingestBackendSkin` calls.
  const offReady = instance.on<GatewayReadyPayload>('gateway.ready', event => {
    ingestBackendSkin(event.payload?.skin as HermesSkin | undefined, { apply: false })
  })

  const offSkinChanged = instance.on<HermesSkin>('skin.changed', event => {
    ingestBackendSkin(event.payload, { apply: true })
  })

  disposeLiveSyncEvents = () => {
    offCron()
    offPlatforms()
    offPairing()
    offReady()
    offSkinChanged()
  }

  instance.onState(state => {
    for (const listener of stateListeners) {
      listener(state)
    }
  })

  scheduler ??= new DeltaFlushScheduler({ flush: flushDeltas })
  gateway = instance

  await instance.connect(buildGatewayWsUrl(target, auth))

  return instance
}

function requireGateway(): MobileGateway {
  if (!gateway) {
    throw new Error('Not connected to a Hermes gateway')
  }

  return gateway
}

/**
 * Generic RPC escape hatch for callers outside the chat screen that have no
 * session to address — M10's `src/api/projects.ts` (`projects.*`,
 * tui_gateway/methods_projects.py), which is per-profile, not per-session.
 * Dials first if nothing is open yet (mirrors `createSession`'s own
 * `ensureGatewayConnection()` call) rather than requiring a chat screen to
 * have opened the socket first.
 */
export async function gatewayRequest<T>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs?: number
): Promise<T> {
  const client = await ensureGatewayConnection()

  return client.request<T>(method, params, timeoutMs)
}

/**
 * M07's `AppLifecycle` `reconnectAndProbe` callback (foreground return,
 * network restored): `ensureGatewayConnection()` is a no-op if the socket
 * survived the background grace, otherwise redials — either way the
 * `ping` RPC below is the half-open probe (a socket that looks open but
 * whose peer silently vanished won't error until something tries to use
 * it). Never throws: "no active connection yet" (fresh install, still on
 * the connect screen) and a failed dial are both legitimate outcomes the
 * ordinary reconnect-backoff/socket-close handling already owns — surfacing
 * them here a second time would just be a duplicate error path.
 */
export async function reconnectAndProbeGateway(): Promise<void> {
  let client: MobileGateway

  try {
    client = await ensureGatewayConnection()
  } catch {
    // Dial itself failed — connect()'s own error handling already leaves the
    // instance out of 'open', so the next ensureGatewayConnection() call
    // (whichever lifecycle event triggers it) retries fresh. Nothing here to
    // invalidate.
    return
  }

  try {
    await client.request('ping', {}, 5_000)
  } catch {
    // The probe just proved this exact instance is dead — a half-open
    // socket that still reports connectionState 'open' (no close/error
    // event ever fired: a stale Wi-Fi AP, a NAT timeout, or the OS silently
    // reclaiming a backgrounded app's transport) but never answers. A ping
    // timeout does NOT run the client's own close handling — `request()`'s
    // timeout branch only rejects that one pending call — so without
    // invalidating here this same broken instance keeps being handed out by
    // every `requireGateway()`-based RPC (attach, submit, ...) forever, each
    // one silently hanging for its own timeout (30 s / 30 min) instead of
    // failing visibly. Invalidate so `connectionState` stops lying about
    // 'open', then redial right now rather than waiting for the next
    // foreground/network-restore event to notice — a failed redial here is
    // swallowed the same as a failed dial above.
    client.invalidate()
    await ensureGatewayConnection().catch(() => undefined)
  }
}

/** The wire-level runtime id currently bound to `storedSessionId`, or the
 *  stored id itself when nothing has bound it yet — mirrors the reducer's own
 *  "placeholder key" convention (session-keys.ts): a session this client just
 *  created has no runtime->stored mapping until its first `session.info`, so
 *  RPCs addressed by the caller's stored id fall through to it unchanged,
 *  which is exactly the runtime id `session.create` minted. */
function runtimeIdForStored(storedSessionId: string): string {
  for (const [runtimeId, stored] of reducerState.runtimeToStored) {
    if (stored === storedSessionId) {
      return runtimeId
    }
  }

  return storedSessionId
}

function seedSessionMessages(storedSessionId: string, messages: SessionMessage[] | undefined): void {
  if (!messages?.length) {
    return
  }

  const chatMessages = toChatMessages(messages)
  reducerState = updateSession(reducerState, storedSessionId, session => ({ ...session, messages: chatMessages })).state
}

/** Start a brand-new session (no session-list screen exists yet — M07 — so
 *  this is also today's only way to reach a chat). Binds it as the active
 *  session and returns its stored id for navigation.
 *
 *  `profile` defaults to the active profile atom (M09: "`session.create`'s
 *  `profile`" — `tui_gateway/methods_session.py`'s `session.create` handler
 *  reads `params["profile"]` independently of the socket's own dial-time
 *  scope, exactly like a REST call's `?profile=` overrides that default for
 *  one request) — an explicit `params.profile` (e.g. a caller creating a
 *  session in a specific profile regardless of what's active) still wins. */
export async function createSession(params: { cwd?: string; profile?: string; title?: string } = {}): Promise<string> {
  const client = await ensureGatewayConnection()
  const profile = params.profile ?? getActiveProfile()

  const response = await client.request<SessionCreateResponse>('session.create', {
    source: 'android',
    ...params,
    ...(profile ? { profile } : {})
  })

  const storedId = response.stored_session_id ?? response.session_id

  reducerState = bindSession(reducerState, response.session_id, storedId, { makeActive: true })
  seedSessionMessages(storedId, response.messages)
  publishAll()

  return storedId
}

/** Resume an existing stored session — the normal way to open a chat screen,
 *  and how the `hydrate` effect recovers after a reclaim or lost connection.
 *  Both reconnect branches (inside the server's orphan grace, and after a
 *  `session.reclaimed`) call this the same way, so pending-request restore
 *  (D10.2) runs identically on either. */
export async function resumeSession(storedSessionId: string): Promise<string> {
  const client = await ensureGatewayConnection()
  const response = await client.request<SessionResumeResponse>('session.resume', { session_id: storedSessionId })

  reducerState = bindSession(reducerState, response.session_id, storedSessionId, { makeActive: true })
  seedSessionMessages(storedSessionId, response.messages)

  const restored = restorePendingRequestsFromResume(reducerState, storedSessionId, response)

  reducerState = restored.state
  dispatchEffects(restored.effects)
  publishAll()

  return storedSessionId
}

/**
 * "Honor `gateway.capabilities.per_session_exclusive_submit`" (M07 task
 * line): the server enforces a per-session active-writer lease on every
 * `prompt.submit` (`tui_gateway/session_lifecycle.py`'s
 * `_ensure_active_session_slot`) and rejects a submit from a second
 * connection with JSON-RPC error 4090 and a `data.reason` of
 * `SESSION_NOT_OWNED` (another surface — desktop, TUI — is actively driving
 * this session right now), `MAX_CONCURRENT_SESSIONS`, or
 * `SESSION_COORDINATION_UNAVAILABLE`. No client in this app calls
 * `gateway.capabilities` to check the flag ahead of time (nothing branches on
 * it — it's always true in practice, and there's no cheaper way to find out
 * than trying); "honoring" it here means recognizing the rejection when it
 * happens and telling the user something true ("open elsewhere") instead of
 * a generic RPC-failure toast.
 */
function describeSubmitError(error: unknown): unknown {
  if (!(error instanceof JsonRpcGatewayError) || error.code !== 4090) {
    return error
  }

  const reason = (error.data as { reason?: unknown } | undefined)?.reason

  if (reason === 'SESSION_NOT_OWNED') {
    return new Error('This session is open elsewhere right now — try again once the other client is done.')
  }

  if (reason === 'MAX_CONCURRENT_SESSIONS') {
    return new Error('Too many sessions are active at once. Close one and try again.')
  }

  return new Error('Could not claim this session right now. Try again in a moment.')
}

/**
 * The reducer deliberately does not own the optimistic user-message insert
 * (session-stream/steer-arrival-order.test.ts's own doc comment: that's the
 * desktop's `redirectPrompt`-shaped UI-layer concern, not wire-protocol
 * state) — nothing on the wire echoes the user's own submitted text back as
 * an event, so without this the bubble the user just typed would never
 * appear until the reply arrives. Appended directly here, then flipped off
 * `pending` once the RPC ack lands (server accepted the turn) or dropped
 * entirely if the RPC itself fails (nothing to show for a submit that never
 * reached the server).
 */
export async function submitPrompt(
  storedSessionId: string,
  text: string,
  attachmentRefs: string[] = []
): Promise<void> {
  const prompt = [text, ...attachmentRefs].filter(Boolean).join('\n')
  const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now() / 1000

  const optimisticMessage: ChatMessage = {
    id: optimisticId,
    parts: [textPart(text, now)],
    pending: true,
    role: 'user',
    timestamp: now,
    ...(attachmentRefs.length > 0 ? { attachmentRefs } : {})
  }

  reducerState = updateSession(reducerState, storedSessionId, session => ({
    ...session,
    messages: [...session.messages, optimisticMessage]
  })).state
  publishAll()

  try {
    await requireGateway().request(
      'prompt.submit',
      { session_id: runtimeIdForStored(storedSessionId), text: prompt },
      PROMPT_SUBMIT_REQUEST_TIMEOUT_MS
    )

    reducerState = updateSession(reducerState, storedSessionId, session => ({
      ...session,
      messages: session.messages.map(message =>
        message.id === optimisticId ? { ...message, pending: false } : message
      )
    })).state
    publishAll()
  } catch (error) {
    reducerState = updateSession(reducerState, storedSessionId, session => ({
      ...session,
      messages: session.messages.filter(message => message.id !== optimisticId)
    })).state
    publishAll()
    throw describeSubmitError(error)
  }
}

export async function stopTurn(storedSessionId: string): Promise<void> {
  await requireGateway().request('session.interrupt', { session_id: runtimeIdForStored(storedSessionId) })
}

/** Mid-turn correction that redirects the active model turn (the composer's
 *  "steer" action) — apps/desktop's own composer calls the same RPC. */
export async function steerTurn(storedSessionId: string, text: string): Promise<void> {
  await requireGateway().request('session.redirect', { session_id: runtimeIdForStored(storedSessionId), text })
}

export async function askBtw(storedSessionId: string, text: string): Promise<void> {
  await requireGateway().request('prompt.btw', { session_id: runtimeIdForStored(storedSessionId), text })
}

export async function compressSession(storedSessionId: string): Promise<void> {
  await requireGateway().request('session.compress', { session_id: runtimeIdForStored(storedSessionId) }, 120_000)
}

export async function renameSession(storedSessionId: string, title: string): Promise<void> {
  await requireGateway().request('session.title', { session_id: runtimeIdForStored(storedSessionId), title })
}

/** The generic fallback for a `/command` `mobile-slash-commands.ts` doesn't
 *  special-case (quick commands, plugin commands, skills, and every other
 *  server-registered built-in) — mirrors the TUI's own slash worker path. */
export async function execSlashCommand(storedSessionId: string, command: string): Promise<string> {
  const result = await requireGateway().request<{ output?: string }>('slash.exec', {
    command,
    session_id: runtimeIdForStored(storedSessionId)
  })

  return result.output ?? ''
}

export async function respondApproval(
  storedSessionId: string,
  choice: string,
  options: { requestId?: string; all?: boolean } = {}
): Promise<void> {
  await requireGateway().request('approval.respond', {
    all: options.all ?? false,
    choice,
    request_id: options.requestId,
    session_id: runtimeIdForStored(storedSessionId)
  })
  setApprovalRequest(storedSessionId, null)
}

/** `question_id` present -> one answer in a batch clarify; the card stays
 *  open (server keeps every question editable) until the response reports no
 *  `remaining` questions. Absent -> the single-question form, cleared right away. */
export async function respondClarify(
  storedSessionId: string,
  requestId: string,
  answer: string,
  questionId?: string
): Promise<void> {
  const result = await requireGateway().request<{ status: string; remaining?: string[] }>('clarify.respond', {
    answer,
    request_id: requestId,
    session_id: runtimeIdForStored(storedSessionId),
    ...(questionId ? { question_id: questionId } : {})
  })

  if (!questionId || result.remaining?.length === 0) {
    setClarifyRequest(storedSessionId, null)
  }
}

export async function respondSudo(storedSessionId: string, requestId: string, password: string): Promise<void> {
  await requireGateway().request('sudo.respond', {
    password,
    request_id: requestId,
    session_id: runtimeIdForStored(storedSessionId)
  })
  setSudoRequest(storedSessionId, null)
}

export async function respondSecret(storedSessionId: string, requestId: string, value: string): Promise<void> {
  await requireGateway().request('secret.respond', {
    request_id: requestId,
    session_id: runtimeIdForStored(storedSessionId),
    value
  })
  setSecretRequest(storedSessionId, null)
}

export interface AttachImageResult {
  attached: boolean
  path: string
  text?: string
  [key: string]: unknown
}

/** `content_base64` accepts raw base64 OR a `data:...;base64,` wrapper —
 *  tui_gateway/prompt_attachments.py's `_b64_payload` strips the wrapper when
 *  present and decodes as-is otherwise. 25 MiB cap (server-enforced, 4018). */
export async function attachImageBytes(
  storedSessionId: string,
  contentBase64: string,
  filename?: string
): Promise<AttachImageResult> {
  return requireGateway().request('image.attach_bytes', {
    content_base64: contentBase64,
    filename,
    session_id: runtimeIdForStored(storedSessionId)
  })
}

export interface AttachFileResult {
  attached: boolean
  name: string
  ref_text: string
  uploaded: boolean
  [key: string]: unknown
}

export async function attachFile(storedSessionId: string, dataUrl: string, name?: string): Promise<AttachFileResult> {
  return requireGateway().request('file.attach', {
    data_url: dataUrl,
    name,
    session_id: runtimeIdForStored(storedSessionId)
  })
}

export interface AttachPdfResult {
  attached: boolean
  filename: string
  pages_attached: number
  text: string
  [key: string]: unknown
}

/**
 * 50 MiB cap, 25 pages/call (server-enforced). Requires `pdftoppm`
 * (poppler-utils) on the SERVER — a server without it fails every call with
 * error 5028 "pdftoppm not installed"; this client cannot detect that ahead
 * of time (no capability probe on the wire), so callers must surface a 5028
 * as "PDF attachments aren't available on this server", not a generic error.
 */
export async function attachPdf(
  storedSessionId: string,
  contentBase64: string,
  filename?: string
): Promise<AttachPdfResult> {
  return requireGateway().request(
    'pdf.attach',
    { content_base64: contentBase64, filename, session_id: runtimeIdForStored(storedSessionId) },
    130_000
  )
}

export async function commandsCatalog(): Promise<Record<string, unknown>> {
  return requireGateway().request('commands.catalog', {})
}

export interface SlashCompletionItem {
  display: string
  kind: 'command' | 'skill'
  meta: string
  text: string
}

export async function completeSlash(text: string): Promise<SlashCompletionItem[]> {
  const result = await requireGateway().request<{ items?: SlashCompletionItem[] }>('complete.slash', { text })

  return result.items ?? []
}

export interface PathCompletionItem {
  display: string
  meta: string
  text: string
}

/** `@`-file/folder reference completion. `word` is the active `@`-token
 *  (e.g. `@`, `@file:src/`, `@src/index`); each item's `text` is the full
 *  replacement token (`@file:src/index.ts`), same shape as `complete.slash`'s
 *  items (`tui_gateway/methods_complete.py`'s shared `_item()` helper). */
export async function completePath(word: string): Promise<PathCompletionItem[]> {
  const result = await requireGateway().request<{ items?: PathCompletionItem[] }>('complete.path', { word })

  return result.items ?? []
}

/** Test-only: reset every module-level singleton between tests. */
export function resetSessionConnectionForTests(): void {
  disposeEvents?.()
  disposeEvents = null
  disposeLiveSyncEvents?.()
  disposeLiveSyncEvents = null
  gateway?.close()
  gateway = null
  reducerState = createReducerState()
  scheduler?.dispose()
  scheduler = null
  stateListeners.clear()
}

/** Test-only: inject a fake in place of the real dialed `MobileGateway`, so
 *  the RPC-calling functions (`submitPrompt`, `respondApproval`, ...) can be
 *  exercised against a fake `request`/`close` without a real socket. */
export function setGatewayForTests(fake: MobileGateway | null): void {
  gateway = fake
}

/** Test-only: seed `reducerState` directly (e.g. via `bindSession` +
 *  `createReducerState`) so a test can call an RPC function against a known
 *  session without going through `createSession`/`resumeSession`. */
export function setReducerStateForTests(state: ReducerState): void {
  reducerState = state
  publishAll()
}
