import type { ChatMessage } from '../../upstream/lib/chat-messages'
import type { TodoItem } from '../../upstream/lib/todos'
import type { UsageStats } from '../../upstream/types/hermes'

/** Structured billing-wall descriptor forwarded on a failed turn (mirrors the
 *  desktop's inlined @hermes/shared BillingBlock — see M02's types.ts patch). */
export interface BillingBlock {
  provider: string
  provider_label: string
  model: string
  billing_url: string | null
  is_nous: boolean
  message: string
}

/**
 * Per-session runtime state, keyed by the **stored** session id (never the
 * runtime id — AGENTS.md "State", decision D2). A faithful trim of the
 * desktop's `ClientSessionState` (apps/desktop/src/app/types.ts): dropped
 * `transcriptAuthorityEpoch` / `transcriptProvenance`, which exist only to
 * arbitrate REST-pagination authority across the desktop's multi-window tile
 * cache — this client has one screen per session and no pagination-authority
 * race to arbitrate. `title` and `compacting`/`billingBlock` are added because
 * their desktop equivalents live in separate global stores this reducer does
 * not own (`$sessions`, `$compaction`, `$billingBlock`); folding them into the
 * per-session record keeps this reducer self-contained.
 */
export interface SessionState {
  storedSessionId: string | null
  title: string
  messages: ChatMessage[]
  branch: string
  cwd: string
  model: string
  provider: string
  reasoningEffort: string
  serviceTier: string
  fast: boolean
  yolo: boolean
  personality: string
  busy: boolean
  awaitingResponse: boolean
  streamId: string | null
  sawAssistantPayload: boolean
  /** This client picked up a turn it did not start — resumed onto a session
   *  already running elsewhere. See desktop's identical field for the reason
   *  a turn like this must hydrate from stored history when it settles. */
  adoptedRunningTurn: boolean
  pendingBranchGroup: string | null
  interrupted: boolean
  interimBoundaryPending: boolean
  /** A blocking clarify/approval/sudo/secret prompt is waiting on the user. */
  needsInput: boolean
  /** requestId of the clarify request currently parked for this session, or
   *  null. The full request is effect-driven (`setClarify`, held by the
   *  `clarify` store) — this is tracked here too, minimally, only so
   *  `clarify.expire` can tell a stale expiry (an older, already-answered
   *  request) apart from the live one, exactly as the desktop's
   *  `$clarifyRequests` correlation does. */
  pendingClarifyRequestId: string | null
  /** Same correlation purpose as `pendingClarifyRequestId`, for `sudo.expire` /
   *  `secret.expire` — the server emits both (`_EXPIRING_REQUESTS` in
   *  `tui_gateway/server.py`) on its 300s default block timeout, but a late
   *  expire from an older, already-superseded request must not clear a
   *  newer one raised since. */
  pendingSudoRequestId: string | null
  pendingSecretRequestId: string | null
  turnStartedAt: number | null
  turnLive: boolean
  usage: null | UsageStats
  /** status.update kind "compacting"/"compacted" for this session's active turn. */
  compacting: boolean
  billingBlock: BillingBlock | null
  /** Live todo list from the `todo` tool (todo.updated / tool.* with name="todo").
   *  Cleared when the turn ends without a final update — see AGENTS.md-style
   *  rationale in tools.ts. */
  todos: TodoItem[]
  /** Watermark guarding `todos` against an out-of-order snapshot (mirrors the
   *  desktop's `$todoRevisionsBySession`) — `tool.start` carries no revision
   *  and always applies; `todo.updated` / `tool.complete` do, and a lower one
   *  than already applied is dropped. */
  todosRevision: number | null
}

export function createSessionState(storedSessionId: string | null = null, messages: ChatMessage[] = []): SessionState {
  return {
    storedSessionId,
    title: '',
    messages,
    branch: '',
    cwd: '',
    model: '',
    provider: '',
    reasoningEffort: '',
    serviceTier: '',
    fast: false,
    yolo: false,
    personality: '',
    busy: false,
    awaitingResponse: false,
    streamId: null,
    sawAssistantPayload: false,
    adoptedRunningTurn: false,
    pendingBranchGroup: null,
    interrupted: false,
    interimBoundaryPending: false,
    needsInput: false,
    pendingClarifyRequestId: null,
    pendingSudoRequestId: null,
    pendingSecretRequestId: null,
    turnStartedAt: null,
    turnLive: false,
    usage: null,
    compacting: false,
    billingBlock: null,
    todos: [],
    todosRevision: null
  }
}

/** One buffered, not-yet-applied text chunk — the pure-data half of the
 *  desktop's `QueuedStreamDelta` (apps/desktop .../use-message-stream/index.ts).
 *  The reducer stores these in its own state (see `pendingDeltas`) instead of
 *  applying every delta to `messages` immediately; `flushSessionDeltas` (in
 *  session-stream-reducer.ts) is the only thing that turns them into a
 *  `messages` mutation. Timing/scheduling of that flush lives entirely outside
 *  the reducer, in `delta-flush-scheduler.ts` — the reducer itself never reads
 *  a clock. */
export interface QueuedDelta {
  occurredAt: number
  text: string
  channel: 'assistant' | 'reasoning'
}

/**
 * Everything the reducer needs across the whole event stream, keyed by
 * **stored** session id. `runtimeToStored` is the map AGENTS.md's "State"
 * section calls for: runtime ids die on backend restart or orphan reap, so
 * every wire-level `session_id` (a runtime id) is resolved through this map
 * before touching `sessions`. Until a stored id is known for a runtime id
 * (the gap between a fresh `session.create` and its first `session.info`),
 * the runtime id is used as its own placeholder key — see `bindSession` /
 * `rebindSessionKey` in session-stream-reducer.ts.
 */
export interface ReducerState {
  sessions: Map<string, SessionState>
  runtimeToStored: Map<string, string>
  /** The runtime id of the session currently on screen, or null. Mirrors the
   *  desktop's `activeSessionIdRef` — routing (`resolveGatewayEventSessionId`)
   *  operates in runtime-id space because that's what the wire's `session_id`
   *  is. */
  activeRuntimeSessionId: string | null
  /** Unscoped-stream pin (message.start -> ... -> message.complete/error),
   *  runtime-id space — see src/upstream/lib/gateway-events.ts. */
  unscopedStreamRuntimeSessionId: string | null
  /** Stored ids whose active turn auto-compacted; mirrors the desktop's
   *  compactedTurnRef (Set<sessionId>), but in stored-id space so it survives
   *  a runtime rebind. */
  compactedTurns: Set<string>
  /** Buffered, not-yet-flushed message/reasoning deltas, by stored id. */
  pendingDeltas: Map<string, QueuedDelta[]>
  /** The most recent `gateway.ready` payload's `replay_epoch` (M07). The
   *  transport layer (json-rpc-gateway.ts) already resets its OWN per-session
   *  seq watermarks when this changes — a backend restart, not just a normal
   *  reconnect — but the app layer still needs to know: the reconnected
   *  session's `session.resume` reply IS the fresh state, and every runtime
   *  id this client is holding onto belongs to the backend process that no
   *  longer exists. `null` until the first `gateway.ready` (never itself a
   *  "changed" event — nothing to compare against yet). */
  lastReplayEpoch: null | string
}

export function createReducerState(): ReducerState {
  return {
    sessions: new Map(),
    runtimeToStored: new Map(),
    activeRuntimeSessionId: null,
    unscopedStreamRuntimeSessionId: null,
    compactedTurns: new Set(),
    pendingDeltas: new Map(),
    lastReplayEpoch: null
  }
}

export interface ClarifyQuestion {
  /** Server-generated wire id (q0..qN) — clarify.respond keys answers by it. */
  qid: string
  question: string
  choices: string[] | null
  multiSelect: boolean
}

export interface ClarifyRequest {
  requestId: string
  storedSessionId: string | null
  question: string
  choices: string[] | null
  multiSelect: boolean
  /** Batch (multi-question) clarify: present instead of question/choices. */
  questions: ClarifyQuestion[]
  /** Answers already locked server-side (reconnect replay): qid -> answer. */
  lockedAnswers?: Record<string, string>
  receivedAt: number
}

export interface ApprovalRequest {
  requestId?: string
  storedSessionId: string | null
  command: string
  description: string
  allowPermanent: boolean
  choices?: string[]
  smartDenied: boolean
}

export interface SudoRequest {
  requestId: string
  storedSessionId: string | null
  /** D32: the RUNTIME session id this request arrived under (`ctx.runtimeSessionId`
   *  at the time the `sudo.request` event was routed) — sudo/secret have no
   *  resume field upstream at all (unlike approval/clarify), so a resume
   *  reconcile's only way to tell "this card is still good" from "the
   *  server-side session that raised it is gone" is comparing this against
   *  the resume response's own `session_id`. A cold resume always mints a
   *  new one, so a stale card is provably dead even though nothing told the
   *  client so directly. */
  runtimeSessionId: string | null
}

export interface SecretRequest {
  requestId: string
  storedSessionId: string | null
  envVar: string
  prompt: string
  /** Same purpose as `SudoRequest.runtimeSessionId` — see its doc comment. */
  runtimeSessionId: string | null
}

/**
 * Effects are data, not callbacks (AGENTS.md / M05): the reducer describes
 * what should happen and returns, and something outside it — a store module,
 * the connection layer, a later milestone's UI — decides how. None of these
 * carry a function value.
 */
export type Effect =
  | {
      type: 'notify'
      id: string
      kind: 'info' | 'warning' | 'error'
      title: string
      message: string
      durationMs?: number
    }
  | { type: 'scrollToBottom'; storedSessionId: string }
  | { type: 'refreshSessions' }
  | { type: 'hydrate'; storedSessionId: string | null; runtimeSessionId: string | null; attempts?: number }
  | { type: 'setClarify'; storedSessionId: string | null; request: ClarifyRequest | null }
  | { type: 'setApproval'; storedSessionId: string | null; request: ApprovalRequest | null }
  | { type: 'setSudo'; storedSessionId: string | null; request: SudoRequest | null }
  | { type: 'setSecret'; storedSessionId: string | null; request: SecretRequest | null }
  | { type: 'haptic'; kind: 'streamStart' | 'submit' }
  | { type: 'sound'; kind: 'completion' }

export interface ReduceResult {
  state: ReducerState
  effects: Effect[]
}
