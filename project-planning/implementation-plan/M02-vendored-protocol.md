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

- [x] `scripts/sync-upstream.mjs` reads allow-listed files from the upstream **git object**
      (`git -C $HERMES_AGENT_ROOT show HEAD:<path>`), never from the working tree, so uncommitted
      edits in a shared checkout can never leak into `src/upstream/`. `UPSTREAM.json.commit` is
      the `HEAD` those objects came from.
- [x] The script stages output and validates every patch into a temporary directory first, and
      replaces `src/upstream/` only after all patches succeed. Today it `rmSync`s the directory
      before validating, so a failed run leaves 22 files deleted (recovery: `git checkout src/upstream`).
- [x] The script refuses to run if `git -C $HERMES_AGENT_ROOT status --short` lists any
      allow-listed path (someone is mid-edit on a file we vendor), printing the offending paths.
- [x] Re-run the idempotency check and `npm run check`; append the output to the Verification log.

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

### 2026-09-07 — Sonnet: M02/M03 follow-ups (git-object reads, staged swap, dirty-upstream gate)

**`scripts/sync-upstream.mjs` changes.** All four follow-up boxes above.

- Every allow-listed file is now read via `git -C $HERMES_AGENT_ROOT show <HEAD>:<path>`
  (`readUpstreamFile`), never `readFileSync` from the working tree. `readFileSync` no longer
  appears in the script.
- Before touching anything, `assertUpstreamAllowListedPathsClean()` runs
  `git -C $HERMES_AGENT_ROOT status --short` and fails loudly (printing the offending paths) if
  any changed path — including the "old -> new" form of a rename — matches an allow-listed `src`.
- All patch/import-alias validation now happens in memory (`buildContents()`) before any file is
  written anywhere. Writing only starts in `stageAndSwap()`: every file goes into a fresh
  `mkdtempSync` staging directory (`tmp-upstream-sync-*`, sibling of `src/`, gitignored as a
  belt-and-suspenders), `eslint --fix` + `prettier --write` run there, `UPSTREAM.json` is written
  there, and only if all of that succeeds does the script `rmSync` the real `src/upstream/` and
  `renameSync` the staging directory into its place. Any failure during staging is caught, the
  staging directory is removed, and `src/upstream/` — untouched this whole time — is reported as
  left alone. A stale staging directory from a crashed prior run is swept at the top of every run.

**Verified, not just written** (fake upstream root built in the scratchpad — a `git init` with one
commit per allow-listed file, `git remote add origin` — so `HERMES_AGENT_ROOT` could point
somewhere disposable; `../hermes-agent` itself was never modified, consistent with AGENTS.md):

1. **Control** (unmodified fake root): exit **0**, wrote 22 files.
2. **Dirty allow-listed path**: appended an uncommitted line to the fake root's `apps/shared/src/skin.ts`.
   Exit **1**: `... has uncommitted changes under allow-listed paths — commit or stash them there first: apps/shared/src/skin.ts`.
3. **Broken patch target** (same mutation Opus used in M02's own re-verification — `window.location.host` -> `.hostname`
   in `websocket-url.ts`): exit **1**, real `src/upstream/` (23 files, snapshotted first) byte-for-byte
   unchanged afterward (`diff -rq` — no diff), no leftover `tmp-upstream-sync-*` directory. This is
   the failure mode that previously deleted 22 files.
4. **Failure during staging itself**, not just during patch-building: put a genuine JS syntax error
   into a file with no patches (`lib/text.ts`), so it survives to the `eslint --fix` step in the
   staging directory. `eslint` reported the parse error, `execFileSync` threw, and the script
   printed `staging failed, src/upstream left untouched: Command failed: ... eslint.js --fix
   ...\tmp-upstream-sync-MA9t9A` — exit **1**, real `src/upstream/` still byte-for-byte unchanged,
   and the staging directory was removed (not left behind).

**Idempotency, re-run against the real `../hermes-agent`** (`HERMES_AGENT_ROOT` unset, default):

```
=== git -C ../hermes-agent status --short ===
?? .zcode/
=== run 1 ===
sync-upstream: wrote 22 files to src\upstream
=== run 2 ===
sync-upstream: wrote 22 files to src\upstream
=== diff -rq run1 vs run2 ===
NO DIFF
=== git status --short src/upstream ===
 M src/upstream/UPSTREAM.json
 M src/upstream/shared/json-rpc-gateway-replay.test.ts
 M src/upstream/shared/websocket-url.ts
=== git diff --stat src/upstream ===
 src/upstream/UPSTREAM.json                         |  4 ++--
 .../shared/json-rpc-gateway-replay.test.ts         | 25 ++++------------------
 src/upstream/shared/websocket-url.ts               |  4 +++-
 3 files changed, 9 insertions(+), 24 deletions(-)
```

The three-file diff against the previously-committed `src/upstream/` is real upstream drift, not a
bug: `../hermes-agent` HEAD moved from `089bb32886c8c18f7fa20182c7bf8826d6935ac5` (M02's pin) to
`b973068c60ae92c1928041cb6a8e53a80bcf9c4c` between then and now (another session's commits — `.zcode/`
is the only uncommitted entry, and it isn't allow-listed). The old script read the working tree
directly, so it happened to reproduce the same bytes regardless of `HEAD`; the fixed script reads
the git object at `HEAD`, which is the whole point of this follow-up, so re-running it now correctly
picks up the two files upstream actually changed (a wrapped union type in `websocket-url.ts`, and
several object literals in the replay test that now fit `prettier`'s 120-col width on one line) plus
the new `commit`/`syncedAt` in the manifest. `git diff --stat` **between the two runs** (the actual
idempotency criterion) is empty, as shown above; this three-file diff is against the git-committed
baseline from before this session, which is expected to move when upstream does.

**`npm run check`** — exit 0, 3 files / 10 tests, lint clean. Re-run once more after the
`spike-gateway.mjs` fix below; still green.

### 2026-09-07 — Sonnet: `.gitignore` regression found and fixed during M05

While working M05, `npx prettier --check .` flagged two `src/upstream/**` files as unformatted right
after a fresh `sync-upstream.mjs` run — meaning `lintFixDest()`'s own `prettier --write` step wasn't
actually taking effect. Root cause: the earlier M02/M03 follow-up commit had added
`tmp-upstream-sync-*/` to `.gitignore` as a "just in case" safety net for the staging directory.
Prettier 3.x respects `.gitignore` by default, so every `prettier --write <stagingRoot>` call was
silently a no-op — the staged files kept whatever formatting the raw upstream source happened to have
(mostly harmless, since upstream is usually already prettier-clean, but not guaranteed, and the
idempotency check couldn't have caught it either, since "no diff between two runs" holds regardless of
whether formatting is applied at all).

Fixed by removing the `.gitignore` entry (`cleanStaleStaging()` already sweeps a crashed run's leftover
staging directory on the very next run, so the entry was pure downside once this was found). Re-ran the
idempotency check and `npm run check` after the fix:

```
=== run 1 ===
sync-upstream: wrote 23 files to src\upstream
=== run 2 ===
sync-upstream: wrote 23 files to src\upstream
=== diff -rq run1 vs run2 ===
IDEMPOTENT - NO DIFF
```

`npm run check` and `npx prettier --check .` both exit 0 (see M05's own Verification log for the full
combined output, captured in the same session). Full detail of how this was diagnosed (the red herring
of "maybe upstream's own formatting changed" ruled out first) is in M05's Verification log, item 3
under "two bugs found and fixed by writing these tests."

### 2026-09-07 — Opus re-verification of the D5 follow-up (`f66af6b`)

M02's own exit criteria still hold (idempotency re-run below), so the status stays `done`. But
**decision D5 part 1 is only half delivered**, and the half that is missing fails destructively.

**What works.** The script now reads every allow-listed file from the upstream git object, never the
working tree — `readUpstreamFile()` shells out to `git -C $HERMES_AGENT_ROOT show <commit>:<src>`
(line 292) with `commit` from `rev-parse HEAD` (line 402). `assertUpstreamAllowListedPathsClean()`
refuses to run when an allow-listed path is dirty upstream. Both verified against a scratch fake
upstream repo (the real checkout was never written to):

```
CONTROL (clean fake root)                  → exit 0, wrote 23 files
TEST A  (dirty allow-listed path)          → exit 1
  sync-upstream: …fake2 has uncommitted changes under allow-listed paths — commit or stash them there first:
  apps/shared/src/websocket-url.ts
  src/upstream files after refusal: 24     ← untouched
TEST B  (committed break of a patch target)→ exit 1
  sync-upstream: patch target found 1x, expected 2x in shared/json-rpc-gateway.ts: …
  src/upstream files: before=24 after=24   ← untouched
```

So for **patch** failures the D5 safety property genuinely holds, which is the case that motivated
it. Idempotency also still holds: two consecutive runs produced `NO DIFF`, and
`git status --short src/upstream` was empty afterwards, so the script still reproduces the committed
bytes exactly.

**What is broken.** The final swap is not atomic and its failure message is false:

```
353:    rmSync(DEST_ROOT, { force: true, recursive: true })
354:    renameSync(stagingRoot, DEST_ROOT)
355:  } catch (error) {
356:    rmSync(stagingRoot, { force: true, recursive: true })
357:    fail(`staging failed, src/upstream left untouched: ${…}`)
```

`src/upstream` is deleted on line 353 *before* the rename is attempted. On Windows a directory that
was just removed stays in a pending-delete state while any process still holds a handle inside it,
so the rename fails with `EPERM` — and the catch block then reports "**src/upstream left
untouched**" when it has in fact just been destroyed. Reproduced twice with Metro running (the
normal dev state, and exactly what was left running at the end of the M04 session):

```
sync-upstream: staging failed, src/upstream left untouched: EPERM: operation not permitted,
  rename 'D:\…\tmp-upstream-sync-tV8zoO' -> 'D:\…\src\upstream'

$ git status --short src/upstream
 D src/upstream/UPSTREAM.json
 D src/upstream/lib/chat-messages/hydration.ts
 … 24 files deleted, 0 remaining
```

Stopping Metro and re-running succeeded immediately (`wrote 23 files`, exit 0, clean `git status`),
which isolates the cause to a file watcher holding handles — not to anything about upstream.

This is a regression in kind, not just in degree: before D5 the failure was destructive but the
message was silent; now it is destructive *and* asserts the opposite. Recovery is still
`git checkout src/upstream`, and `git status` always reveals it, so the blast radius is bounded.

**Fix for Sonnet** (more than one line, so not applied here): never delete the destination before the
swap. Rename the existing directory aside first, then rename staging into place, then delete the old
one — `src/upstream` → `src/upstream.old-<rand>`, `staging` → `src/upstream`, `rm -rf
src/upstream.old-<rand>`, with the aside restored on failure. That leaves either the old tree or the
new one in place at every instant, and makes the "left untouched" message true. Windows will still
`EPERM` on the *aside* rename under a watcher, but that failure happens before anything is destroyed.

**Also verified:** my other M03 finding is fixed. `scripts/spike-gateway.mjs` no longer forces
`process.exit(0)`; a live run against a real `hermes serve` printed `PASS` and exited **0**, with no
libuv `UV_HANDLE_CLOSING` assertion.

### 2026-09-07 — Sonnet: fixed the swap, but not with the suggested rename-aside

Reproduced the reported bug first, to confirm it was still live: with Metro running, the exact
`rmSync`-then-`renameSync` sequence deleted `src/upstream` and then failed `EPERM` trying to rename
the staging directory into its place — matching Opus's report exactly.

Tried Opus's suggested fix (rename `src/upstream` aside, rename staging into place, delete the
aside) — and it does not work here, for the reason Opus's own note flagged as a possibility: with
Metro running, `renameSync('src/upstream', anything)` fails **EPERM as the very first step**, before
anything is deleted or moved. Metro's watcher holds handles that block renaming *or* removing the
`src/upstream` directory entry itself — not just deleting it. Verified directly, isolating the two
operations:

```
$ node -e "fs.writeFileSync('src/upstream/shared/skin.ts', fs.readFileSync('src/upstream/shared/skin.ts','utf8'))"
file overwrite OK
$ node -e "fs.renameSync('src/upstream', 'src/upstream.testmove')"
dir rename FAILED: EPERM: operation not permitted, rename '...\src\upstream' -> '...\src\upstream.testmove'
```

So the aside-rename fix would only have turned the destructive failure into a safe one (matching its
own caveat: "Windows will still EPERM on the aside rename under a watcher") — it would not have made
the sync actually succeed with Metro running, which is this project's normal dev state per AGENTS.md
and exactly the condition D5 needs to hold under.

**Actual fix: never rename or delete the `src/upstream` directory entry at all.** The swap is now an
in-place per-file copy: `syncDirectoryInPlace()` walks the validated staging directory and
`copyFileSync`s each file's content directly into the corresponding path under the existing
`src/upstream/` (creating subdirectories as needed), then deletes any file under `src/upstream/`
that the new allow-list no longer produces. The directory's own identity is never touched, only
individual file contents — which the isolated test above already showed succeeds fine under Metro's
watcher. All patch/lint/manifest validation still happens entirely inside the staging directory
first, exactly as before; this only changes the final "make it live" step.

This does very slightly narrow the atomicity guarantee: a crash *during* the copy loop itself (not a
content/patch/lint failure — those still can't reach this point) could leave `src/upstream/` with a
mix of old and new files, since individual `copyFileSync` calls aren't a single transaction the way
a directory rename would be. The failure message says so explicitly now instead of asserting
"untouched" when it might not be, and it points at the recovery (`git checkout src/upstream`, or
just re-run — the sync is idempotent so a repeat run finishes the copy). This is a real, disclosed
trade-off, not the false guarantee the original bug had.

**Re-verified, with Metro running the whole time** (`PID` confirmed listening on 8081 before and
after):

```
$ netstat -ano | grep :8081
  TCP  0.0.0.0:8081  ...  LISTENING  15748
$ node scripts/sync-upstream.mjs
sync-upstream: wrote 23 files to src\upstream          ← was EPERM before the fix
$ node scripts/sync-upstream.mjs   # idempotency, run 2
sync-upstream: wrote 23 files to src\upstream
$ diff -rq <run-1 snapshot> src/upstream
IDEMPOTENT - NO DIFF
$ ls -d tmp-upstream-sync-*
(none — no leftover staging directory)
$ git status --short src/upstream
(empty)
```

`npm run check` — exit 0, 15 files / 105 tests (105, not 104 — see M05's Verification log for the
new test that accounts for the +1), lint clean. `npx prettier --check .` — exit 0.
