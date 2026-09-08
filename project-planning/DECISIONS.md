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
