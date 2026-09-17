# Fix round: upstream re-pin (D21.3.2) — Sonnet's half

Scope: this file covers only the upstream-drift assignment (D21.3.2). It does not touch the
approval-path assignment (D21.3.1) or anything past it in the D21.3 ordered list. Another process
folds this into the combined `FIX-ROUND-2026-09-18.md`; I have not written that file.

Every claim below states what was run and its scope (component / path / general), per D21.1.

## 0. Starting state (verified, component: git metadata)

Ran from `D:\Stuff\Code\git\hermes-android-fix-upstream` (branch `fix/upstream-repin`, the
pre-existing worktree named in my task, not the harness's own isolated worktree — see the note at
the end of this section).

- `git status` — clean working tree, on `fix/upstream-repin`, up to date with
  `origin/fix/upstream-repin`.
- `git log --oneline -1` — `14980e8 chore(upstream): re-pin to ee84ccd8bd -- 479 commits ahead of
  the M02 pin`, already on this branch before I did anything.
- `src/upstream/UPSTREAM.json`'s `commit` field: `ee84ccd8bd13d0025e98bb6be8ceb93303e3bdff`.
- `git -C D:\Stuff\Code\git\hermes-agent rev-parse HEAD` — `ee84ccd8bd13d0025e98bb6be8ceb93303e3bdff`,
  matching `UPSTREAM.json`. D5 gate part 1 (upstream HEAD == pin) holds.
- `git -C D:\Stuff\Code\git\hermes-agent status --short apps/desktop/src apps/shared/src` — empty.
  D5 gate part 2 (no dirty state under allow-listed paths) holds. (Untracked `.zcode/` and
  `apps/mobile/` exist at the hermes-agent root but are outside every allow-listed path, so they
  don't affect the gate.)

**Deviation from the task's environment description, disclosed up front:** the harness placed me
in an auto-created isolated worktree at
`D:\Stuff\Code\git\hermes-android\.claude\worktrees\agent-ab70626db8dca3e30` on a throwaway branch
(`worktree-agent-ab70626db8dca3e30`), not `fix/upstream-repin`. I ran a handful of read-only
commands there first (`git log`, `git status`, `cat UPSTREAM.json`) before noticing the mismatch —
no file edits or commits were made in that path. The coordinator confirmed mid-task that
`D:\Stuff\Code\git\hermes-android-fix-upstream` is the real target (a plain sibling directory, not
a worktree of the isolated repo, so ordinary absolute-path `cd` reaches it without the harness's
worktree-isolation guard tripping). Every substantive command in this report — everything from
section 1 onward — was run with an explicit `cd "D:\Stuff\Code\git\hermes-android-fix-upstream"`
(or, for the upstream checkout, `cd "D:\Stuff\Code\git\hermes-agent"`), never a relative path and
never `-C` across worktrees.

## 1. Reproducing the break — **did not reproduce a build break** (verified, path: full `npm run check`)

Task step 1 asked me to confirm the build currently fails on missing `CronBlueprint` /
`CronBlueprintField`. It does not. Two independent checks:

- `grep -rn "CronBlueprint" --include=*.ts --include=*.tsx .` (excluding `node_modules`): every
  hit is in `src/api/cron.ts` (which declares `CronBlueprintField`/`CronBlueprint` itself, as local
  interfaces, not imports) and `src/components/NewTaskSheet.tsx` (which imports them from
  `../api/cron`, not from `../upstream/types/hermes`). Neither file imports these names from
  `src/upstream/`.
- `npm run typecheck` (`tsc -p . --noEmit`) — exits clean, no output, no errors.
- `npm run check` (typecheck + vitest + plugin tests + lint + prettier) — full green: 74/74 test
  files, 782/782 vitest tests, 52/52 Python plugin tests, eslint clean, prettier clean. Full tail
  pasted below in section 5.

This matches what commit `14980e8`'s message already claims: `CronBlueprint`/`CronBlueprintField`
were removed from `src/upstream/types/hermes.ts` and turned into local types in `src/api/cron.ts`
back in "M15 round 1" (before this branch existed), because upstream's own desktop app never
declared a type under that name at any commit — only `AutomationBlueprint`/
`AutomationBlueprintField` ever existed there. `src/api/cron.ts`'s own header comment (lines 21-35)
documents this in detail. I did not take the commit message on trust for the bottom-line claim —
the grep and the two check runs above are my own verification that the break the task describes is
already absent from this tree.

**Exit-criterion status: closed, but not by work in this session.** The re-pin
(`scripts/sync-upstream.mjs` run against `ee84ccd8bd13`) and the `CronBlueprint` extraction were
both already committed before I started. My contribution in this section is independent
verification, not a fix.

## 2. What replaced CronBlueprint upstream — **not applicable**

Since `CronBlueprint`/`CronBlueprintField` were never upstream types (see above), there is no
upstream rename/restructure commit to find for them. I did not search hermes-agent history for a
"cron blueprint rename" commit because the premise (that one exists) doesn't hold — checked
directly, not assumed. The real cron RPC type this app does vendor,
`AutomationBlueprint`/`AutomationBlueprintField` in `src/upstream/types/hermes.ts`, is unrelated to
this app's `CronBlueprint`/`CronBlueprintField` and is not consumed by `src/api/cron.ts` or
`NewTaskSheet.tsx` at all (checked: no reference to `AutomationBlueprint` outside
`src/upstream/types/hermes.ts` and the comment block in `src/api/cron.ts` quoted above).

## 3. Adapting consuming code — **nothing needed for cron; one real gap found and fixed elsewhere**

No changes to `src/api/cron.ts` or `src/components/NewTaskSheet.tsx` were needed: `npm run check`
is green as-is (section 1). I did not hand-edit anything under `src/upstream/`.

What I did find and fix, outside the cron path: the icon-alias generator had not been re-run as
part of the `ee84ccd8bd13` re-pin, leaving its output stale. Detail and evidence in section 6
(drift area 5, "icon alias module"). That fix is `src/lib/icons.ts` only — a generated file outside
`src/upstream/`, produced by re-running its own generator script
(`node scripts/generate-icons.mjs`), not a hand-edit.

## 4. Sync twice — idempotent (verified, path: two full script runs + git diff)

Run 1:

```
$ node scripts/sync-upstream.mjs
... (28 "(unchanged)" lines, 2 files rewritten without that marker: shared/json-rpc-gateway-replay.test.ts, shared/websocket-url.ts)
sync-upstream: wrote 30 files to src\upstream
$ git status --short
(empty)
$ git diff --stat
(empty)
```

Run 2 (immediately after, no changes to the working tree or to hermes-agent in between):

```
$ node scripts/sync-upstream.mjs
... identical output shape to run 1, same two files without "(unchanged)"
sync-upstream: wrote 30 files to src\upstream
$ git status --short
(empty)
$ git diff --stat
(empty)
```

Both runs produced zero git diff and identical console output. `UPSTREAM.json.commit` stayed
`ee84ccd8bd13d0025e98bb6be8ceb93303e3bdff` through both. The two files that never print
"(unchanged)" (`shared/json-rpc-gateway-replay.test.ts`, `shared/websocket-url.ts`) are a logging
quirk in the script (that label only prints for files that go through its patch-diff-assertion
path) — the `git diff --stat` result after each run is the actual idempotency evidence, not the
console labels, and it was empty both times.

**Exit-criterion status: closed.** This confirms the working tree already matched a fresh sync
output before I touched anything (i.e., `14980e8`'s original sync was already correct), and a
second run changes nothing.

## 5. `npm run check` green (verified, path: full run, tail pasted)

Ran twice: once before touching anything (section 1), once after regenerating `src/lib/icons.ts`
(section 6). Tail of the second run:

```
> hermes-android@1.0.0 test
> vitest run
...
 Test Files  74 passed (74)
      Tests  782 passed (782)
   Start at  23:06:45
   Duration  2.87s ...

> hermes-android@1.0.0 test:plugin
> python -m unittest discover -s server-plugin/hermes-push/tests -t server-plugin/hermes-push -p "test_*.py"
...
Ran 52 tests in 3.705s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
```

(The `RuntimeError: boom` traceback visible mid-run is expected: it's a mocked failure exercised by
one of the 52 Python plugin tests, not a real error — the suite still reports `OK`.)

This is a static/type-level and unit-test-level check only — `tsc --noEmit`, `vitest`, a Python
unit-test discovery run, `eslint`, and `prettier --check`. **I have no Android emulator or device
in this environment; nothing here was run on-device or in Metro/Expo.** Scope: general (whole
repo's typecheck/lint/test suite), not a device- or path-verified UI check.

## 6. Drift report — all five areas checked

Old pin: `b973068c60ae92c1928041cb6a8e53a80bcf9c4c` (2026-09-07). New pin:
`ee84ccd8bd13d0025e98bb6be8ceb93303e3bdff`. 479 commits apart per `14980e8`'s message (not
re-counted by me — I did not run `git rev-list --count` myself; this one number is taken on trust
from the existing commit message, everything else in this section is my own diff).

### (a) Gateway events — **unchanged** (component: `src/upstream/lib/gateway-events.ts`)

- `git show 14980e8 -- src/upstream/lib/gateway-events.ts` — empty diff (file not touched by the
  re-pin commit).
- Directly at the hermes-agent level: `git diff --stat <old> <new> -- apps/desktop/src/lib/gateway-events.ts`
  (run from `D:\Stuff\Code\git\hermes-agent`) — empty.
- Consumers (`src/gateway/*.ts`, `src/net/*.ts` — local app code, not vendored) were not
  re-examined beyond confirming their one upstream input didn't change; since the vendored file is
  byte-identical, there is nothing for them to drift against. No follow-up needed.

### (b) RPC shapes in `types/hermes.ts` — **changed**, no follow-up fix needed

Path: `src/upstream/types/hermes.ts`. `git show 14980e8 -- src/upstream/types/hermes.ts` shows:

- `SessionMessage` gained an optional `codex_message_items?: unknown` field.
- `UsageStats` and `ContextBreakdown` both gained optional `context_estimated?: boolean` and
  `context_source?: string`.
- `MoaConfigResponse` (both the nested and top-level shape) **lost** `max_tokens: number` and the
  optional `reference_max_tokens?: number | null`.

Checked whether any of this app's own code reads the removed or added fields:
`grep -rn "reference_max_tokens|\.max_tokens\b|codex_message_items|codex_reasoning_items|context_estimated|context_source" src/ app/` excluding `src/upstream` itself — zero matches. Nothing in
this app consumes any of these fields, so the removal didn't break typecheck (confirmed green in
section 1/5) and the additions are inert. **No follow-up fix required by this change**; flagging it
here per the task's instruction to name every changed area even without an accompanying break.

### (c) Theme presets — **unchanged** (component: `src/upstream/themes/{types,color,retint,presets}.ts`)

Same method as (a): `git show 14980e8 -- src/upstream/themes/` is empty, and
`git diff --stat <old> <new> -- apps/desktop/src/themes/` at the hermes-agent level (run from
`D:\Stuff\Code\git\hermes-agent`) is also empty. `src/theme/*` (this app's own consumers) were not
re-examined beyond that, for the same reason as (a).

### (d) `en.ts` — **changed**, no build follow-up needed, one product gap flagged

Path: `src/upstream/i18n/en.ts` (140 lines added) and `src/upstream/i18n/types.ts` (135 lines
added, the `Translations` type these labels satisfy). `git show 14980e8 -- src/upstream/i18n/en.ts`
shows two additions:

- A brand-new `sessionImport` label group (~26 keys) — "Continue from another app": importing a
  Claude Code/Codex session log into Hermes, with its own scanning/empty/preview/import-error copy.
- New keys under the existing `agents` group: `extendedTranscript`, `transcriptTruncated`,
  `transcriptUnavailable`, `moreAgents`, `queued`, `waitingActivity`, `steer`, `steerPlaceholder`,
  `steerQueued`, `stopRequested`, `requestRejected` — i.e., desktop grew a subagent "steer" control
  and queued/waiting states.

`npm run typecheck`/`check` stayed green through this (confirmed in sections 1 and 5), so nothing
in this app's existing code broke. **Gap, not fixed, named explicitly:** these are labels for two
upstream desktop features — session import and subagent steering — that this Android app's UI does
not yet implement. The strings are now vendored (harmless, unreferenced) but there is no consuming
screen. This is a product/feature gap, not a build gap, and it is out of scope for D21.3.2 (which
is about not breaking the build), so I did not build UI for either feature. Flagging it here rather
than silently absorbing it, per instructions not to fix scope I wasn't assigned.

### (e) Icon alias module — **changed** (stale), found and fixed

Two generators exist; only one is tied to the hermes-agent pin:

- `scripts/generate-codicon-map.mjs` → `src/components/codicon-map.ts`: reads
  `@vscode/codicons`' own npm package, not hermes-agent — by its own header comment, "not tied to
  the UPSTREAM.json commit". I re-ran it anyway for completeness:
  `node scripts/generate-codicon-map.mjs` → `generate-codicon-map: wrote src\components\codicon-map.ts (535 icons)`,
  then `git diff --stat -- src/components/codicon-map.ts` — empty. Unchanged, as expected (it isn't
  part of this drift surface at all).
- `scripts/generate-icons.mjs` → `src/lib/icons.ts`: reads
  `apps/desktop/src/lib/icons.ts` **at the commit recorded in `UPSTREAM.json`** — this one is
  exactly the surface the task asked about. Before I touched it,
  `git status --short src/lib/icons.ts` was empty (looked unchanged). Running
  `node scripts/generate-icons.mjs` produced a one-line diff:
  ```
  -// b973068c60ae92c1928041cb6a8e53a80bcf9c4c — do not hand-edit; re-run the script instead. Same alias names
  +// ee84ccd8bd13d0025e98bb6be8ceb93303e3bdff — do not hand-edit; re-run the script instead. Same alias names
  ```
  Only the header's recorded commit hash changed — the actual icon alias table (the `IconX as Y`
  lines) is byte-identical between the two pins, so there was no icon rename/addition upstream to
  adapt to. But the **file itself was stale**: commit `14980e8` bumped `UPSTREAM.json` and the
  `src/upstream/` vendor tree, and separately fixed `CronBlueprint` earlier, but never re-ran
  `scripts/generate-icons.mjs` against the new pin, so `src/lib/icons.ts` kept claiming to be
  generated from the old commit. This is a real (if cosmetic) drift bug: the file's own provenance
  comment was lying about which commit it came from. **Fixed in this session**: ran the generator,
  the one-line diff above is staged for commit. Re-ran `npm run check` afterward (section 5) —
  still fully green.

## Summary against the task's exit criteria

| # | Item | Status |
|---|---|---|
| 1 | Reproduce the CronBlueprint break | **Not reproduced** — already fixed before this session (M15 round 1, predates this branch); verified absent via grep + typecheck + full check, not fixed by me |
| 2 | Find upstream's replacement for CronBlueprint | **N/A** — CronBlueprint was never an upstream type; nothing to find |
| 3 | Adapt consuming code | **Nothing needed for cron**; one real staleness bug found and fixed in `src/lib/icons.ts` (generated file, not hand-edited) |
| 4 | Sync twice, second is no-op | **Closed** — two runs, `git diff --stat` empty both times |
| 5 | `npm run check` green | **Closed** — full tail pasted, static/unit-level only, no device |
| 6a | Gateway events | **Unchanged** |
| 6b | RPC shapes (`types/hermes.ts`) | **Changed** — new optional fields on `SessionMessage`/`UsageStats`/`ContextBreakdown`, `max_tokens`/`reference_max_tokens` removed from `MoaConfigResponse`; no consumer, no follow-up needed |
| 6c | Theme presets | **Unchanged** |
| 6d | `en.ts` | **Changed** — new `sessionImport` and `agents.steer*` label groups; no build impact; product gap named (no UI consumes them) |
| 6e | Icon alias module | **Changed (stale)** — content identical, provenance comment stale; fixed by re-running `scripts/generate-icons.mjs` |

## What I did not check (named, not rounded up)

- I did not independently recount "479 commits" between the two pins (took the existing commit
  message's number on trust).
- I did not audit the full 479-commit range commit-by-commit for anything outside the five named
  drift areas — only the five areas the task named, plus the two icon generators.
- No Android build, emulator, or physical device was used anywhere in this session. Every "green"
  or "unchanged"/"changed" claim above is static (git diff, `tsc`, `vitest`, `eslint`, `prettier`,
  Python `unittest`) — general or path scope over source/config, never device or path scope over a
  running app.
- I did not investigate whether the new `sessionImport`/`agents.steer*` en.ts strings should
  eventually get a screen — that's a product decision outside D21.3.2, only flagged as a gap.

## Evidence table

| Claim | Scope | Build | Evidence path (command + output / diff / file) |
|---|---|---|---|
| CronBlueprint/CronBlueprintField break not present in this tree | general (whole-repo typecheck) | static (`tsc`) | `npm run typecheck` — clean, no output; `src/api/cron.ts:21-35` doc comment; grep in section 1 |
| `CronBlueprint`/`CronBlueprintField` are local types, not vendored | path (`src/api/cron.ts` → `src/components/NewTaskSheet.tsx`) | static (grep + read) | `grep -rn "CronBlueprint"` (section 1); `src/api/cron.ts:68-90` |
| D5 gate holds (upstream HEAD == pin, allow-listed paths clean) | general (repo pair) | static (git) | `git -C D:\Stuff\Code\git\hermes-agent rev-parse HEAD` = `ee84ccd8bd13...`; `git -C D:\Stuff\Code\git\hermes-agent status --short apps/desktop/src apps/shared/src` — empty |
| Sync is idempotent | general (`scripts/sync-upstream.mjs` full allow-list) | static (script + git) | two `node scripts/sync-upstream.mjs` runs, `git status --short` / `git diff --stat` empty after each (section 4) |
| `npm run check` green | general (whole repo) | static (`tsc`/`vitest`/pytest/`eslint`/`prettier`) | full tail, section 5; re-run after icons.ts fix, still green |
| Gateway events unchanged | component (`lib/gateway-events.ts`) | static (git diff) | `git show 14980e8 -- src/upstream/lib/gateway-events.ts` — empty; hermes-agent-level `git diff --stat <old> <new> -- apps/desktop/src/lib/gateway-events.ts` — empty |
| `types/hermes.ts` RPC shape changed, no consumer | component (`types/hermes.ts`) + general (grep over `src/`, `app/`) | static (git diff + grep) | `git show 14980e8 -- src/upstream/types/hermes.ts` (full diff quoted in section 6b); grep for the six added/removed field names — zero hits outside `src/upstream` |
| Theme presets unchanged | component (`themes/{types,color,retint,presets}.ts`) | static (git diff) | `git show 14980e8 -- src/upstream/themes/` — empty; hermes-agent-level diff — empty |
| `en.ts` gained `sessionImport` + `agents.steer*`, no build impact | component (`i18n/en.ts`, `i18n/types.ts`) | static (git diff + `npm run check`) | `git show 14980e8 -- src/upstream/i18n/en.ts` (diff quoted in section 6d); `npm run check` green |
| Icon alias module was stale, now fixed | component (`src/lib/icons.ts`) | static (script + git diff) | `node scripts/generate-icons.mjs` → one-line diff (commit hash only), section 6e; `npm run check` re-run green after |
| codicon map unaffected by this pin | component (`src/components/codicon-map.ts`) | static (script + git diff) | `node scripts/generate-codicon-map.mjs` — empty diff |
