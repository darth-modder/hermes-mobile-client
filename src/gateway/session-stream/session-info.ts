// Pure port of apps/desktop's gateway-event/session-info.ts: session.info /
// session.usage / session.title.
//
// Dropped relative to the desktop handler — all desktop-only surfaces:
//   - Global "currently viewed" mirrors ($currentCwd, $currentModel, ...) and
//     the cwd-follow / workspace-owner claim (local-fs project tracking,
//     AGENTS.md "Machine features don't exist here"). This client reads
//     model/provider/cwd/etc straight off the per-session state below, so
//     there is no separate global cache to gate updates to with desktop's
//     `apply`/`sessionInfoDescribesSelectedSession` machinery — every
//     session-scoped field in `sessionInfoStatePatch` always applies to ITS
//     OWN session, exactly like the desktop's own (non-apply-gated)
//     `updateSessionState` call for the same patch.
//   - `approval_mode` reconciliation (profile-scoped desktop settings sync),
//     model-options query invalidation (no query client here), install-method
//     / credential-warning onboarding prompts.
//   - `maybeRebindPaneToRebuiltRuntime` (#93942): re-attaching the active pane
//     to a runtime rebuilt mid-conversation under a new session_id. Real
//     desktop scenario, but multi-window-shaped and not required by any M05
//     fixture — left for M06/M07 if it turns out to matter for a single-pane
//     client too.
//
// The turn-settle logic below (running=true/false edge, the
// PRE_TURN_LIVE_SETTLE_GRACE_MS bounded wait) is ported verbatim: it is the
// ONLY thing that can release a session whose message.complete never arrives
// (gateway crash, reconnect gap), and it must reach every session, not just
// the active one — see stale-pending-settle fixture.

import type { GatewayEventPayload } from '../../upstream/lib/chat-messages'

import { type FamilyHandler, handled, notHandled } from './context'
import { updateSession } from './session-keys'
import { normalizePersonalityValue } from './text-coercion'
import { finalizeInterruptedMessages } from './turn-helpers'
import type { Effect, ReducerState, SessionState } from './types'

// See utils.ts's identical constant in the desktop source for the full
// reasoning; ported verbatim (`use-message-stream/utils.ts:99-112`).
const PRE_TURN_LIVE_SETTLE_GRACE_MS = 15_000

type SessionInfoPatch = Partial<
  Pick<
    SessionState,
    'branch' | 'cwd' | 'fast' | 'model' | 'personality' | 'provider' | 'reasoningEffort' | 'serviceTier' | 'yolo'
  >
>

function sessionInfoStatePatch(payload: GatewayEventPayload | undefined): SessionInfoPatch {
  const patch: SessionInfoPatch = {}

  if (typeof payload?.model === 'string') {
    patch.model = payload.model || ''
  }

  if (typeof payload?.provider === 'string') {
    patch.provider = payload.provider || ''
  }

  if (typeof payload?.cwd === 'string') {
    patch.cwd = payload.cwd
  }

  if (typeof payload?.branch === 'string') {
    patch.branch = payload.branch
  }

  if (typeof payload?.personality === 'string') {
    patch.personality = normalizePersonalityValue(payload.personality)
  }

  if (typeof payload?.reasoning_effort === 'string') {
    patch.reasoningEffort = payload.reasoning_effort
  }

  if (typeof payload?.service_tier === 'string') {
    patch.serviceTier = payload.service_tier
  }

  if (typeof payload?.fast === 'boolean') {
    patch.fast = payload.fast
  }

  if (typeof payload?.yolo === 'boolean') {
    patch.yolo = payload.yolo
  }

  return patch
}

function applySessionInfoStatePatch(session: SessionState, patch: SessionInfoPatch): SessionState {
  if (
    (patch.branch === undefined || patch.branch === session.branch) &&
    (patch.cwd === undefined || patch.cwd === session.cwd) &&
    (patch.fast === undefined || patch.fast === session.fast) &&
    (patch.model === undefined || patch.model === session.model) &&
    (patch.personality === undefined || patch.personality === session.personality) &&
    (patch.provider === undefined || patch.provider === session.provider) &&
    (patch.reasoningEffort === undefined || patch.reasoningEffort === session.reasoningEffort) &&
    (patch.serviceTier === undefined || patch.serviceTier === session.serviceTier) &&
    (patch.yolo === undefined || patch.yolo === session.yolo)
  ) {
    return session
  }

  return { ...session, ...patch }
}

function applyRunningTransition(
  session: SessionState,
  payload: GatewayEventPayload,
  occurredAt: number
): { session: SessionState; recoveredIncompleteTurn: boolean } {
  const busy = Boolean(payload.running)

  if (session.busy === busy && (busy || !session.awaitingResponse)) {
    return { session, recoveredIncompleteTurn: false }
  }

  if (busy) {
    if (session.interrupted) {
      return { session, recoveredIncompleteTurn: false }
    }

    const gatewayTurnStartedAt =
      typeof payload.turn_started_at === 'number' && payload.turn_started_at > 0 ? payload.turn_started_at * 1000 : null

    return {
      session: {
        ...session,
        busy,
        turnLive: true,
        turnStartedAt: session.turnStartedAt ?? gatewayTurnStartedAt ?? Date.now()
      },
      recoveredIncompleteTurn: false
    }
  }

  const armedAt = session.turnStartedAt
  const withinPreStartGrace = typeof armedAt === 'number' && Date.now() - armedAt < PRE_TURN_LIVE_SETTLE_GRACE_MS

  if (session.awaitingResponse && !session.sawAssistantPayload && !session.turnLive && withinPreStartGrace) {
    return { session, recoveredIncompleteTurn: false }
  }

  const recoveredIncompleteTurn = session.turnLive

  return {
    session: {
      ...session,
      awaitingResponse: false,
      busy,
      messages: finalizeInterruptedMessages(session.messages, session.streamId, occurredAt),
      pendingBranchGroup: null,
      streamId: null,
      turnStartedAt: null,
      turnLive: false
    },
    recoveredIncompleteTurn
  }
}

export const handleSessionInfoEvent: FamilyHandler = (state, ctx) => {
  const { event, payload, storedSessionId, runtimeSessionId, occurredAt } = ctx

  if (event.type === 'session.info') {
    let next: ReducerState = state
    const effects: Effect[] = []

    if (storedSessionId) {
      const statePatch = sessionInfoStatePatch(payload)

      if (Object.keys(statePatch).length > 0) {
        next = updateSession(next, storedSessionId, session => applySessionInfoStatePatch(session, statePatch)).state
      }

      if (typeof payload?.running === 'boolean') {
        let recoveredIncompleteTurn = false

        next = updateSession(next, storedSessionId, session => {
          const result = applyRunningTransition(session, payload, occurredAt)

          recoveredIncompleteTurn = result.recoveredIncompleteTurn

          return result.session
        }).state

        if (recoveredIncompleteTurn) {
          effects.push({ type: 'refreshSessions' })
          effects.push({ type: 'hydrate', storedSessionId, runtimeSessionId, attempts: 3 })
        }
      }
    }

    return handled(next, effects)
  }

  if (event.type === 'session.usage') {
    if (!storedSessionId || !payload?.usage) {
      return handled(state)
    }

    const next = updateSession(state, storedSessionId, session => ({
      ...session,
      usage: { calls: 0, input: 0, output: 0, total: 0, ...session.usage, ...payload.usage }
    })).state

    return handled(next)
  }

  if (event.type === 'session.title') {
    // Names the STORED session id directly (unlike every other event here),
    // so this bypasses the runtime->stored routing entirely.
    const storedId = typeof payload?.session_id === 'string' ? payload.session_id : ''
    const nextTitle = typeof payload?.title === 'string' ? payload.title.trim() : ''

    if (!storedId || !nextTitle) {
      return handled(state)
    }

    const next = updateSession(state, storedId, session =>
      session.title === nextTitle ? session : { ...session, title: nextTitle }
    ).state

    return handled(next)
  }

  return notHandled(state)
}
