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
