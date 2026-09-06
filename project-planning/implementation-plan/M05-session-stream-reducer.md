# M05 — Session stream reducer

**Status:** todo
**Depends on:** M02
**Goal:** A pure, tested `(state, event) -> { state, effects }` reducer covering the desktop's gateway event catalog.

## Tasks

- [ ] `src/gateway/session-stream-reducer.ts` ported from upstream `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event/{message-stream,tools,status,input-requests,lifecycle,session-info}.ts` (handler contract in `types.ts`); `desktop-bridge.ts` deliberately omitted
- [ ] Effects vocabulary: `notify`, `scrollToBottom`, `refreshSessions`, `hydrate`, `setClarify`, `setApproval`, `setSudo`, `setSecret`, `haptic`, `sound`
- [ ] Delta coalescing (33 ms floor, adaptive) ported from `use-message-stream/index.ts`
- [ ] Events covered: `gateway.ready`, `session.info/usage/title/reclaimed`, `sessions.changed`, `message.start/delta/interim/complete`, `thinking.delta`, `reasoning.delta/available`, `status.update`, `tool.start/progress/generating/complete`, `todo.updated`, `clarify.request/expire`, `approval.request`, `sudo.request`, `secret.request`, `background.complete`, `delegate.*`, `subagent.*`, `btw.complete`, `moa.*`, `notification.show/clear`, `cron.changed`, `skin.changed`, `error`, `message.reaction`, `billing.*`, `replay.truncated`
- [ ] Port desktop test fixtures to vitest: `delta-flush`, `interim-sealing`, `steer-arrival-order`, `session-reclaimed`, `stale-pending-settle`, `clarify-hydration`
- [ ] nanostores atoms in `src/store/`: `sessions`, `session-states` (keyed by stored id with a runtime-sid map), `prompts` (approvals), `clarify`, `todos`, `composer`, `notifications`
- [ ] `src/lib/storage.ts`: MMKV adapter mirroring the desktop's synchronous `readKey` / `writeKey` contract

## Deliverables

- `src/gateway/session-stream-reducer.ts` + tests, `src/store/*`, `src/lib/storage.ts`

## Exit criteria

- All ported fixtures pass.
- The reducer has zero React / React Native imports.
- A recorded event log from M03 replays through the reducer to the same final transcript as `session.resume` history.
