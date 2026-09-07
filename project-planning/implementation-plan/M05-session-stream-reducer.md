# M05 — Session stream reducer

**Status:** in-progress
**Depends on:** M02
**Goal:** A pure, tested `(state, event) -> { state, effects }` reducer covering the desktop's gateway event catalog.

## Tasks

- [x] `src/gateway/session-stream-reducer.ts` ported from upstream `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event/{message-stream,tools,status,input-requests,lifecycle,session-info}.ts` (handler contract in `types.ts`); `desktop-bridge.ts` deliberately omitted. Split into `src/gateway/session-stream/*.ts` per family (mirroring the upstream directory split) and re-exported from the single top-level file the spec names.
- [x] Effects vocabulary: `notify`, `scrollToBottom`, `refreshSessions`, `hydrate`, `setClarify`, `setApproval`, `setSudo`, `setSecret`, `haptic`, `sound`
- [x] Delta coalescing (33 ms floor, adaptive) ported from `use-message-stream/index.ts` as `src/gateway/delta-flush-scheduler.ts` — a standalone scheduler the reducer does not own (see Deviations)
- [x] Events covered: `gateway.ready`, `session.info/usage/title/reclaimed`, `sessions.changed`, `message.start/delta/interim/complete`, `thinking.delta`, `reasoning.delta/available`, `status.update`, `tool.start/progress/generating/complete`, `todo.updated`, `clarify.request/expire`, `approval.request`, `sudo.request`, `secret.request`, `background.complete`, `delegate.*`, `subagent.*`, `btw.complete`, `moa.*`, `notification.show/clear`, `cron.changed`, `skin.changed`, `error`, `message.reaction`, `billing.*`, `replay.truncated`
- [x] Port desktop test fixtures to vitest: `delta-flush`, `interim-sealing`, `steer-arrival-order`, `session-reclaimed`, `stale-pending-settle`, `clarify-hydration`
- [x] nanostores atoms in `src/store/`: `sessions`, `session-states` (keyed by stored id with a runtime-sid map), `prompts` (approvals), `clarify`, `todos`, `composer`, `notifications`
- [x] `src/lib/storage.ts`: MMKV adapter mirroring the desktop's synchronous `readKey` / `writeKey` contract

## Deliverables

- `src/gateway/session-stream-reducer.ts` + `src/gateway/session-stream/*.ts` + `src/gateway/delta-flush-scheduler.ts` + tests, `src/store/*`, `src/lib/storage.ts` (+ `src/lib/storage.test.ts`)

## Exit criteria

- [x] All ported fixtures pass.
- [x] The reducer has zero React / React Native imports.
- [x] A recorded event log from M03 replays through the reducer to the same final transcript as `session.resume` history.

## Deviations from the literal spec (and why)

Same spirit as M02's Deviations section: every gap here got a documented, scoped decision rather than a
silent drop or a guess. None of them change what the reducer's core invariants — message assembly, turn
lifecycle, session-key routing — actually do.

1. **`session.reclaimed` rebinds instead of dropping (decision D2).** The desktop drops the cached
   transcript for a reclaimed runtime and has the resumed pane refetch it from stored history —
   correct for its per-runtime-id state cache. This client's state is keyed by **stored** session id
   with a runtime-sid map (AGENTS.md "State"), specifically so a reclaim doesn't have to be
   destructive: `session.reclaimed` now calls `rebindSessionKey`, which moves whatever transcript was
   collected under the dying runtime id's placeholder key onto the real stored key, dropping nothing.
   A reclaim naming a runtime id this client never saw live state for (a background broadcast, or one
   from a connection this session didn't make) does not materialize an empty session entry — there is
   nothing to preserve, so only the `runtimeToStored` mapping is recorded. `session-reclaimed.test.ts`
   is rewritten around this contract; the desktop's tile/wiring-cache assertions don't apply (this
   client has one active session, not desktop panes).
2. **The delta-flush scheduler is not rAF-based.** The desktop measures flush cost through a
   `requestAnimationFrame` callback because the cost that matters on the web is the deferred
   `$messages` publish + Streamdown re-parse a browser commit does after the synchronous store write.
   There's no single "the commit happened" signal to assume across Expo/RN's own render pipeline, so
   `DeltaFlushScheduler` (`src/gateway/delta-flush-scheduler.ts`) takes a `reportFlushCost(ms)` call
   instead — the caller measures however it wants (or never calls it, which is exactly the desktop's
   own "hidden renderer never fires rAF" fallback path: the floor never stretches past 33ms). The
   fixed-floor/3x-adaptive/250ms-cap arithmetic itself is ported verbatim.
3. **`appendMidTurnUserMessage` is exported but "steer" itself is not implemented.** The desktop's
   `redirectPrompt` (optimistic insert, `session.redirect` RPC, rollback on rejection) is a prompt
   action, not a gateway event — out of M05's scope by the milestone's own boundary (gateway-event
   reducer only). What IS ported is the ordering primitive that action calls into
   (`appendSessionTextMessage({appendAfterActiveReply:true})` → `appendMidTurnUserMessage`, in
   `turn-helpers.ts`) — the exact function responsible for the invariant `steer-arrival-order.test.ts`
   checks. The adapted fixture calls it directly to stand in for "the steer action ran," then drives
   the real reducer for everything after.
4. **Desktop-only / multi-window / machine surfaces dropped**, each noted at its call site: pet sprite
   activity and vibe-heart bursts (no pet overlay — AGENTS.md), billing-wall CTA click handler
   (`notify` effects carry no callback — effects are data), native OS notification dispatch (push is
   M11), disk-full/provider-setup-error onboarding prompts, model-options query invalidation (no query
   client here), cwd-follow / workspace-owner claims (no local fs), MCP-repair-suggestion reporting,
   skill-suggestion-cache invalidation, composer-status background-process refresh, tool-diff
   recording, workspace-file-tree refresh notifications, and `session.info`'s
   `maybeRebindPaneToRebuiltRuntime` (#93942 pane-rebind-on-runtime-rebuild — a real desktop scenario,
   but multi-window-shaped and not required by any M05 fixture; left for M06/M07 if a single-pane
   client turns out to need it too).
5. **`tool.generating`'s "drafting a tool call" status line is not ported.** No state slot exists for
   it in this milestone's `SessionState`; it's a nice-to-have typing indicator, not a correctness
   requirement, left for M06 if wanted.
6. **`mcp.setup.request` is dropped** — not on M05's required event catalog, and the tool it belongs to
   (`setup_mcp`) is a desktop-GUI-only consent card upstream.
7. **`review.summary` is dropped** for the same reason (not on the required catalog); `btw.complete`
   and the new `background.complete` (no desktop handler was found for it at all — likely unemitted by
   current backends, but M05 lists it) both append a system-message aside using the same shape.
8. **`session.reclaimed`'s vendored allow-list gained one file**: `lib/chat-messages/index.ts` (the
   barrel `@/lib/chat-messages` resolves to upstream) wasn't in M02's original allow-list — M02 only
   vendored the individual submodules it needed at the time. Added to `scripts/sync-upstream.mjs`'s
   `ALLOW_LIST`, same pattern as M02's own `skill-scaffold.ts` addition.

## Verification log

### 2026-09-07 — `npm run check`

```
> hermes-android@1.0.0 check
> npm run typecheck && npm run test && npm run lint

> hermes-android@1.0.0 typecheck
> tsc -p . --noEmit

> hermes-android@1.0.0 test
> vitest run

 RUN  v4.1.10 D:/Stuff/Code/git/hermes-android

 Test Files  11 passed (11)
      Tests  70 passed (70)

> hermes-android@1.0.0 lint
> eslint .
```

All three steps exited 0. `npx prettier --check .` also passes across the whole repo.

### 2026-09-07 — zero React / React Native imports

```
$ grep -rn "from 'react'\|from 'react-native'" src/gateway/
CONFIRMED: zero React/RN imports in src/gateway
```

### 2026-09-07 — fixture-by-fixture pass counts

- `interim-sealing.test.ts` — 17/17
- `stale-pending-settle.test.ts` — 2/2
- `clarify-hydration.test.ts` — 13/13
- `session-reclaimed.test.ts` — 7/7 (rewritten around decision D2 — see Deviations)
- `steer-arrival-order.test.ts` — 4/4 (adapted — see Deviations item 3)
- `delta-flush-scheduler.test.ts` — 7/7 (adapted — see Deviations item 2)
- `session-stream-e2e.test.ts` — 2/2 (see below)

### 2026-09-07 — end-to-end replay fixture

`src/gateway/__fixtures__/session-replay.json` captured live against a throwaway `hermes serve
--host 127.0.0.1` (same discipline as M03/M04: locally generated token, never written to a file, log,
or commit; server torn down immediately after capture). One session: `session.create` with
`source: 'android'`, `prompt.submit`, the full event stream through `message.complete`, plus trailing
`session.info`/`session.title`/`sessions.changed`. `session.resume` for the same stored session id was
fetched immediately after as the oracle. `system_prompt`, `cwd`, `tools`, `skills`, `skin`, and
`replay_epoch` are redacted in the committed fixture (bulk, non-identifying payload noise — no token or
hostname was ever in it). The fixture also kept one unrelated `session.reclaimed` broadcast (a
different, already-dead session from a prior run on the same throwaway server) verbatim, to prove the
reducer ignores real noise rather than only synthetic clean input.

`session-stream-e2e.test.ts` replays every event through `reduceGatewayEvent` + `flushSessionDeltas`
and asserts the assembled assistant message text equals `session.resume`'s own assistant message text
— exact match. A second assertion confirms the stray `session.reclaimed` never materialized a session
entry for the unrelated id.

### 2026-09-07 — two bugs found and fixed by writing these tests

1. **`DeltaFlushScheduler`'s initial `lastFlushAt` was wrong.** Seeded to `0`, matching the desktop's
   `lastFlushAtRef.current = 0` — but the desktop measures elapsed time with `performance.now()`
   (starts near 0 at page load), while this module defaults to `Date.now()` (a large absolute epoch,
   no RN equivalent of navigation-start-relative time). The mismatch made the very first `schedule()`
   ever called fire immediately instead of respecting the 33ms floor. Fixed by seeding `lastFlushAt` to
   `this.now()` in the constructor. Caught by `delta-flush-scheduler.test.ts`'s first assertion.
2. **`rebindSessionKey` materialized an empty session entry for a runtime id with no live state.**
   Writing the end-to-end fixture surfaced this: the captured log's unrelated `session.reclaimed`
   broadcast (a runtime id this test harness never had state for) was creating a blank `SessionState`
   under its stored id just to record the mapping — harmless in isolation, but wrong per the "the
   reducer should not fabricate a session entry for a conversation it never touched" reading of D2.
   Fixed in `session-keys.ts`: `rebindSessionKey` now only records the `runtimeToStored` mapping when
   there's no live placeholder state to carry over.
3. **A process-hygiene bug in `scripts/sync-upstream.mjs`, found while chasing an unrelated formatting
   discrepancy.** `.gitignore` had gained a `tmp-upstream-sync-*/` entry (this milestone's own earlier
   safety-net addition, in the M02/M03 follow-up commit). Prettier 3.x respects `.gitignore` by
   default, so `lintFixDest()`'s `prettier --write <stagingRoot>` call was **silently doing nothing** —
   the staged files kept whatever formatting the raw upstream source happened to have, never actually
   reformatted to this repo's `.prettierrc`. Confirmed by bisecting: `--ignore-path /dev/null` on the
   same staging directory reformatted correctly; without it, prettier reported nothing to do.
   Fixed by removing the `.gitignore` entry — `cleanStaleStaging()` already sweeps a crashed run's
   leftover staging directory on the next run regardless, so the entry bought nothing but this bug.
   Re-ran the idempotency check and `npm run check`/`prettier --check` after the fix; both green (see
   M02's Verification log for the update).
