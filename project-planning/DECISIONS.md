# Decision log

Decisions that change or clarify the plan's fixed rules. Owner: Fable (escalation). Sonnet and
Opus record evidence and propose; only entries here change a rule. Newest at the bottom.

## D1 — M03 criterion 2: "transport loss mid-turn", radio behaviour moves to M07 (2026-09-07)

**Decision.** Option (a). M03 exit criterion 2 is reworded to *"Transport loss mid-turn: after
reconnect the assembled text equals `session.resume` history with no duplicate or missing
`seq`."* It is verified by Opus's host-side TCP cut (sha256-identical text, watermarks never
regressed across cut, second reconnect, and backend restart). M03 is `done`. A new
physical-device criterion covering the radio layer (airplane mode, `ConnectivityManager`
callbacks, OS socket teardown, IP change) is added to M07, which already owns doze and network
switching.

**Reasoning.** The criterion's purpose was to prove the client's reconnect and replay protocol,
and that has been proven more rigorously than an airplane-mode toggle would have: the cut landed
after `message.start` with zero deltas received, the worst case for replay. The mechanism named in
the original wording cannot be exercised on an emulator behind `adb reverse`, and the server's
loopback rules leave no other transport in token mode. Holding M04 and M06 hostage to a phone
buys nothing, because radio behaviour is an OS-lifecycle concern that M07's lifecycle module will
be built and tested for anyway. The original wording stays visible in M03 so the reword is
auditable.

**Device policy (closes handover escalation #4).** Emulator runs may mark a milestone `done` when
the criterion is about protocol or UI behaviour. Criteria about radio, doze, cookie persistence
across process death, Custom Tabs redirects, and push delivery must be run on a physical device
before `done`; each such criterion is tagged `[physical]` in its milestone file (M04, M07, M08,
M11).

*Device policy amended by D9 (2026-09-08): `[physical]` criteria gate M12 through the deferred
criteria register, not each milestone's `done`.*

## D2 — Session reap: embrace reclaim-on-reconnect; the 20 s grace is a coincidence, not a contract (2026-09-07)

**Decision.** M07 does not fight the reap. The client keeps the socket open for its own 20 s
grace after backgrounding (so late approvals land), then closes. On return it redials, replays,
and handles **both** outcomes: no reclaim (reconnect landed inside the server grace) and
`session.reclaimed` (reconnect landed after it). State is keyed by stored session id, exactly as
M03 already does. The client must not depend on the server's number: `ws_orphan_reap_grace_s` is
config-tunable and `0` disables reaping entirely.

**Reasoning.** Opus confirmed from `tui_gateway/server.py:126-133` and
`tui_gateway/session_lifecycle.py:488-492` that the server parks an orphaned session for a
20-second grace and a reconnect or `session.resume` cancels the reap. The implementer's "reaped
within seconds" was an artefact of gaps longer than 20 s. Nothing in M07's design needs to change,
but the assumption is now written down with the right reason: the two 20 s windows are
independent defaults that happen to match. Keeping a background socket alive longer would fight
Android, not the server, and the server continues a running turn regardless (the activity-stale
interrupt is 600 s).

*Client-side grace withdrawn by D10 (2026-09-08); the reclaim-handling half of this decision stands.*

## D3 — Build path: WSL2 for development, EAS Build for release (2026-09-07)

**Decision.** Keep the WSL2 build path as the supported local development route and document it
as such. Do not spend further effort diagnosing the Windows AF_UNIX failure. Release and store
builds (M12) go through EAS Build with credentials managed by EAS; `apk:release` via local Gradle
becomes optional. The WSL machine state (`~/.jdks/temurin-21`, `~/Android/Sdk`,
`~/.nvs/node/v24.16.0`) is accepted and listed in `docs/CONNECTING.md` as required setup.

**Reasoning.** The failure was root-caused across JDK 17 to 25 to an AF_UNIX `connect` returning
EINVAL below the JVM on this specific Windows build. That is a machine problem, not a project
problem, and it may not reproduce on any other developer's machine. WSL2 works and has now been
verified twice (32 min cold, 20 min from a clean prebuild). Release signing must not depend on any
one machine's quirks, which is exactly what EAS removes, and M12 already listed an EAS production
profile.

## D4 — Untracked tool artifacts are ignored, not committed (2026-09-07)

**Decision.** Add `.agents/`, `.claude/`, `.zcode/`, and `skills-lock.json` to `.gitignore`. They
are per-developer AI-tooling skill packs pulled in by the implementer's environment, contain no
project code, and can be re-fetched by anyone. `project-planning/HANDOVER-2026-09-07.md` and this
file are committed.

## D5 — Read-only upstream: vendor from git objects, not the working tree; narrowed gate ratified (2026-09-07)

**Decision.** Two parts.

1. `scripts/sync-upstream.mjs` must read every allow-listed file from the upstream **git object**
   (`git -C $HERMES_AGENT_ROOT show HEAD:<path>`), never from the working tree, and record that
   commit in `UPSTREAM.json`. It must also validate all patches into a temporary directory and
   only then replace `src/upstream/`, so a failed run cannot leave the directory deleted. Assigned
   to Sonnet as an M02 follow-up.
2. Opus's narrowed verification gate is ratified and restated: upstream `HEAD` equals
   `UPSTREAM.json.commit`, and `git -C ../hermes-agent status --short` shows no entries under any
   allow-listed path. Working-tree noise elsewhere in the checkout is out of scope.

**Reasoning.** The rule exists so the app is built from known upstream code and never edits that
code. A parallel session legitimately working in the same checkout makes an exact-file-list gate
unusable, and quiescing or cloning the checkout for every verification is friction with no
security benefit. Reading from git objects makes the guarantee structural: uncommitted edits in the
checkout cannot leak into `src/upstream/` at all, so the gate only needs to confirm the commit and
that nobody is mid-edit on a vendored path. This does not weaken the "never edit hermes-agent from
this project" rule, which stands unchanged.

## D6 — M06 transcript-scroll criterion split; prepend anchoring has no owner yet (2026-09-08)

**Decision.** Deviation #1's split is ratified with one change. M06's scroll criterion becomes:
(a) `[physical]` frame rate on a 2,000-message transcript on a mid-range phone, deferred under D8;
(b) structural scroll behaviour on the emulator with render-count evidence, limited to **FlashList
recycling and tail-only re-render on streaming deltas**. Both halves of (b) are closed with counts
(Sonnet 16 slots / 29 messages / 11 recycled, Opus 18 / 30 / 15; tail-only 2-vs-162 and 2-vs-4).
`maintainVisibleContentPosition` anchoring on prepend is **removed from (b)**: nothing in M06
prepends to a scrolled transcript (`session.resume` seeds history in one shot), and nothing in
M07's task list does either — M07 paginates the session list, not a transcript. It is entered in
the deferred criteria register (`implementation-plan/README.md`) with owner "the first milestone
that adds a transcript prepend path (history pagination)". If no milestone does by M12, the prop
stays configured defensively and no criterion is owed.

**Reasoning.** A criterion with no code path is not a gap, and parking it on M07 would assign it to
a milestone that has no prepend either. The instrumentation that closed the other two sub-parts is
`__DEV__`-guarded in `src/chat/Transcript.tsx` and stays, so whichever milestone adds a prepend
inherits a ready measurement. Opus's false-negative note is the re-run instruction: below roughly
20 messages FlashList never recycles, and the 1:1 slot-to-message mapping looks like a refutation
when it is only a scale artefact.

## D7 — "Desktop and phone on the same session" reworded to "a second concurrent client"; read-only means no source edits and no gate impact (2026-09-08)

**Decision.** Two parts.

1. M06's criterion is reworded to *"A second concurrent client on the same session:
   `session.reclaimed` handled without a stuck composer, both reconnect branches (inside and after
   the server orphan grace)."* Closed by `scripts/second-client-reclaim.mjs`, both branches driven
   live. The named gap — desktop-shaped event payloads and `source: "desktop"` toolsets against the
   real desktop app — goes in the deferred criteria register, owner Opus, unblocking condition
   "`apps/desktop/**` has no uncommitted changes in `../hermes-agent` at build time". It does not
   hold M06.
2. **Rule clarification.** "hermes-agent is read-only" forbids source edits and anything that would
   change the D5 gate (`git -C ../hermes-agent status --short` under an allow-listed path). Build
   output in paths upstream itself ignores is permitted: upstream's `.gitignore` already covers
   `apps/desktop/dist/`, `apps/desktop/build/` and `node_modules/`, so a desktop build cannot appear
   in the gate. Two conditions apply when a desktop build is used as verification evidence: record
   the upstream commit it was built from, and confirm no uncommitted changes under `apps/desktop/`
   at build time, otherwise the evidence is of unknown code. Running an already-built `dist/`
   writes nothing to the checkout and needs neither.

**Reasoning.** The wire-level reclaim contract is what the criterion protects, and the Node script
drove it harder than a desktop session would have: it discovered that `session.reclaimed` is a
global broadcast delivered only to sockets connected when the reap timer fires, and fixed its own
first draft accordingly. The rule question deserved an answer rather than a per-milestone dodge.
The gate is structural (D5 reads git objects), so ignored build output cannot leak into
`src/upstream/`, and there is no reason to forbid it. The actual disqualifier at the time was a
concurrent session mid-edit in `apps/desktop/src/**`, which condition (2) now covers explicitly.

## D8 — M06 deferral bundle: PDF deferred, frame rate deferred with a target, SecretCard returned to Sonnet (2026-09-08)

**Decision.**

- **PDF attachment.** The attachment criterion is split like D6: the image half is closed (upload,
  server-assigned reference, correct vision-model reply); the PDF half is deferred, owner Sonnet,
  unblocking condition "poppler (`pdftoppm`) on PATH for the machine running `hermes serve`".
  Installing it is a dev-machine change, so ask the user before installing; WSL2
  `apt install poppler-utils` with `hermes serve` run from WSL is the least invasive route.
  Re-check target: the next throwaway server session (M07 verification).
- **`[physical]` frame rate.** Deferred, owner Opus, target: the batched physical pass when the
  device arrives (user, 2026-09-08: an OEM-skinned Android phone, weeks away). If no device is
  attached by **2026-10-31**, this returns as a policy escalation, not a per-milestone one.
- **SecretCard: not deferred.** The trigger exists on this install. Upstream
  `tools/skills_tool_setup.py` (`_capture_required_environment_variables`) routes any skill with a
  missing required env var into the registered secret-capture callback, which
  `tui_gateway/agent_callbacks.py` (`_wire_callbacks`, `secret_cb`) turns into
  `_block("secret.request", ...)`. The only gate is `HERMES_INTERACTIVE`, which `hermes serve`
  sets process-wide in `tui_gateway/server.py`. The bundled `/airtable` skill declares
  `prerequisites.env_vars: [AIRTABLE_API_KEY]`, and `source: "android"` sessions receive the
  configured CLI toolsets plus `project`, so the skills tool is reachable. Sonnet drives it on a
  throwaway `hermes serve` with `AIRTABLE_API_KEY` absent from `~/.hermes/.env` and the process
  env, prompting the agent to use the airtable skill. Prove both branches: **skip** (empty reply →
  `skipped`, nothing written) and **submit** a dummy value, which `save_env_value_secure` writes to
  `~/.hermes/.env`, so back up and restore `.env` with the same diff-plus-sha256 discipline used for
  `config.yaml`. Confirm `FLAG_SECURE` for SecretCard the way it was for SudoCard. If it fires,
  M06 criterion 1 closes fully. If it demonstrably does not, Sonnet records the exact code reason
  and the criterion is deferred under D9's standing rule without a fresh escalation.

**Reasoning.** Two of the three are outside the client's reach today, and naming the gap is better
than holding a finished milestone. The third was never blocked: both Sonnet and Opus concluded "no
trigger exists" from failed attempts rather than from the upstream trigger path, the same
conservatism that under-claimed the slash-palette criterion. Deferring it would have shipped the
one card in the four-part criterion whose own behaviour has never been observed.

## D9 — Device policy amended: `[physical]` gates M12, not each milestone; standing rule for environment-blocked criteria (2026-09-08)

**Decision.**

1. **D1's device policy is amended.** A milestone may be marked `done` by Opus when every
   non-`[physical]` criterion is closed and every open `[physical]` criterion is listed in the
   deferred criteria register in `implementation-plan/README.md`. The register is an exit gate of
   **M12**: no release to the Play internal track with an open `[physical]` entry. D1's list of what
   counts as physical (radio, doze, cookie persistence across process death, Custom Tabs redirects,
   push delivery) stands unchanged. Under this, M04 may be marked `done` now (four of five closed,
   the fifth physical) once its register entry exists.
2. **One batched physical pass**, owner Opus, when the device arrives: M04 cookie persistence, M06
   frame rate, and whatever M07 has landed by then (airplane mode, doze, Wi-Fi to cellular). The
   device is an OEM-skinned phone, which is the representative choice for the OEM-dependent
   criteria (M04 cookies, M08 Custom Tabs) and a fair "mid-range phone" for M06's frame rate.
3. **Standing rule for environment-blocked criteria.** A criterion blocked by the dev environment
   rather than the code may be deferred by register entry without a Fable escalation when all three
   hold: Sonnet shows the block with a command and its output; Opus independently confirms from the
   upstream trigger path (code inspection, not failed attempts) that nothing reachable can provoke
   it; and the register entry names the gap, the owner, the unblocking condition and a re-check
   target. Fable is still required when a criterion's wording changes, or when a deferral would
   carry past M12.

**M07 may start now.** Its dependency on M06 is session state and the connection layer, both
closed; it needs no PDF renderer, secret prompt or frame-rate number.

**Reasoning.** With a device confirmed but weeks out, the criteria are closable, and D1's intent
(never ship radio, doze or OEM behaviour unproven) is preserved by moving the gate to the release
milestone, where it actually protects something. Holding M04 and M06 `in-progress` while nobody
works on them makes the tracker lie about where effort is going. The third leg of the standing rule
exists because of SecretCard: "we could not provoke it" is not the same as "it cannot be provoked".

## D10 — Client-side background grace withdrawn; pending input requests must be restored from `session.resume`; M07 gate (2026-09-08)

**Decision.** Three parts.

1. **D2's client-side grace is withdrawn (M07 option (c)).** The sentence "the client keeps the
   socket open for its own 20 s grace after backgrounding, then closes" no longer applies. Sonnet
   deletes `BACKGROUND_GRACE_MS`, the `active -> background` timer path and the `isForeground`
   guard from `src/gateway/lifecycle.ts`, with the tests that drove them; `background -> active`
   (redial if needed, then the `ping` probe) and the `expo-network` handler stay. The M07 task line
   is reworded to *"`active -> background`: no client action; the socket is left to the OS and the
   server's orphan reap (D2, D10)"*, original wording kept visible. Everything else in D2 stands:
   both reclaim outcomes are handled, state is keyed by stored session id, the server's grace value
   is never assumed.
2. **The wedged composer Opus recorded is a code gap, not an ambiguity, and it gets a criterion.**
   `session.resume` returns `pending_approval` and `pending_clarify`
   (`tui_gateway/server.py`, the resume payload builder; vendored type
   `src/upstream/types/hermes.ts:676-693`). Nothing in `src/` or `app/` reads either field, so an
   approval that arrived while the transport was detached, or that the reclaim branch replaced with
   a fresh runtime session, is lost on the client while the server still waits for it, and the
   composer stays on Stop / Steer with nothing answerable. The desktop's `restorePendingApproval`
   in `apps/desktop/src/app/session/hooks/use-session-actions/index.ts` is the reference
   implementation. New M07 exit criterion, emulator-provable: *"A pending approval or clarify
   request survives background -> foreground on both reconnect branches: on return the card is
   mounted from `session.resume`'s `pending_approval` / `pending_clarify`, answerable, and the
   composer is not stuck."* Upstream has no resume field for `sudo.request` or `secret.request`, so
   those cannot be restored; on hydrate the client must clear any stale sudo or secret state so the
   composer does not wedge on them either, and the gap is recorded in the milestone file as an
   upstream limitation, not a register row.
3. **M07 gate.** `done` when the grace is removed with `npm run check` green, the new criterion is
   closed and Opus-verified, and the three `[physical]` rows already in the register stay
   accurate. No other decision is outstanding.

**Reasoning.** Android freezes the JS thread for the whole background window, so a JS timer cannot
close anything on schedule; it fires late, on resume, racing the reconnect it was meant to precede.
That mechanism has now produced two real bugs (the timer never firing, then the racy close) and
zero observed benefit: the socket sits open harmlessly for 90 s and more, and the server has its
own authority for a client that goes quiet, the 20 s orphan reap plus the 600 s activity-stale
interrupt. A native background task (option (a)) would buy a literal reading of D2 at the cost of a
foreground-service notification or WorkManager quirks per OEM, for a property nothing needs. The
lifecycle contract is therefore: the client reconnects and probes on return; the server decides
when a quiet client is gone; the client handles whichever outcome it meets. That contract is only
honest if what the server was waiting for comes back with the resume, which is why the pending
request restore is a criterion and not a note. For M11: an open socket does not mean the app is
awake, so push gating must use the presence endpoint M11 already designs, never socket state.

## D11 — Dev-machine changes: what Sonnet may do alone, what only the user does; EAS project id and plugin install for M11 (2026-09-09)

**Decision.** A standing rule, then the two M11 cases it settles.

1. **Sonnet may make a dev-machine change without escalation when it is local, reversible and
   unbilled**: files under `HERMES_HOME` (`~/.hermes/plugins/`, `config.yaml`, `.env`), tools on
   PATH, emulator state. Conditions: back up anything that already exists (sha256 recorded),
   test against a throwaway `hermes serve`, never the user's running instance, and restore or
   remove at the end of the round unless the user says to keep it. Poppler (D8) falls under this
   rule from now on; ask once, in the round's write-up, not as a blocking escalation.
2. **Only the user does**: creating accounts, logging in, entering credentials or payment details,
   accepting terms, and anything billed. Sonnet asks for the resulting identifier and continues.
3. **EAS project id (M11).** Option (c) now: build the whole push pipeline with token registration
   gated on `extra.eas.projectId` being present, and a clear in-app and log message when it is
   absent. The user creates the Expo account, runs `eas login` and `eas init` in this repo, and
   commits the `projectId` that lands in `app.config.ts`. D3 already routes M12 release builds
   through EAS Build, so the account is needed regardless; this is the moment to create it. The
   physical push-delivery criterion is already deferred under D9.
4. **Plugin install (M11).** Sonnet installs `server-plugin/hermes-push/` into
   `~/.hermes/plugins/hermes-push/` under rule 1: the directory does not exist today, so cleanup is
   removing it. Verify with a throwaway server on 9119 (`GET /api/plugins/hermes-push/devices`),
   never by restarting the user's own `hermes serve`. Note the risk that justifies the throwaway
   rule: the plugin's `pre_approval_request` hook runs inside every approval on whichever server
   loads it, so a bug there blocks approvals for that instance. Remove the folder at the end of
   the round and say so in the log; the install doc the task list already calls for is what the
   user follows to keep it.

*Correction by D13 (2026-09-10): the risk paragraph in part 4 is wrong; `pre_approval_request` does not fire for
gateway sessions. The throwaway-server rule stands for the ordinary reason.*

**Reasoning.** Every environment sign-off so far (poppler, tirith, the plugin folder, the EAS id)
has cost an escalation round for a change that is either trivially reversible or one only the
user can make. Splitting on reversibility and ownership answers all of them in advance. Account
creation and credentials are the user's by policy, not by preference.

## D12 — Remaining milestones run in parallel; verification is one pass per milestone plus regression tests (2026-09-09)

**Decision.** Two parts.

1. **Parallel execution.** M08, M09 and M11 run concurrently from now; M10 starts when M09's API
   port has merged, not when M09 is `done`; M12 starts when M08, M09 and M10 are `done` and M11's
   only open items are the register rows. Each milestone works on its own branch
   (`m08-portal-oauth`, `m09-settings`, `m10-management`, `m11-push-voice`) in its own git
   worktree, merged to `main` by fast-forward or a merge commit at each verified handoff, never by
   force. Collision points, owned as follows: `package.json` and `package-lock.json` (any branch
   that adds a dependency rebases onto `main` first and re-runs `npm ci`); `app/(main)/_layout.tsx`
   and the route tree (additive only, one screen per route file); `src/net/http.ts` and
   `src/net/auth/*` (M08 owns changes, others consume); native modules and `android/` (M08 owns;
   M11's native rebuilds batch with M08's). Shared dev resources: throwaway servers on distinct
   ports (M08 9120, M09 9119, M10 9121, M11 9122); one emulator, so device passes are serialized by
   Opus, not run concurrently; the user's `hermes serve`, `config.yaml` and `.env` are touched
   only under D11 rule 1.
2. **Verification shape.** Per milestone: `npm run check` green before handoff; one Opus emulator
   pass over the exit criteria, each with its command and output; a regression test for every bug
   found on device, failing on the pre-fix code. After a fix, Opus re-runs only the criteria the
   fix touched and accepts the rest from the prior pass by reference. Write-ups carry the command,
   the output, the verdict, and the root cause of anything found; the narrative of how a result
   was obtained goes in only when the next person needs it to reproduce. `[physical]` criteria go
   to the register (D9). Handover rule 5 ("only Opus changes a tracker status to `done`") stands.

*Amended by D13 (2026-09-10): the merger rebuilds the dev client from merged `main` whenever a merge adds or
changes a native module; device passes cite the merged commit they ran against.*

**Reasoning.** The dependency graph has been wider than the execution has: M08 depends only on
M04, M09 on M06, M11 on M07, and all three have been runnable since M07 closed. M06 cost three
full device passes and an 800-line milestone file for two implementation commits; the bugs were
real and verification found every one of them, so verification stays, but repeated full passes
and re-derived claims were the expensive part, not the passes themselves. Worktrees and owned
collision points are the minimum that lets three implementers share one repo without the
lockfile becoming the merge conflict of every round.

## D13 — Corrections from the 2026-09-10 Opus round: D11.4's hook claim, D12.1's rebuild gap, and `auth_required` detection (2026-09-10)

**Decision.** Three parts.

1. **D11.4's risk paragraph is withdrawn as stated.** `pre_approval_request` does not fire for
   gateway sessions. Verified at `../hermes-agent/tools/approval.py`: the `is_gateway or is_ask`
   branch returns through `_await_gateway_decision` (live `notify_cb`, wired at
   `tui_gateway/server.py:905` to a plain `approval.request` event write) or through
   `_pending_result`, and `_fire_approval_hook("pre_approval_request", ...)` sits below both, in the
   CLI-interactive path with `surface="cli"`. Every mobile session is a gateway session, so the
   plugin is not in the approval path and cannot block it. The throwaway-server rule in D11.4
   stands for the ordinary reason (do not test against the user's instance), not for that one.
   M11's poll-based watcher was the correct design for the same reason; the "Push design" prose in
   `M11-push-and-voice.md` that names the hook carries a correction note, original kept.
2. **D12.1 is amended: the merger rebuilds.** Worktrees do not share `android/`, so a branch APK
   contains only that branch's native additions and a build of the merged tree never exists by
   itself. Rule: whoever lands a merge to `main` that adds or changes a native module, an Expo
   config plugin, or `app.config.ts`'s `plugins` array rebuilds the dev client from the merged
   `main` commit before any device pass against that tree, installs it on `emulator-5554`, and
   records the commit hash and `BUILD SUCCESSFUL` line in the milestone's verification log. A
   device pass cites the hash it ran against; a pass against a branch APK is evidence for that
   branch only and is marked as such. Opus's merged-`main` build of 2026-09-10 (29 native modules,
   `BUILD SUCCESSFUL in 20m 18s`) is the current baseline. Prior M08/M09/M10 live claims made
   against branch APKs stand as branch evidence and are re-run only where the merged build
   behaves differently.
3. **`auth_required` detection is correct; no re-scoping of M08.** `hermes_cli/web_server.py`
   sets `app.state.auth_required = should_require_dashboard_auth(host, trusted_public_hosts)`:
   true for any non-loopback bind, or for a non-loopback `dashboard.public_url`. A
   `HERMES_DASHBOARD_SESSION_TOKEN` on a `127.0.0.1` bind is loopback token mode by the server's
   own definition, which is exactly the first row of the README auth matrix ("Loopback bind
   (ungated): paste session token; dev only"). A Portal-gated deployment is non-loopback by
   construction and reports true, so the app's short-circuit at `app/connect/index.tsx:42-48`
   matches the server contract. Harness for M08 from now on: engage the gate the way the server
   does, either `hermes serve --host 0.0.0.0` as M04 did, or `dashboard.public_url` set to a
   non-loopback hostname in `config.yaml` under D11 rule 1 with backup and restore. Overriding the
   health payload in a harness is not evidence of anything and is retired.

**Reasoning.** Two of these are my own text being wrong or incomplete, and the log should say
so where the next reader will look, rather than being silently edited. The hook claim was a
plausible reading of `VALID_HOOKS` that I did not trace into the approval path; Opus and Sonnet
did, independently. The rebuild gap was found the expensive way, by an APK missing a module the
other branch had added, and the rule now names the cost as the merger's. The `auth_required`
question was the right one to raise at plan level, and the answer is in the server's gate rule
rather than in any deployment we lack.

## D14 — M13 added: design parity with the desktop and usability; M12 depends on it; parity documented (2026-09-10)

**Decision.** Three parts.

1. **New milestone M13, "Design parity + usability"**, file
   `implementation-plan/M13-design-parity-and-usability.md`, depends on M09 and M10. M12 now
   depends on M13 as well as M08 to M11: the release build ships the polished UI. M13 has no
   `[physical]` criteria. The user's direction (2026-09-10): fonts, icons and colour scheme match
   the desktop app; usability is in scope.
2. **Parity is achieved by vendoring, not by imitation.** The desktop's skins live in four pure
   TypeScript files (`apps/desktop/src/themes/{types,color,retint,presets}.ts`) and the backend
   already pushes the active skin to every surface (`gateway.ready`, `skin.changed`, `config.get
   skin`). M13 adds those files to the sync allow-list and reads the same skin the desktop shows,
   so the two surfaces cannot drift. Icons come from the same Tabler set through an alias module
   generated from the desktop's, plus codicons for tool and file icons. Type follows what the
   desktop does: system sans for text, and the mono the desktop ships (JetBrains Mono, OFL) for
   code, since Android has none of the desktop's system mono faces. The Collapse brand face is
   for a wordmark only. Hard-coded colours become an ESLint failure outside `src/theme/**`.
3. **Parity assessment recorded** in `docs/PARITY.md`: at parity, absent by design, thinner,
   mobile-only. The thinner list is M13's usability backlog (slash-command routing, haptics) plus
   items already owned elsewhere (register rows, M06 Deviation #7).

**Reasoning.** The app was built milestone by milestone on placeholder styling with 452
hard-coded colours and no icon set; that was the right order (behaviour first), and the cost of
it is one focused pass now, before release, rather than a rewrite after. Reading the desktop's
theme model rather than screenshots means "matches the desktop" is checkable: the exit criteria
sample pixels against values produced by the vendored presets. Usability belongs in the same
milestone because the fix for most of it (touch targets, labels, states, haptics) touches the
same components the restyle does.

## D15 — Appendix A corrections (border family, radius), M13 close-out, and M14: screen layouts from the desktop prototypes (2026-09-12)

**Decision.** Four parts.

1. **Two corrections to M13 Appendix A, which Sonnet followed literally (M13 Deviation #1) and
   which Opus's `docs/DESKTOP-DESIGN.md` §13.8 caught.** (a) `applyTheme` in
   `apps/desktop/src/themes/context.tsx:249-256` overwrites four tokens with the skin's **solid**
   palette values after the CSS defaults: `border = c.border`, `input = c.input`, `ring = c.ring`,
   `muted = c.muted`. Appendix A.5 gave the stroke-mix formulas instead, so the phone today draws
   `nous` borders as a translucent blue-tinted stroke where the desktop draws `#d0d7de` light and
   `#30363d` dark. `resolveMobileTheme` changes those four lines, the pinned test values change with
   them, and the M13 colour criterion is re-sampled for `border`. The stroke-mix tokens stay
   available under their own names (`strokePrimary`…`strokeQuaternary`) for the surfaces that use
   them on the desktop (sidebar edge, composer ring, hairlines). (b) Appendix C's "radius 12px" was
   wrong: every desktop radius utility is multiplied by `--radius-scalar: 0.2`
   (`styles.css:123-130, 464`), so the desktop is near-square (controls 2.5px, icon buttons 4px,
   badges 3px, cards and menus 2–5px, dialogs 6.4px). Mobile adopts the same family in
   `src/theme/type.ts`: `radius.control 3`, `radius.icon 4`, `radius.card 5`, `radius.sheet 8`,
   `radius.full 999`, and nothing else; the 8/10/14/18 values on the branch are replaced. Both
   corrections are applied on `m13-design` in the milestone file's appendix so the record stays
   consistent.
2. **M13 close-out, then `done` and merge.** Sonnet fixes, with a failing-first test where one is
   possible: the `ToolIcon` typecheck error (split the prop types: `Codicon` takes `TextStyle`,
   `ToolIcon` takes `StyleProp<ViewStyle>`, no cast); the session-list search field to 48 dp
   min-height (a full-width text input meets the same floor as a button, since it is the first thing
   a thumb reaches for); the Appearance hint text to name the backend's skin from the synced value,
   not the device's active theme; and the type criterion is reworded to *"`src/lib/fonts.ts` logs
   `Font.isLoaded('JetBrainsMono')` once at boot in `__DEV__`, and it reads true in logcat"*,
   original wording kept. Then the border correction from part 1. Opus re-runs only criteria 1, 2
   (border column), 5 and 6, cites its Step 10 pass for the rest, marks M13 `done`, and merges
   `m13-design` into `main`. D13.2 applies: the merge adds native modules, so the merger rebuilds.
3. **New milestone M14, "Screen layouts from the desktop prototypes"**, file
   `implementation-plan/M14-screen-layouts.md`, depends on M13. M12 now depends on M14. Opus's
   `docs/DESKTOP-SCREENS.md`, `docs/DESKTOP-DESIGN.md` and `docs/desktop-prototypes/` are committed
   as the reference and are the source of truth for layout, order, labels and behaviour; the
   milestone file carries the mobile adaptation rules and the screen-by-screen mapping. The
   prototypes are desktop-shaped (1220×800, sidebar, titlebar, status bar, hover); M14 adapts, it
   does not shrink. Where the screens inventory exposed settings sections the phone lacks and that
   are not machine-bound (Chat, Safety, Memory & Context, Billing, Archived chats, About), M14 adds
   them; `docs/PARITY.md` is updated to say so.
4. **Labels are vendored, not retyped.** `apps/desktop/src/i18n/en.ts` joins the sync allow-list;
   every visible string on a ported screen comes from it, so a label mismatch is a test failure, not
   a review comment.

**Reasoning.** The border error is mine: I read the CSS defaults and not the runtime override that
replaces them, and the colour criterion's "border" row then passed against my wrong number. That is
the kind of error a second reader catches, and Opus did. The radius error is the same shape. Both
are cheap to fix now and expensive after M14 builds forty screens on them. M14 is a separate
milestone rather than more M13 because M13's exit criteria are about tokens, icons, type and
touch, all of which are closable now, while layout parity is per screen and needs the prototypes
Opus has just produced. Vendoring `en.ts` is the same move as vendoring the theme model: parity by
construction, checked by a test, instead of parity by inspection.

## D16 — M15 added (bots, tasks, chat affordances, pairing); Bot Mode is no longer "absent by design"; M12's internal-track build is pulled forward (2026-09-12)

**Decision.** Four parts.

1. **New milestone M15**, file `implementation-plan/M15-bots-and-mobile-ux.md`, depends on M14
   for its screens; its three data-layer tasks (bots, models, cron templates) may start on a
   branch during M14. Scope: a Bots tab with the desktop's avatars and souls, a Tasks tab, composer
   model and effort chips, response stats, jump-to-latest, hold-to-dictate-and-send, edit-and-
   resend, a Tailscale pairing path with a wrong-address guard, a connection-health banner, and
   edge-swipe navigation. Every item is specified against the desktop source and the gateway
   contract.
2. **PARITY reversed for Bot Mode.** Bots are profiles, canonical chats, souls and capabilities,
   all ordinary gateway data; only group rooms remain absent until the gateway offers a group
   transport to non-desktop sources. `docs/PARITY.md` is updated accordingly.
3. **Licensing rule.** `CodeUpdaterBot/Hermes-Mobile-App` is AGPL-3.0; this project is MIT. Its
   code is not read for implementation. Product ideas and interaction patterns are not
   copyrightable and are fair to adopt; code, assets and copy are not. Three numeric tunings in
   M15 (a 2.5 s hold, an 88 px swipe commit, a one-viewport follow window) are design choices
   restated from observation of the product, not from its source.
4. **M12 reordered.** The Play internal-track build and the landing page start now, in parallel
   with M13 and M14, gated only on the user's EAS and Play accounts (D11.2). M12's `done` (store
   release) still depends on M13, M14 and M15. Being second to a v0.1.1 costs nothing; being
   unfindable does.

**Reasoning.** The competitor's own architecture notes list as future work the transport, auth,
recovery, approval and attachment behaviour this project has verified on device across M03 to
M11. What it has that we lack is a product framing (bots as teammates), four or five composer and
reader affordances, an onboarding path that assumes Tailscale, and a listing people can find.
All of those are cheap relative to what is done, and the bots framing is a thin layer over data
the app already fetches. The order (M13 close-out, M14 layouts, then M15) holds because M15's
screens are built from M14's primitives and rules; starting M15's data layer early costs
nothing and shortens the tail.

## D17 — M14 close-out: settings order, read-only host config, per-chat model scope, profile editor, two criterion wordings (2026-09-13)

**Decision.** Five parts.

1. **Settings index order.** The phone's settings index uses the grouped order drawn in
   `docs/mobile-prototypes/settings.html`: Host, Models and tools, App, Account. Inside each group,
   sections keep the desktop's relative order from `settings/constants.ts`. M14's mapping row is
   reworded to name `settings.html`. `src/components/settings-rows.ts` (tested) already implements
   this order.
2. **Chat, Safety and Memory & Context stay read-only for the first release.** Their screens list
   the desktop's fields as inert rows, and the index shows them as `Host-managed`. Porting
   `config.get`/`config.set` and `approval_mode` read access becomes a new milestone, **M16 (host
   config editor)**, after M15. It is not an M15 slice. M16's file is written before M15 closes.
3. **A per-chat model pick changes only that chat.** M15 B's composer model chip follows the
   desktop's composer picker, which "never persists the profile default"
   (`apps/desktop/src/app/shell/model-menu-panel.tsx:216-220`).
   - It calls the gateway's `config.set` with `key: "model"` and the session's id
     (`tui_gateway/methods_config_set.py:107-135`).
   - It passes `--session` explicitly. Without a flag, `resolve_persist_behavior`
     (`hermes_cli/model_switch.py:493`) writes the pick to `config.yaml` in two cases: when the host
     has no `model.default` or `model.provider` yet, or when `model.persist_switch_by_default` is
     true.
   - A pick made mid-turn is held by the gateway until the turn ends
     (`methods_config_set.py:116-117`); the chip shows it as pending.
   - `/model` and Settings › Models remain the way to change the host default.

   This corrects M14 Deviation 11, which said a gateway model switch always moves the host default.
4. **The profile detail and SOUL editor belong to M15 A**, as the bot-settings data layer, built on
   `profiles.describe`, `profiles.configure`, `profiles.set_asset` and `profiles.get_asset` (gateway
   RPCs 5063–5066). M14 does not deliver them.
5. **Two M14 exit-criterion wordings, as accepted in the 2026-09-12 review.**
   (a) *Drawer order* is asserted against the order derived in
   `docs/mobile-prototypes/sessions.html` and `src/components/drawer-rows.ts`. `DESKTOP-SCREENS.md` §A
   is a screen inventory, not a nav order.
   (b) *Labels* is met by an AST scan of the source (`src/lib/labels.test.ts`, covering `app/`,
   `src/chat/` and `src/components/`), with `src/lib/strings.mobile.ts` as the only whitelist. This
   project's vitest setup renders no `.tsx` components, so a render test isn't possible. The
   substance is unchanged: a retyped label fails.

**Reasoning.** All five were flagged in M14 as needing a decision; none is a layout question.
- The desktop's flat settings rail doesn't survive becoming a two-level phone list.
- A read-only screen that says what it can't do is honest. A config editor is data-layer work and
  would delay M15.
- Scoping the model pick to the session matches the desktop and avoids a silent side effect on the
  host. The explicit `--session` guards the one case where the gateway persists by default.
- Recording the two criterion wordings stops a later reader from treating a verified criterion as
  unmet.

**Not decided here:** M14 Deviation 9, the six screens that render but cannot act yet (Chat, Safety,
Memory & Context, Billing, Command center, Agents). The options are to schedule their data-layer
catch-up, or to hide them in the first public build. It must be decided before M12's public
release. It does not block M14.

## D18 — The six screens that can't act yet: hidden in public builds, shown to testers, wired in M16 (2026-09-14)

**Decision.** Settles M14 Deviation 9 and the question D17 left open. Three parts.

1. **Public builds hide them; internal builds show them.** The six screens are Chat, Safety,
   Memory & Context, Billing, Command center and Agents.
   - The public (store) build removes their drawer rows and settings-index rows. The routes stay in
     the code, unreachable.
   - The Play internal-track build and dev builds keep them visible, with their existing
     `Host-managed` / explanatory states, so testers can see what's coming and report on it.
   - One build-time switch controls this. It lives in `app.config.ts` `extra` and is read in one
     place, so drawer and settings rows can't disagree.
   - M12 owns implementing it, as a release-hardening task: add the switch, filter
     `drawer-rows.ts` and `settings-rows.ts` through it, and test both flavours.
2. **M16 wires all six.** D17.2 already put Chat, Safety and Memory & Context in M16 (host config
   editor). Billing, Command center and Agents join it. Before M16 builds any of them, it checks the
   gateway for each screen's data (M14 Deviation 13's rule: name the layer searched). Possible
   sources, not yet confirmed as sufficient:
   - Command center: `/api/analytics/usage`, `/api/analytics/models`
   - Agents: `delegation.status`, `delegation.pause`
   - Billing: `billing.state`, `usage.bars`
3. **A screen unhides the moment it works.** Each screen's public-build hide is removed in the same
   commit that verifies its data layer on device. Nothing waits for M16 to finish as a whole.

**Reasoning.**
- A first public user who opens a settings screen that can't do anything reads the app as broken,
  and those six sit in the management area people open first.
- Testers are the opposite case: they need to see the whole surface to judge it.
- A build flag keeps one codebase and one set of screens, and costs a test per flavour.
- Hiding per screen, instead of waiting for all six, means the app never withholds a screen that
  already works.

## D19 — M15's Tasks exit criterion: "Running now" is conditional on the gateway reporting it (2026-09-16)

**Decision.** M15's Tasks exit criterion reads "triggering it shows 'Running now' and then updates
last run". It is met when:
- triggering the job updates last run, observed on device; and
- the Tasks screen shows the running state *whenever the gateway reports `state: "running"`*,
  using the desktop's own rule (`apps/desktop/src/app/cron/job-state.ts:16-20`,
  `jobState(job) === 'running'`), verified in code and tests.

A running pip visible on device is not required.

**Reasoning.** The gateway never sends that state today. `effective_job_state()`
(`hermes-agent cron/jobs.py:488-501`) returns only `completed`, `error`, `paused` or `scheduled`.
The only "running" signal is an in-memory scheduler probe (`scheduler.py:691`) that no route
exposes. M15 round 12 polled the gateway every 1.5 s across a triggered run and saw `scheduled`
throughout. The desktop client has the same limitation, so this is parity, not a mobile gap. If
the gateway starts exposing the state, both clients already render it.

## D20 — Readiness claims are gated separately from milestone status (2026-09-17)

**Decision.** Adopted from Opus's proposal in `an internal review note (not published)` §4, with the
scope widened in part 1.

1. **Scope.** This binds whoever makes the statement (Sonnet, Opus or Fable), wherever it is made:
   in a report, in chat with the user, or in any text drafted for a third party (a post, a DM, a
   store listing, a README status line). "Ready", "close to parity", "nothing blocks" and a
   feature list presented as working are all readiness claims.
2. **The check.** Before any statement that the app is ready to announce, demo to a third party
   or hand to testers, the claimant runs the release-readiness check and pastes the result beside
   the claim. Every item is met, or waived by name in this file for a stated audience:
   1. An installable non-dev build exists: signed, tagged, cold-started once, no dev-client
      overlay.
   2. No open `[physical]` register row, or each one explicitly waived for that audience.
   3. Identity reviewed: app name, package id, and an unaffiliated notice in the app and the
      README. `name: 'Hermes'` with `com.nousresearch.hermes.mobile` does not pass.
   4. The tracker README and the root README match the milestone files.
   5. Every feature named in the claim was seen end to end on a build of merged `main` (D13.2),
      with a real model on the wire, since the last change that touched its screen. A pass from
      before a restyle does not count for the restyled screen.
   6. No known defect in the approval, sudo or secret path is open without a root cause.
3. **A milestone being `done` never satisfies this check.** Closing a milestone also means
   updating the tracker README in the same commit (handover rule 5 stands: Opus makes that edit).
4. **Audiences, so "announce" stops meaning three things.** *Closed test*: named people, a signed
   build, items 1, 3, 4, 5 and 6 met, physical rows may be waived. *Open beta*: all six met,
   inert screens hidden (D18). *Public release*: M12 `done`.

**Reasoning.** Opus's review shows how the claim formed: exit criteria are emulator-scoped by
design (D1, D9), so "every milestone is done" was true and said nothing about release state,
identity, the physical register or whether restyled flows still work. Nothing required anyone to
read those before answering "can we announce". On 2026-09-17 that produced a drafted message to a
third party listing approval and clarify cards, voice and pairing as working, when by Opus's own
later list only Reject had been seen on the current build. The rule costs one checklist per claim
and makes the three audiences explicit, which is where the word "announce" slid.

## D21 — After the announce-claim reviews: a scope rule for round reports, and the ordered path to a closed test (2026-09-17)

**Decision.** Folds `an internal review note (not published)` (Opus) and
`an internal review note (not published)` (Sonnet) into rules and work. Three parts.

1. **Scope rule for every round report (Sonnet's proposal, adopted).** Any sentence that says
   "verified", "fixed", "met", "confirmed" or "device-verified" names what was tested in that
   sentence or the next: the input, the path, the instance, the theme, the build. It also says
   which of three scopes it is: *component* (one piece in isolation), *path* (one input end to
   end), or *general* (the inputs that matter). A guess is written as a guess. "Fixed" without
   "tested with X" is an intention, not a status. Build is always stated: branch dev client, or
   dev client built from merged `main` at a named commit (D13.2).
2. **The standing fact both reviews establish.** No device check in M13, M14 or M15 was run on a
   build of merged `main`; the D13.2 rebuild after merge `5d4871f` is still owed. Since the
   restyle, on any build, nobody has seen: approval Run / Allow this session / Always allow,
   clarify, sudo, secret, image or file attachment, the 25 s reconnect, OAuth login, skin sync,
   real-speech dictation or push. Only Reject has been seen. Cold start is unverified. The app is
   therefore "work in progress, not a beta" (Opus's words), and no readiness claim passes D20.
3. **Ordered path to a D20 closed test.** Each step names its owner; a step does not start a
   readiness claim.
   1. *Sonnet* — the approval path. Reproduce "no card after a Reject" (M14 close-out) with a wire
      trace beside the screen: second `approval.request` after a Reject in the same session, on
      both themes. Find the root cause; ship a failing-first test. For the overlap glitch, vary
      what the six attempts never did: font scale 1.3×, keyboard open, a long history, rotation.
      D20.2.6 makes this first.
   2. *Sonnet* — upstream drift. `CronBlueprint` / `CronBlueprintField` are gone upstream, so the
      next `sync-upstream` breaks the build. Re-pin deliberately: sync, fix what breaks, keep the
      sync idempotent.
   3. *Opus* — rebuild the dev client from merged `main` (D13.2) and run the whole end-to-end list
      on it with a real model on the wire: every item in the reviews' lists, both approval
      outcomes and all four buttons, plus a true cold start (kill, first launch). Results in a
      table under the D21.1 rule. The tracker README and the root README are corrected in the same
      commit.
   4. *User* — choose the app's name and package id (not "Hermes", not `com.nousresearch.*`);
      create the Expo account and run `eas init`; create the Play developer account.
   5. *Sonnet* — identity: rename, and an unaffiliated notice in About, the connect screen and the
      README. Then M12 part one: the D18 hide switch with a test per flavour, `eas.json` with a
      signed preview profile, a tagged build with no dev-client overlay, and the polish list
      (composer placeholder wrap, model sheet's cut-off last row, New task's missing Model row,
      `AppDrawer`'s zero-height backdrop).
   6. *Opus* — the D20 check for the closed-test audience, pasted in full. Physical rows may be
      waived by name for named testers; D20.2.6 may not be waived.
   M16 (the six inert screens' data layers) proceeds independently and unhides screens as D18.3
   says.

**Reasoning.** The reviews are candid and they agree. The failure was not dishonesty; it was
sentences whose scope exceeded their evidence, repeated by the next reader as fact, until a
passing milestone gate stood in for a release gate nobody had run. The scope rule fixes the
sentence; D20 fixes the gate; the ordered path puts the approval defect first because approvals
are what make a remote agent client safe to hand to anyone.

## D22 — App identity and distribution: package `com.symbyotic.hermes.mobile`; the display name is not "Hermes"; signed APK on GitHub Releases, no Play Store (2026-09-17)

**Decision.** Settles D21.3.4 on the user's direction: the package id, and distribution by APK on
GitHub only. No Play listing is planned.

1. **Package id and iOS bundle identifier: `com.symbyotic.hermes.mobile`.** It replaces
   `com.nousresearch.hermes.mobile` everywhere: `app.config.ts` (`android.package`,
   `ios.bundleIdentifier`), the native module's Kotlin package if it embeds the old id, the
   notification channel and deep-link intent filters if they reference it, `docs/CONNECTING.md`,
   the field kit's `adb` scripts, and every `run-as`/`pm` command in the milestone logs going
   forward (old logs are not rewritten). "hermes" inside the id describes what the app connects
   to; the namespace is the publisher's own.
2. **Order matters.** The rename lands **before** the first signed build anyone installs. Android
   treats a different package id as a different app: MMKV and SecureStore data do not carry over,
   which costs nothing before release and would cost every user their connections after it. If
   push is ever switched on, the Expo project and FCM registration bind to the id too.
3. **Display name: "Hermes Mobile"** (user's choice, 2026-09-17), slug `hermes-mobile`. It lives
   in one constant so it can change in one line. Two cautions are recorded, not blocking:
   `CodeUpdaterBot/Hermes-Mobile-App` already ships under the same name, so the two projects
   will be confused with each other; and the name alone does not say the app is unofficial.
   Because of the second, the unaffiliated line is mandatory wherever the name appears without
   context: the About screen, the connect screen footer, the README's first paragraph and every
   release note carry *"An independent, open-source client for Hermes Agent. Not affiliated
   with or endorsed by Nous Research."*
4. **Owner.** Sonnet, as the first task of D21.3.5, on its own branch, with a native rebuild
   (D13.2) and a cold-start check on the renamed build. The D5 upstream gate is unaffected.
5. **Distribution: a signed release APK attached to a GitHub Release. This amends D3 and D16.4.**
   - *Build.* A release APK from the WSL2 Gradle path (`assembleRelease`), which D3 kept as an
     option; EAS Build is no longer required for distribution. Sonnet writes
     `scripts/build-release-apk.sh`; it reads the keystore path and passwords from the
     environment at run time and never writes them anywhere.
   - *Signing key.* One keystore, created and held by the user (D11.2), never in the repo, backed
     up in two places. It is the permanent thing now: Android refuses to update an installed app
     with an APK signed by a different key, so a lost key means every user must uninstall and
     lose their data. This replaces the Play-listing permanence concern.
   - *Where.* This repository's GitHub Releases. The repository is private today; the user makes
     it public before the first release (decided 2026-09-17). Before that flip, Sonnet audits the
     history for anything that must not be public: tokens, passwords, scratch files, the user's
     hostnames or email in logs. A secret found in history is rotated, not just deleted.
   - *Each release.* Tag `vX.Y.Z`, APK attached, its sha256 in the notes, the known-gaps list,
     the unaffiliated statement, and sideload instructions (allow installs from the browser or
     file manager; Play Protect may warn about an unknown developer).
   - *Updates.* No store means no auto-update. 0.1.x ships without an updater; an in-app check
     against the GitHub Releases API is a later task, not a release blocker.
   - *Push.* Stays off in APK-only releases until the user creates an Expo project (`eas init`)
     and FCM credentials; the M11 register row stands. No Play developer account is needed.
   - *Gates unchanged.* D20 applies to a GitHub APK exactly as to a store build: a public APK is
     a public release. D18's hide switch applies to it.

**Reasoning.** An app id in another organisation's namespace, under that organisation's product
name, is the one announcement problem that cannot be fixed after the fact: it misleads users
about who stands behind the app and invites a takedown of the repository. GitHub-only
distribution removes two accounts and a review queue from the path, at the cost of sideload
friction, no auto-update, and a signing key that the user alone must never lose. The competitor disclaims affiliation on every
page; this project had no such statement anywhere. Doing the rename now, before anything binds to
the old id, makes it a one-hour change instead of a migration.

## D23 — 0.1.0: the signed-out dead end blocks the release; version 0.1.0, explicit versionCode, tag `v0.1.0` (2026-09-19)

**Decision 1 — the sign-out dead end blocks 0.1.0. Option (a), widened.**

A connection in `needsLogin` must offer "Sign in" wherever that state is shown, routing to the
existing `app/connect/[id]/login.tsx` with the connection's id kept. Scope, which is wider than
the two surfaces Opus named:

1. One shared piece (a hook or small component) derives the action from `needsLogin`, so
   surfaces cannot disagree. It is used by: the gateway card in Settings › Gateways; the auth
   error on Sessions; the same error on Bots and Tasks and any other list that can fail with an
   auth error; and the existing connection banner.
2. A confirmed 401 on a REST call marks the connection `needsLogin`, the same as an unauthorized
   socket close does, so the list screens reach the state without a session screen being open.
   `src/api/sessions.ts:56` already records a gap of this shape. This follows the `AGENTS.md`
   rule: reauth only on a confirmed 401/403, never on timeouts or 5xx.
3. "Retry" on an auth error is replaced by "Sign in"; retrying a request that failed for lack of
   a session cannot succeed.
4. **Acceptance, on a release APK of merged `main`, stated to D21.1:** (i) Sign out, then Sign in
   from the gateway card, connection id unchanged, sessions load; (ii) the **expiry path
   reproduced on device**: sign in, restart the throwaway gateway so the session is no longer
   valid (a new signing secret, or the password changed), return to the app on the Sessions
   list, and show that "Sign in" is offered and works without Remove; (iii) the same from Bots
   and Tasks. A failing-first test for the shared piece and for the REST 401 marking.
5. Remove-and-re-add is not an acceptable workaround for a release note. It discards the
   connection id, and the per-connection secrets in SecureStore are keyed by that id
   (`src/connections/secure.ts`: token, OAuth session, proxy headers).

**Reasoning.** A tester who signs out, or whose session the gateway expires, is locked out of an
app whose only job is to reach that gateway, and the screen in front of them offers a button
that cannot work. The route already exists; the fix is wiring. 0.1.0 is waiting on D20 item 6
regardless, so this costs no calendar time.

**What I checked myself, and what I did not.** Checked in code at `dc2fe9d`: the login route has
exactly two entry points (`app/(main)/sessions/[id].tsx:203`, the banner, and
`app/connect/index.tsx:305`, the add-connection flow); the gateway card's actions are use, test,
make primary, sign out and remove, with no sign-in; `needsLogin` is set on an unauthorized socket
close at `session-connection.ts:368`, `:384` and `:482` and on Sign out at `logout.ts:70`; the
SecureStore keys are keyed by connection id. Taken on Opus's word: everything observed on the
release APK, including that the banner did not appear and that Retry fails again. **Not verified
by anyone:** the expiry path on a device. I am not assuming it; acceptance 4(ii) exists to prove
or disprove it, and the decision does not depend on it, because the Sign out path alone is a
dead end a tester reaches by pressing a visible button. Also not checked by me: whether a REST
401 already marks `needsLogin` anywhere, and what besides secrets is keyed by connection id.

**Decision 2 — version, versionCode, tag.**

1. **Version string `0.1.0`**, in `app.config.ts` and `package.json`. `1.0.0` was the scaffold's
   default and says something the app is not. Semver from here: 0.1.x for fixes, 0.2.0 for the
   next feature release.
2. **`android.versionCode` is set explicitly in `app.config.ts`**, an integer starting at **1**,
   raised by one for every APK that leaves this machine, including a re-spin of the same
   version string. It is never reused and never derived. `docs/RELEASING.md` keeps a table:
   versionCode, version, commit, APK sha256, date. `ios.buildNumber` follows the same rule when
   an iOS build exists. The `preview/0.1.0` branch's version bump is superseded by this and can
   be deleted once this lands on `main`.
3. **Tag `v0.1.0`, annotated, created by the user** on the exact commit the real-key APK was
   built from, after Opus's D20 check passes on that APK (D22.5). The GitHub Release is marked
   **pre-release**. A published tag is never moved: a fix after tagging is `v0.1.1` with
   versionCode 2. The release notes carry the commit, the versionCode and the APK's sha256.

**Reasoning.** Nothing has been distributed, so this is free now and expensive later: Android
refuses an update whose versionCode is not higher than the installed one, and sideloaded users
have no store to sort that out for them. An explicit integer in one place, with a table, is the
simplest scheme that cannot collide.

**Checked / not checked.** Checked: `app.config.ts:19` and `package.json:3` both read `1.0.0`,
and no `versionCode` is set in `app.config.ts`. Taken on Opus's word: that the built APK reports
versionName 1.0.0 and versionCode 1, and that APK `9a4c2f64…` is the one D20 item 5 was checked
on. This entry does not re-examine D20 items 1 and 2 (signed non-dev build; physical rows); the
physical rows still need a waiver by name for the 0.1.0 audience before any public download.

## D24 — D23 amended after Opus reproduced the expiry path; who 0.1.0's audience is; physical rows are run, not waived (2026-09-19)

**Part 1 — D23 Decision 1, amended.** Opus reproduced expiry on the release APK
(`opus-approval-live/EXPIRY-PATH-2026-09-19.md`): after the gateway restarts with a new signing
secret, Sessions fails with a Retry that cannot work, New session fails, and the gateway card
still reads "Current · Password", not "needs sign-in". The dead end is real and `needsLogin` is
never set.

1. **Correction to D23.** I wrote that `needsLogin` is set on any unauthorized socket close and
   listed that as checked. It is true and beside the point: for a password connection with an
   expired session, `resolveAuth` fails at `POST /api/auth/ws-ticket`
   (`session-connection.ts`, the `catch` after the ticket mint), which sets only the
   screen-level `setConnectionAttention({ kind: 'needs-login' })`. The socket never opens, so
   the close handler never runs. Opus's first reading had the same gap; its device run found it.
2. **One state, set from every confirmed 401/403.** The registry's persisted `needsLogin` is the
   single source for "this connection needs sign-in". It is set on a confirmed 401 or 403 from:
   the **ws-ticket mint**, named explicitly; any REST call; and an unauthorized socket close.
   The screen-level attention flag is derived from it or set alongside it, never instead of it.
   It clears on a successful sign-in. D23's shared "Sign in" action keys off this state, so the
   gateway card, Sessions, Bots, Tasks, New session and the session screen all offer it.
3. **Add connection does not create a duplicate.** Entering a base URL that normalises equal to
   an existing connection's routes to that connection (its sign-in if `needsLogin`, else "use
   this gateway"), and never mints a second id. Opus saw on device that re-adding the same URL
   leaves the old entry orphaned beside a new one. This is in the same fix round and blocks
   0.1.0, because re-adding is what a locked-out person does first.
4. **Expiry is the common case, so the host recipe says so.** Verified at the pinned upstream
   commit `ee84ccd8bd`, `plugins/dashboard_auth/basic/__init__.py`: with no
   `HERMES_DASHBOARD_BASIC_AUTH_SECRET`, `_resolve_secret` returns a fresh random key per
   process, so every restart of a stock gateway expires every session. `docs/CONNECTING.md`'s
   host recipe and the 0.1.0 release notes tell the host to set that secret.
5. **The 12-hour question is answered in the fix round, not assumed.** Access tokens live 12 h
   and refresh tokens 30 d (same file, lines 32–33). The app's only refresh call is OAuth's
   `/auth/native/refresh`; whether the gate middleware renews a password session from the
   refresh cookie is **unverified by anyone**. The TTL is configurable
   (`HERMES_DASHBOARD_BASIC_AUTH_TTL_SECONDS`), so the test is cheap: set it to 120 on the
   throwaway gateway, stay signed in past it with the app in use and again with it
   backgrounded, and record whether the session survives. If it does not, the Sign in path from
   point 2 is what the user meets every 12 hours, and the release notes say so.
6. **Acceptance** is D23's 4(i)–(iii) plus: (iv) the ws-ticket path, shown by New session after
   expiry offering Sign in; (v) re-adding an existing URL creates no second connection;
   (vi) the TTL test in point 5, result stated either way.

**Part 2 — the audience for 0.1.0.**

1. **A GitHub Release on a public repository is a public download.** Marking it pre-release
   limits nothing. D20.4 is not reinterpreted: it is an open beta at least. Opus is right.
2. **The closed test is one named person: Ahmed Bilal**, the user, who confirms there are no
   other testers. The closed-test APK is handed over as a file. It does not go on public
   Releases and the repository stays private until the open-beta check passes.
3. **Physical rows are run, not waived, wherever the user's phone can run them.** The register's
   unblocking condition has always been "device attached". With 0.1.0 installed on the user's
   own Android phone, Opus's batched physical pass (D9) runs: M04 cookies across app kill,
   M06 frame rate on a seeded 2,000-message session, M07 airplane mode, doze and Wi-Fi to
   cellular, M11 dictation with a real microphone, and the backgrounded-approval notification
   after the phone has slept. A row that fails is a defect or a narrowed claim, not a waiver.
4. **What may still be waived for a public audience, and how.** D20.2.2 already allows a waiver
   "by name for a stated audience". For a public audience a waiver needs all three: the row
   could not be run on the hardware available, stated; a release-notes line that narrows the
   claim to what was tested; and it is never a row in the approval, sudo or secret path or one
   that can lose data. Opus's proposed release-notes lines are adopted as that wording for any
   row that ends up waived. Expected candidate: M08 Portal login via Custom Tabs, if the user
   has no Portal-gated gateway to test against.
5. **"Not applicable" is not a waiver.** A row for a feature the release does not ship is
   recorded by name as not applicable to that release. M11's push-delivery row is not applicable
   to 0.1.0: there is no EAS project and no push.
6. **The notification sentence in the release notes is a claim, so it is narrowed, not waived.**
   It becomes: *"…a system notification while the app is still running in the background. If
   your phone has been asleep for a while you may not get one; open the app to check."* If the
   physical pass shows it does arrive after sleep, the sentence can be widened then.

**Reasoning.** Part 1: the fix D23 described would have passed its own acceptance on
`/api/sessions` and left every session screen dead, because the state it keyed off was never
set on the path testers actually hit. Naming the ws-ticket 401 and making one persisted state
the source closes that. Part 2: the gate exists so that what is said about the app matches what
was tested. A public download is public whatever it is labelled, and a phone in the user's hand
turns waivers into tests. Running the rows costs an afternoon; waiving them would have put the
first real-device run in strangers' hands.

**Checked by me:** the `resolveAuth` catch block and what it sets; upstream `_resolve_secret` and
the two TTLs at `ee84ccd8bd`; that the app's only refresh call is OAuth's; that Add connection
has no dedupe by URL. **On Opus's word:** everything seen on the device, including the duplicate
connection. **Unverified by anyone:** password-session renewal (point 5), and whether the user
has an Android phone available now, which Part 2.3 depends on.

## D25 — Blocking cards leave the transcript list and dock above the composer (2026-09-19)

**Decision.** Settles how D20 item 6 (approval card can mount off-screen) is fixed. Sonnet
proposed two options and leaned to (a); (a) is adopted with constraints.

1. **The four blocking cards (secret, sudo, approval, clarify) no longer render as the
   `FlashList`'s `ListHeaderComponent`.** They render in a dock pinned directly above the
   composer, always visible while a request is pending, independent of scroll position. This
   follows the intent of the desktop's `PendingApprovalFallback`
   (`apps/desktop/src/components/assistant-ui/tool/approval.tsx` at `ee84ccd8bd`: absolutely
   positioned above the composer, shown when the inline bar is not mounted). Mobile has no
   per-tool-row inline bar, so the desktop's inline-or-floating pair collapses to the floating
   form alone. That departure is recorded as an M14 Deviation and a `docs/PARITY.md` line.
2. **The dock lives inside the composer's `KeyboardStickyView`**, above the composer row, not
   as a plain sibling between `<Transcript>` and `<Composer>`. The sticky view moves by
   translation when the keyboard opens; a sibling above it would be covered by the composer and
   keyboard, and three of the four cards have text inputs.
3. **Height is capped** at about half the window. The card body scrolls inside the cap; the
   action row stays outside the scroll area so the answer buttons are always visible, at font
   scale 1.3 with the keyboard open on a 360 dp wide screen.
4. **`TodoPanel` stays in the list header**; it is not blocking. With two requests pending the
   existing order holds inside the one dock.
5. **No dead machinery.** The header-layout correction tracker and the `__DEV__` header layout
   ref are removed if nothing else needs them; the `scrollToBottom` effect may stay but is no
   longer load-bearing for visibility.
6. **Re-proven, not assumed:** `FLAG_SECURE` on mount and release on unmount for sudo and
   secret; the D10 restore from `session.resume`'s `pending_approval` / `pending_clarify`; the
   local notification for a non-active session. The dock carries
   `accessibilityLiveRegion="assertive"`.
7. **This entry authorises the structural change.** M14's rule that components with
   device-verified behaviour keep their structure is waived for this move, which is why the
   re-proofs in point 6 are part of acceptance.
8. **Acceptance**, on a release APK of merged `main`, written to D21.1: 10 of 10 approvals fully
   on-screen with no touch in both themes, including a second approval after a Reject in the
   same session; sudo, secret and clarify once each with the keyboard open, input and Send
   visible above it; font scale 1.3; a 60-message history; and a request arriving while the
   reader is scrolled up, with the dock visible and the transcript position unmoved.

**Reasoning.** Opus measured the cause: `maintainVisibleContentPosition` shifts the inverted
list's offset by the inserted header's height and cancels the animated scroll, so 3 of 6
approvals were hidden in its device pass, one until the gateway's 300 s timeout. Option (b),
neutralising that prop while a card is pending and scrolling after layout, keeps a safety-path
control dependent on scroll arithmetic that has now failed three separate ways (M06's missing
scroll effect, the unmeasured-header undershoot, this). A control that must be answered should
not be somewhere the user can scroll away from. **Checked by me:** the session screen's layout
(`app/(main)/sessions/[id].tsx:184-219`), that the composer uses `KeyboardStickyView`
(`Composer.tsx:602`), the list header's contents, and which cards have text inputs. **On
Sonnet's and Opus's word:** the desktop component's behaviour and the instrumented trace.

## D26 — Sudo and secret cards get Cancel before the dock merges; stale approval notifications are dismissed; the foreground-return hang is open (2026-09-19)

**Decision.** Three rulings on Opus's hand-off of 2026-09-19.

1. **Cancel on `SudoCard` and `SecretCard`, matching the desktop. It holds the merge of
   `fix/approval-visible`.** Cancel sends the existing `sudo.respond` / `secret.respond` with an
   empty value. The label is the vendored `t.common.cancel`; the button sits in the card's fixed
   actions footer beside Send. The card unmounts, `FLAG_SECURE` releases, and the turn continues.
   A failing-first test per card. Device check of Cancel needs no typing; submission still waits
   for the user's sitting.
2. **An answered or expired approval's OS notification is dismissed.** The identifier returned
   when scheduling is kept, keyed by request id, and dismissed when the request clears by any
   route: answered here, answered from another client, expired, or the turn ended. In this round
   on its own commit. It blocks neither the merge nor 0.1.0. Reason it may be carried if it
   slips: it is stale information that cannot cause a wrong action; the tap lands on a session
   with nothing pending.
3. **Open, blocking 0.1.0 under D20.2.6: an approval can be unreachable after a return to the
   foreground.** On return the app runs `reconnectAndProbeGateway` (ensure, then `ping`); when
   the ping answers, nothing re-resumes the session, so a pending request is not restored on
   the surviving-socket branch. D10's criterion claimed both reconnect branches; on this
   evidence that branch was never covered. Two further symptoms (no notification while
   backgrounded and not frozen; a blank transcript that loses the user's own message) are
   unexplained. Two hypotheses are recorded for the instrumented run, not as findings: the
   client ignores `session.resume`'s `inflight` and `queued` fields, so a hydrate mid-turn drops
   the current exchange; and an `approval.request` carrying a runtime id the client no longer
   maps, or that is not the active one, is dropped by the `isActiveEvent` gate. No fix is
   written until Opus brings the traces and a recommendation between patching the two symptoms
   and rebuilding the session from `session.resume` on every foreground return. This does not
   block merging the dock fix, which is a separate, verified mechanism.

**Reasoning.** Part 1: the only exit from a credential prompt today is Stop, which kills the
turn; a user who does not want to type a password into a phone must be able to decline without
losing the work. Part 3 is recorded as open rather than decided because deciding now would be
the pattern this log has already paid for three times: a plausible code reading standing in for
a trace.

**Checked by me** at the pinned upstream commit `ee84ccd8bd`:
`tui_gateway/agent_callbacks.py` `secret_cb` returns `skipped: True` on an empty value and never
calls `save_env_value_secure`; the desktop's `prompt-overlays.tsx` has Cancel on both dialogs
(lines 129, 230) and documents an empty sudo response as a failed sudo in which no command runs
(line 87). In this repo: `reconnectAndProbeGateway` at `session-connection.ts:620-655` does
ensure-then-ping and nothing else; nothing outside `src/upstream` reads `inflight` or `queued`;
`isActiveEvent` is `runtimeSessionId === activeRuntimeSessionId`. **On Opus's word:** every
device observation, Sonnet's 13-of-13 branch pass, and that the mobile cards have no Cancel.
**Unverified by anyone:** whether a hydrate ran in the hang repro, and whether the missing
request never reached JS or was dropped by the reducer.

## D27 — Sign out must disconnect: close the socket, gate traffic on `needsLogin`, clear the cookie locally (2026-09-19)

**Decision.** Opus found in review that Sign out leaves the live gateway socket serving RPCs.
Its option (a) is adopted, with two further parts that close a sibling hole. On
`fix/sign-in-recovery`, this round; blocks 0.1.0.

1. **Sign out on the active connection invalidates the gateway client** (the same
   `client.invalidate()` the foreground probe uses) and clears that connection's runtime state:
   the runtime-to-stored map, the active runtime id, pending approval, clarify, sudo and secret
   state (cards unmount, `FLAG_SECURE` releases), connection attention, and cached list data for
   that connection. Pending-request notifications are dismissed (D26.2). Signing out a
   non-active connection touches no socket.
2. **`needsLogin` gates outbound authenticated traffic at the choke points.** `resolveAuth`
   refuses to mint a ticket or dial, and the REST layer refuses, for a connection with
   `needsLogin` set, returning the needs-login result that D23's shared Sign in piece renders.
   Only the login route clears the flag. Per-screen guards may remain but are never the barrier.
3. **The session cookie is cleared locally on Sign out whether or not `POST /auth/logout`
   succeeded.** Per-host if possible. If only a global clear is available without a new native
   module, it is used, and every other password-mode connection is marked `needsLogin` in the
   same action so the state shown is true. A new native cookie module is acceptable only if the
   global clear does not work. If neither works, part 2's gate holds inside the app and the
   limitation is stated in the release notes. "Cookie cleared" is claimed only when a
   `ws-ticket` request after sign-out is shown returning 401.
4. **Acceptance**, on a release APK of merged `main`, to D21.1: (i) sign out online, no
   ESTABLISHED socket on the host, nothing can be sent, every surface offers Sign in, no cached
   list shows; (ii) sign out while the gateway is unreachable, restart it with the **same**
   signing secret, and the app neither reconnects nor loads anything until Sign in; (iii) sign
   out with a turn in flight, the server completes it, and after Sign in resume shows it;
   (iv) sign in again with the connection id and its other fields unchanged.
5. **URL normalisation for D24.1.3's dedupe is made explicit and tested:** scheme and host
   lower-cased, the scheme's default port dropped, trailing slash dropped, path otherwise kept.

**Reasoning.** The app is a remote control for an agent with a shell. Sign out is the one
control a user has over a phone they lend, sell or lose track of, so it has to mean
disconnected, and it has to work offline, which is exactly when a worried user presses it.
Upstream's basic-auth tokens are stateless, so nothing server-side ends the session; the client
is the only place this can be enforced.

**Checked by me** on `origin/fix/sign-in-recovery`: `signOutConnection` is a best-effort
`POST /auth/logout` with errors swallowed, `deleteAllConnectionSecrets`, and `needsLogin: true`,
nothing more; no cookie clearing exists anywhere in `src/` or `app/`; in
`session-connection.ts` `needsLogin` is only set, never read before the ticket mint. **On
Opus's word:** that the open socket keeps answering after Sign out (Sonnet's own comment in
`1185162` says so for `profiles.list`). **Unverified by anyone:** the offline sign-out
reconnect on a device; whether React Native's `Networking.clearCookies` exists and clears
OkHttp's jar on RN 0.86; iOS behaviour.

## D28 — D26's merge hold lifted: one verification sitting on merged `main` (2026-09-19)

**Decision.** At Opus's request, to cut the user's time from two sittings to one. Every
remaining device check needs a signed-in gateway, and only the user types credentials.

1. **The D26.1 hold on merging `fix/approval-visible` is lifted as to the device check.** Cancel
   is verified in the single merged-`main` sitting. The code is not waived: Cancel and its
   failing-first tests are on the branch when it merges.
2. **Everything the sitting must verify is on `main` before the user sits down:** the dock with
   Cancel (D25, D26), D27's three parts, D24's dedupe and ws-ticket `needsLogin`, notification
   dismissal, the version change (D23), and the build script's ABI guard. The sitting is not
   scheduled against a `main` known to be incomplete.
3. **The diagnostic build for the foreground-return hang (D26.3) is cut from that same merged
   `main`** and stays unmerged.
4. **Until the sitting passes, `main` is unverified and says so:** the top of
   `docs/D20-READINESS-0.1.0.md` names the first unverified commit. No tag, no real-key APK,
   nothing leaves the machine. D20 is unchanged.
5. **The sitting is ordered to minimise typing:** signed-in checks first (D25.8, Cancel and Send
   on sudo and secret, the instrumented hang runs), then the sign-out family (D27, D24's expiry
   and TTL test, D23), then one final sign-in for D27's acceptance (iv). The throwaway gateway
   runs with a fixed signing secret and a long session TTL outside the TTL test, so one sign-in
   survives restarts and later verification of the hang fix needs no further sitting unless a
   test signs out.
6. **Not decided here:** restoring an emulator snapshot taken after the user's sign-in, to re-run
   sign-out tests unattended. The no-typing rule is the user's; the question is put to them.

**Reasoning.** D13.2 already makes evidence on merged `main` the standard, so verifying on a
branch and again after merge was the weaker check done twice, at the cost of the one person
whose time cannot be parallelised. `main` is not a release; D20 gates what leaves the machine,
and that gate does not move. The conditions exist because "one sitting" is only true if nothing
known to be missing forces a second. **On Opus's word:** that the dock is code-reviewed,
unit-tested, and passed D25.8 on the branch apart from the dark-theme count. I did not re-review
the branch for this entry.

## D29 — The verification sitting: snapshot approved, the emulator wiped of a real gateway first, the TTL test corrected (2026-09-19)

**Decision.** Settles D28.6 and amends D24.1.5.

1. **Snapshot approved by the user**, given directly to Opus through Opus's own prompt on
   2026-09-19, not relayed through an agent. After the user's sign-in on the emulator, a
   snapshot may be taken and restored between sign-out tests so they re-run without anyone
   typing. Conditions:
   - A restore puts back the whole device, including the installed APK. After every restore the
     build under test is reinstalled with `adb install -r` and the running build is confirmed
     (versionCode, `topResumedActivity`). The snapshot's APK and every later test build are
     signed with the same throwaway key, or the reinstall fails and the sign-in is lost. The
     real-key APK is never part of this.
   - The snapshot is a credential artefact. Throwaway gateway only; it stays in the AVD's own
     directory, is never copied to the field kit or the repo, and is deleted at the end of the
     round, stated in the teardown.
   - The emulator clock is checked after each restore. The gateway's fixed secret and long TTL
     are in place **before** a restore.
   - If the restored emulator does not come up signed in, the round stops. Nobody types the
     password to continue.
2. **The emulator is wiped of saved gateways before the sitting.** Applying the condition above,
   Opus found the old dev client (`com.nousresearch.hermes.mobile`) still held the user's real
   gateway, signed in. The user approved clearing that app's data; the Gateways screen is
   confirmed empty before the user signs in. **Standing rule:** the first step of every device
   round is to list saved gateways; if any is not a throwaway started in that round, stop and
   ask the user.
3. **D24.1.5's TTL test is corrected.** The basic-auth plugin stamps `exp` into each token when
   it is issued, so restarting the gateway with `TTL=120` does not shorten a token issued under
   a long TTL, and the test as I worded it would have reported a false "survives". The test
   signs in **after** the restart at 120 s; that sign-in also serves D27's acceptance (iv). The
   user's part is two sign-ins and two dummy sudo/secret values, about three minutes.
4. **Recommended to the user, their decision:** rotate the real gateway's
   `HERMES_DASHBOARD_BASIC_AUTH_SECRET`, since upstream's tokens cannot be revoked and a
   signed-in session to that gateway sat on an agent-driven test emulator for days. The real
   hostname and gateway label join the D22.5 history-audit patterns before the repository goes
   public.

**Reasoning.** The snapshot removes the last reason to spend the user's time on re-runs, and the
conditions keep it from quietly becoming a stored credential or a way to test the wrong build.
The real-gateway finding is what safeguards are for: nobody set out to put a live credential in
reach of test automation, and nothing in the process would have noticed. **Checked by me:** the
`exp`-at-issue behaviour, read in `plugins/dashboard_auth/basic/__init__.py` at `ee84ccd8bd`
while writing D24. **On Opus's word:** the user's approvals (given to Opus directly), and that
the dev client held the real gateway. **Unverified by anyone:** whether any field-kit artefact
captured that session; Opus is asked to search and report.

## D30 — After the sitting: the client reconciles from `session.resume`; one clear path for pending requests; D27's evidence scope (2026-09-20)

**Decision.** The D28 sitting ran on 2026-09-20. D27, D23 and D24's ws-ticket path passed on the
dev client. Three approval-path defects are open. Rulings:

1. **The client reconciles its picture of the active session from `session.resume` on every
   foreground return, every (re)connect, and when a session is opened.** This settles D26.3's
   open question; the direction is chosen now, and the hang traces confirm the fit rather than
   choose between options. Absence is information.
   1. `pending_approval` / `pending_clarify`: present sets the card; **absent clears it**.
   2. `running === false` clears all four pending kinds and any running-tool spinner. No
      blocking request outlives its turn; the same invariant applies on the live path when a
      turn ends.
   3. Sudo and secret have no resume field. If the socket was **re-dialed** since the request
      arrived they are cleared (D10); if the **same socket survived** they are kept, because the
      event stream was never interrupted and `sudo.expire` / `secret.expire` will arrive. This
      protects leaving the app to copy a password and returning seconds later.
   4. A full hydrate merges the payload's `inflight` and `queued`, so a mid-turn hydrate never
      blanks the current exchange or drops the user's own message.
   5. The runtime id is rebound from the resume response before further events are processed. An
      input-request event for the active stored session with an unknown runtime id triggers a
      reconcile instead of a silent drop.
   6. Two weights: on a surviving socket, a light reconcile that does not touch messages (using
      the resume builder's omit-messages path, **to be confirmed** at the pinned commit); after
      a re-dial, a full resume and hydrate. One reconcile in flight per session.
   7. Answering a dead request is never silent: whatever the server returns for an expired or
      unknown request id, the client shows that the request expired and clears it.
2. **One clear path for pending requests.** A single function clears a request's state and its
   notification; the effect path and the four responders both call it. The notification's own
   identifier is the request id, so a re-post replaces instead of duplicating and dismissal
   works after a reload or cold start; the in-memory id map is deleted. The JS root reload seen
   about a second after a notification while backgrounded is characterised on a release build
   before this closes; if release builds reload too, that is a separate defect for this log.
3. **Evidence scope.** D27 (i)–(iii), D23 and D24's ws-ticket path are accepted as closed for
   JS behaviour on merged `main`. They ran on the dev client, which still carries the old
   package id and older native code, and D27's acceptance named a release APK. The parts that
   depend on native code, the cookie clear and the socket teardown, are re-run on the release
   APK using the gateway-log and `netstat` proofs (a release build is not debuggable, so no
   cookie database read). That needs one sign-in by the user on the release app, combined with
   the D24 confirmation already owed.
4. **The user's snapshot** may be kept until the fix round for these defects is verified, if the
   user agrees, under D29's conditions unchanged, and is then deleted.
5. **Status.** Three open defects in the approval path; D20.2.6 blocks 0.1.0 until each has a
   root cause and a verified fix. Acceptance for part 1, on a release APK of merged `main`: the
   300 s timeout repro returns to no card, no spinner and no notification; the same when a
   second client answers Run and Reject; the original hang repro; a mid-turn background with no
   request returns to an intact transcript; a sudo card survives a ten-second trip to another
   app on a surviving socket.

**Reasoning.** D26.3 waited for traces before choosing between patching symptoms and rebuilding
from resume. The sitting supplied something better than a trace: a second, independent defect of
the same shape, verified against the server three ways. A card that outlives its request and a
request that never gets its card are one missing behaviour, the client trusting its own memory
across a gap it cannot see into. This is the fourth time that shape has appeared (D10's pending
approval, the hang, the stale card, the unread `inflight`), so the fix is the rule, not another
field. The sudo and secret exception exists because a blanket "clear on return" would break the
one moment a phone user most needs those cards to persist.

**Checked by me** on `main`: the four responders clear directly at
`session-connection.ts:1120/1140/1150/1159`; every `dismissNativeNotification` call is inside
`dispatchEffects` or sign-out; notification ids are held in an in-memory map
(`native-notifications.ts:181`). **On Opus's word:** everything seen on the device and in
`agent.log`, including the 300.02 s timeout, the live card three minutes later, the duplicate
notification, and the D27 proofs. **Unverified by anyone:** staleness when another client
answers; why the JS root reloads in the background; the omit-messages parameter and what it
returns; what the server replies to an answer for a dead request.

## D31 — D30 amended: two resume payloads, two dead-request shapes, and release-build evidence for the background path (2026-09-20)

**Decision.** After Opus checked the hang traces against D30 and Sonnet read D30's two
unverified points at the pinned upstream commit `ee84ccd8bd`. D30's design stands; four
amendments.

1. **The light reconcile uses `session.resume` with `omit_messages: true`.** On the live path it
   empties `messages` and sets `messages_omitted`, while `running`, `status`, `inflight`,
   `queued`, `pending_approval` and `pending_clarify` are still returned.
2. **Dead-request detection has two shapes, and neither is an RPC error.** `approval.respond`
   returns `resolved: 0` for an unknown or expired request; `clarify.respond`, `sudo.respond`
   and `secret.respond` return `status: "expired"`. One small function per kind, tested against
   fixtures with the success shapes pinned beside them. The user sees "This request expired" and
   the request clears through D30.2's one clear path.
3. **A cold resume is a different payload, and absence on it is true information.** When the
   session is not live in-process, upstream's `_resume_response` sets `inflight` to null,
   `running` to false, carries no pending fields, and includes a `resumed` key that the live
   payload lacks. The client detects it positively by `resumed`. On a cold payload all four
   pending kinds and any spinner clear. **This amends D30.1.3:** sudo and secret clear on a cold
   payload even when the same socket survived, because the server-side session that was waiting
   is gone; "keep on a surviving socket" applies only to a live resume. `inflight: null` is
   tolerated by the merge. The cold path mints a new runtime id, so D30.1.5's rebind is
   load-bearing. Before relying on hydrate, Sonnet reports whether this client can ever receive
   the builder's `hydrating: true` and what follows it.
4. **The two payload shapes are pinned by fixtures.** One live and one cold `session.resume`
   response are recorded from the throwaway gateway, and a test asserts the keys the reconcile
   relies on, so an upstream re-pin that moves either shape fails loudly.
5. **Background-path evidence comes from a release-variant build.** The original hang did not
   reproduce in any dev-client run and was first seen on a release APK. The dev client holds
   `KEEP_SCREEN_ON`, keeps a Metro connection and can reload its JS root, so Android may cache,
   freeze or kill it differently. An instrumented release-variant APK (the diag branch on merged
   `main`, throwaway key, never tagged or distributed, deleted at teardown) reproduces the
   original case with the app's log **and** an outside view: `logcat` freezer and kill lines for
   the package, process state at intervals after HOME, and the host's socket table. The result
   decides whether anything is needed beyond D30; it does not block starting D30.

**Reasoning.** D30 made absence meaningful, so what absence means had to be read at source
rather than assumed, and it turned out to mean two different things on two paths. Pinning the
shapes is the price of depending on them. The release-build rule follows from the one negative
result in the traces: a defect seen only in the shipped variant cannot be cleared by evidence
from a variant that behaves differently exactly where the defect lives.

**Checked by me** at `ee84ccd8bd`: `_resume_response` (`tui_gateway/methods_session.py:654-671`)
and its fields, and that `_live_session_payload` is the live path's builder. **On Opus's and
Sonnet's word:** the trace readings, the `omit_messages` parameter and what the live path returns
with it, and both dead-request return shapes with their line references. **Unverified by
anyone:** the hypothesis that the release process is frozen or killed in the background; the
meaning of `hydrating`; the sudo card across a short trip to another app.
