# M02 — Vendored protocol

**Status:** done
**Depends on:** M00
**Goal:** Upstream transport and chat-message code compiles under Metro/Hermes and is refreshed by one command.

## Tasks

- [x] `scripts/sync-upstream.mjs`: reads `HERMES_AGENT_ROOT` (default `../hermes-agent`); explicit
      allow-list; fails loudly on a missing file; rewrites `@/` imports to relative paths; writes
      `src/upstream/UPSTREAM.json` `{repo, commit, syncedAt, files[]}`.
      `syncedAt` is the upstream **commit's** date (`git log -1 --format=%cI`), not wall-clock time
      — otherwise every run would touch UPSTREAM.json and violate the idempotency exit criterion.
- [x] Allow-list — as specified, plus one addition (see Deviations): `apps/shared/src/skill-scaffold.ts`.
- [x] Programmatic patches — the five specified, plus two more the spec didn't anticipate (see
      Deviations): a `websocket-url.ts` guard, and inlining `BillingBlock`/`skillInvocationText`'s
      home import.
- [x] ESLint `no-restricted-globals` (`window`, `document`, `localStorage`, `navigator`) on
      `src/upstream/**` and `src/gateway/**` (added in M01's `eslint.config.mjs`).
- [x] `src/polyfills.ts`: `checkRuntimeCapabilities()` reports whether `URL`, `URLSearchParams`,
      `AbortSignal`, `WebSocket`, `DOMException` exist as globals. Detection only, per the file's
      own docstring — polyfilling waits on real on-device evidence (see Blocker below).
- [x] `src/lib/media.ts`: pure port of `mediaDisplayLabel` + `mediaMarkdownHref`, plus their
      transitive pure dependencies (`mediaKind`/`mediaName`, inlined — not separately allow-listed,
      too small) and `capitalize` (imported from the vendored `lib/text.ts`).
- [x] Vendored replay test (`shared/json-rpc-gateway-replay.test.ts`) runs under vitest — all 8 cases pass.
- [x] `app/runtime-check.tsx` run on a real device — see Verification log. All five globals
      (`WebSocket`, `URL`, `URLSearchParams`, `AbortSignal`, `DOMException`) are natively PRESENT
      on this Hermes engine (RN 0.86.3 / Expo SDK 57). `react-native-url-polyfill` is **not**
      added, per the task's own "only if the check fails" — it doesn't.

## Deliverables

- `scripts/sync-upstream.mjs`, `src/upstream/**` (22 files), `src/upstream/UPSTREAM.json`,
  `src/polyfills.ts` (+ `src/polyfills.test.ts`), `src/lib/media.ts`, `app/runtime-check.tsx`.

## Follow-ups (assigned to Sonnet, decision D5; do not change `done`)

- [ ] `scripts/sync-upstream.mjs` reads allow-listed files from the upstream **git object**
      (`git -C $HERMES_AGENT_ROOT show HEAD:<path>`), never from the working tree, so uncommitted
      edits in a shared checkout can never leak into `src/upstream/`. `UPSTREAM.json.commit` is
      the `HEAD` those objects came from.
- [ ] The script stages output and validates every patch into a temporary directory first, and
      replaces `src/upstream/` only after all patches succeed. Today it `rmSync`s the directory
      before validating, so a failed run leaves 22 files deleted (recovery: `git checkout src/upstream`).
- [ ] The script refuses to run if `git -C $HERMES_AGENT_ROOT status --short` lists any
      allow-listed path (someone is mid-edit on a file we vendor), printing the offending paths.
- [ ] Re-run the idempotency check and `npm run check`; append the output to the Verification log.

## Deviations from the literal spec (and why)

The original patch list (5 items) and allow-list didn't anticipate everything a faithful port
needed to actually compile. Rather than hand-edit `src/upstream/**` (forbidden — see AGENTS.md),
each gap got a patch or allow-list addition in `scripts/sync-upstream.mjs`, in the same spirit as
the patches the spec already asked for:

1. **`shared/skill-scaffold.ts` added to the allow-list.** `chat-messages/hydration.ts` imports
   `skillInvocationText` from the `@hermes/shared` workspace package — a real function (not a
   type), pure and dependency-free. Vendoring the one file it lives in was simpler and more
   faithful than hand-porting it into `src/lib/`, so `hydration.ts`'s import was patched to point
   at the vendored copy instead of the (unvendored) package.
2. **`chat-messages/types.ts`: local `BillingBlock` interface.** Same problem, different shape —
   `@hermes/shared` also exports `BillingBlock` (a type used for exactly one optional field on
   `GatewayEventPayload`). Vendoring all of `apps/shared/src/billing-types.ts` (364 lines of
   Remote Spending wire contracts, none of which this file needs) for one 6-field interface would
   pull in an entire unrelated feature surface prematurely — so it's inlined instead, mirroring the
   spec's own precedent for `StatusbarMenuItem` below.
3. **`chat-messages/types.ts`: narrowed local `ThreadMessageLike`.** The spec's patch says this
   becomes "a local structural type" but doesn't specify its shape. The real
   `@assistant-ui/react`/`@assistant-ui/core` type (pulled from the pinned `0.14.24`/`^0.2.19` npm
   packages to check) is a large union of nine part kinds. Grepped every vendored reducer file
   (`parts.ts`, `tool-parts.ts`, `reconciliation.ts`, `hydration.ts`) for every `.type ===` check
   and field access: only `text`, `reasoning`, and `tool-call` (with `toolCallId`/`toolName`/
   `args`/`argsText`/`result`/`isError`) are ever constructed or matched. The local type is
   narrowed to exactly that set, with a comment explaining why the other six upstream part kinds
   (image, file, source, data, generative-ui, audio) are absent.
4. **`shared/websocket-url.ts`: `readWindowLocation()` never touches `window`.** Even though M03's
   `dial.ts` always passes explicit `host`/`protocol`, the vendored `buildHermesWebSocketUrl`
   unconditionally calls `readWindowLocation()` first, which (unpatched) does
   `typeof window === 'undefined' ? ... : window.location.host`. React Native defines a global
   `window` without `.location`, so on-device this would throw — and even if it didn't, touching
   `window` at all violates the `no-restricted-globals` invariant for `src/upstream/**`. Patched to
   always return the empty default and never read `window`.
5. **`shared/json-rpc-gateway.ts`: `replay.truncated` also needed the per-request session id.**
   The spec's fetch-replay patch was described as "emit a synthetic event" — implementing it
   required also fixing a real gap in the existing loop: `fetchReplay()` iterated
   `Promise.allSettled` results without tracking which `session_id` each one belonged to (each
   `session.events.since` call is per-session). Added `results.entries()` zipped against the
   `entries` array it was built from, then check `truncated === true` per result.
6. **`lib/gateway-events.ts`: local `StatusbarMenuItem`** — exactly as the spec described, narrowed
   to the four fields (`className`, `disabled`, `id`, `label`) this file actually constructs (the
   real type also has `icon`/`hidden`/`href`/`onSelect`/`title`/`to`, none used here).
7. **`sync-upstream.mjs` runs `eslint --fix` then `prettier --write` on `src/upstream/` after
   writing files**, not described in the spec. The alias-rewrite changes every rewritten import's
   depth, which upstream's own import order rarely satisfies against this project's
   `perfectionist/sort-imports` rule — auto-fixing here (deterministic for unchanged input, so it
   doesn't break idempotency) avoids a bespoke reorder patch per file.

None of these change what the vendored code *does* — every patch is either "make the type-checker
happy with a narrower/local stand-in for something never fully used" or "stop touching a global
this code can't rely on." If a future `sync-upstream.mjs` run fails because upstream's shape
changed under one of these patches, it fails loudly (the `patch()` helper asserts exact occurrence
counts) rather than silently drifting.

## Verification log

### 2026-09-07 — `node scripts/sync-upstream.mjs` idempotency

Ran twice in a row (diffed a full copy of `src/upstream/` between runs): **no diff**. Confirmed
again after adding the `eslint --fix` + `prettier --write` post-processing step.

### 2026-09-07 — `npm run check`

```
> hermes-android@1.0.0 check
> npm run typecheck && npm run test && npm run lint

> hermes-android@1.0.0 typecheck
> tsc -p . --noEmit

> hermes-android@1.0.0 test
> vitest run

 RUN  v4.1.10 D:/Stuff/Code/git/hermes-android

 Test Files  3 passed (3)
      Tests  10 passed (10)

> hermes-android@1.0.0 lint
> eslint .
```

All three steps exited 0, including all 8 cases in the vendored
`shared/json-rpc-gateway-replay.test.ts` (seq watermark tracking, replay-on-reconnect, replayed
dispatch, no-replay-when-nothing-observed, watermark monotonicity, envelope-shaped replay
rejection, live-frame holding during replay, epoch-change watermark clearing) plus the new
`src/polyfills.test.ts` and the M01 smoke test.

`npx prettier --check .` also passes across the whole repo including `src/upstream/**` and
`scripts/sync-upstream.mjs`.

### 2026-09-07 — on-device runtime-check (live, on `emulator-5554`)

Deep-linked into `hermes-android://runtime-check` on the running dev-client build (see M01's
Verification log for how the build got installed). Screenshot:
[docs/m02-runtime-check.png](../../docs/m02-runtime-check.png). Console evidence via `adb logcat`:

```
ReactNativeJS: '[runtime-check]', '{"AbortSignal":true,"DOMException":true,"URL":true,"URLSearchParams":true,"WebSocket":true}'
```

All five PRESENT. No polyfill needed on this engine.

### 2026-09-07 — Opus re-verification

**Verdict: verified.** Every claim re-run independently.

#### Reference-repo gate (protocol step 6) — relaxed, with cause

`git -C ../hermes-agent status --short` did **not** match the handover's exact six-entry list. A
concurrent session (the user's parallel PWA/Capacitor port) was editing the upstream checkout
live during this verification — files appearing and changing at 16:05, 16:40, 16:44, 16:45:

```
apps/desktop/src/components/pane-shell/tree/renderer/narrow-overlays.tsx
apps/desktop/src/components/haptics-provider.tsx
apps/desktop/src/lib/haptics.ts
apps/desktop/src/styles.css
```

All four are Electron **desktop renderer** files (touch affordances + haptics). Checked
programmatically against the 22 `src:` entries in `scripts/sync-upstream.mjs`:

```
allow-listed files: 22
changed files checked: 8
NO INTERSECTION — no vendored source file is modified
```

Nothing under `tui_gateway/` or `hermes_cli/` was touched by that session; the only core-server
file in the tree, `tui_gateway/server.py`, is the pre-existing **docstring-only** change from
02:31 (it documents `"android"` as a known session source). Upstream HEAD never moved from
`089bb32`.

On that evidence the gate is narrowed, with the user's agreement, from an exact whole-repo file
list to **"no uncommitted changes under the 22 vendored allow-listed source paths."** Vendored
provenance is unaffected. Recorded here so a later reader knows the original gate text was not
met literally.

#### Checks

`npm run check` — exit 0 (3 files, 10 tests). `npx prettier --check .` — exit 0,
`All matched files use Prettier code style!`.

**Idempotency.** Ran `node scripts/sync-upstream.mjs` twice, snapshotting `src/upstream/` between
runs and `diff -r`-ing the snapshots:

```
=== diff -r run1 vs run2 ===
NO DIFF
=== git status after run 2 ===
(empty)
=== file count ===
23
```

22 vendored files + `UPSTREAM.json`. Note the stronger property this also proves: regenerating
from the current upstream checkout reproduces the **committed** bytes exactly, so what is in git
really is what the script produces.

**Pin.** `UPSTREAM.json.commit` = `089bb32886c8c18f7fa20182c7bf8826d6935ac5`;
`git -C ../hermes-agent rev-parse HEAD` = the same, and `syncedAt` (`2026-09-06T10:15:23Z`)
matches `git log -1 --format=%cI`. The wall-clock-vs-commit-date reasoning in Tasks is correct and
is what makes the idempotency criterion satisfiable at all.

**Patches fail loudly — tested, not assumed.** Built a minimal fake upstream root in a scratch dir
containing only the 22 allow-listed files plus a `git init` + one commit (the script shells out to
`git rev-parse HEAD` / `git log -1`), then pointed `HERMES_AGENT_ROOT` at it.

Control (unmodified fake root): exit **0**, `wrote 22 files`. So a failure below is attributable
to the mutation, not to the harness.

Test A — altered one patch target (`window.location.host` → `window.location.hostname` in
`websocket-url.ts`): exit **1**.

```
sync-upstream: patch target not found in shared/websocket-url.ts: never read window.location — …
--- expected to find ---
function readWindowLocation(): { host: string; protocol: string } {
  if (typeof window === 'undefined') {
…
```

Test B — broke the *count* rather than the presence, by changing 1 of the 2 `DOMException`
occurrences (that patch declares `count: 2`): exit **1**.

```
sync-upstream: patch target found 1x, expected 2x in shared/json-rpc-gateway.ts: DOMException isn't available on every JS engine (Hermes) -> a plain Error named 'AbortError'
```

Both assertions are real. `src/upstream/` was restored by re-running the real sync;
`git status --short src/upstream` is empty.

**Narrowed `ThreadMessageLike` reviewed.** It is referenced in exactly one place —
`types.ts:46`, `ChatMessagePart = Exclude<ThreadMessageLike['content'], string>[number] & …` — so
every `.type ===` / `.type !==` across `parts.ts`, `tool-parts.ts`, `reconciliation.ts` and
`hydration.ts` is the full surface. Enumerated all ~40 of them: the only kinds branched on are
`text`, `reasoning`, and `tool-call`, exactly as the deviation note claims. `tsc --noEmit` passing
is the stronger half of the argument — if the narrowed type omitted a field the reducers read, the
typecheck would fail. The residual risk is not type-level but runtime: an assistant-ui part kind
the server could emit would fall through every branch rather than being handled. That is the same
behaviour as upstream for unknown kinds, so it is acceptable, but it is the thing to re-check at
M05/M06 when real fixtures land.

**No browser globals.** `grep -rnw "window|document|localStorage|navigator" src/upstream src/gateway`
returns only **comments** (plus `types/hermes.ts:1266 window?: number`, a property name). More
importantly the ESLint rule was proved to actually fire, rather than merely existing — via stdin,
so no file was written:

```
$ echo 'export const probe = window.location.host' | npx eslint --stdin --stdin-filename src/upstream/__probe.ts
  1:22  error  Unexpected use of 'window'. This module is vendored/gateway code; it must not touch browser globals  no-restricted-globals
✖ 1 problem (1 error, 0 warnings)      → exit 1

$ … --stdin-filename src/lib/__probe.ts                → exit 0
```

Correct rule, correctly scoped to `src/upstream/**` and `src/gateway/**` and not beyond.

**On-device runtime check**, re-run live on `emulator-5554` against the APK built this session
(deep-linked `hermes-android://runtime-check`). `uiautomator dump` text: five rows, all `PRESENT`.
`adb logcat`:

```
ReactNativeJS: '[runtime-check]', '{"AbortSignal":true,"DOMException":true,"URL":true,"URLSearchParams":true,"WebSocket":true}'
```

Byte-identical to the implementer's result. `react-native-url-polyfill` correctly not added.

#### Verifier finding (low severity, not gating)

`syncFiles()` calls `rmSync(DEST_ROOT, { recursive: true })` **before** any patch is validated, so
a sync that fails on upstream drift leaves the working tree wrecked rather than untouched. Observed
directly during Test A:

```
$ git status --short src/upstream
 D src/upstream/UPSTREAM.json
 D src/upstream/lib/chat-messages/hydration.ts
 … 22 deletions, 1 of 23 files surviving
```

Recovery is `git checkout src/upstream` or re-running a good sync, so the blast radius is small
and always visible in `git status`. Worth a one-line fix when the file is next touched (write to a
temp dir, swap on success); not worth a milestone reopen. Handed to Sonnet rather than fixed here.
