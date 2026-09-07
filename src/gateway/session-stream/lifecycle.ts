// Pure port of apps/desktop's gateway-event/lifecycle.ts: gateway.ready /
// skin.changed / change-watcher broadcasts / session.reclaimed.
//
// Dropped: theme ingestion (ingestBackendSkin — desktop ThemeProvider,
// out of scope here), and the change-watcher broadcasts this milestone's
// event catalog doesn't list (pet.changed / platforms.changed /
// pairing.changed) — no store owns them yet. `fromActiveSource()` collapses
// to "always true": decision in M04 keeps this client to one active
// connection in v1, so there is no second gateway's events to filter out.
//
// session.reclaimed (decision D2, project-planning/DECISIONS.md): unlike the
// desktop, which drops the cached transcript for the reclaimed runtime and
// asks the resumed pane to refetch it, this reducer **rebinds** the runtime
// id to the stored id without dropping anything — the session-key
// architecture (AGENTS.md "State") keys everything by stored id specifically
// so a runtime rebind is cheap and lossless.

import { type FamilyHandler, handled, notHandled } from './context'
import { rebindSessionKey } from './session-keys'
import type { Effect } from './types'

export const handleLifecycleEvent: FamilyHandler = (state, ctx) => {
  const { event, payload } = ctx

  if (event.type === 'gateway.ready' || event.type === 'skin.changed') {
    return handled(state)
  }

  if (event.type === 'sessions.changed') {
    return handled(state, [{ type: 'refreshSessions' }])
  }

  if (event.type === 'cron.changed') {
    // No cron store yet (M10) — consumed so it doesn't fall through unrouted.
    return handled(state)
  }

  if (event.type === 'session.reclaimed') {
    // Unscoped event: the reclaimed RUNTIME id lives in the payload, not
    // event.session_id (see M03's live evidence — the frame's own session_id
    // is '').
    const reclaimedRuntimeId = String((payload as { session_id?: string } | undefined)?.session_id ?? '')

    if (!reclaimedRuntimeId) {
      return handled(state)
    }

    const wasActive = state.activeRuntimeSessionId === reclaimedRuntimeId

    const storedSessionId =
      typeof payload?.stored_session_id === 'string' && payload.stored_session_id ? payload.stored_session_id : null

    const next = storedSessionId ? rebindSessionKey(state, reclaimedRuntimeId, storedSessionId) : state

    const resolvedStoredId = storedSessionId ?? next.runtimeToStored.get(reclaimedRuntimeId) ?? null

    // The row's ended_at moved, so refresh the lists that render it.
    const effects: Effect[] = [{ type: 'refreshSessions' }]

    // Only the session the user is actually looking at needs to redial right
    // now — a background reclaim resumes lazily whenever it's next opened.
    if (wasActive) {
      effects.push({ type: 'hydrate', storedSessionId: resolvedStoredId, runtimeSessionId: null, attempts: 3 })
    }

    return handled(next, effects)
  }

  return notHandled(state)
}
