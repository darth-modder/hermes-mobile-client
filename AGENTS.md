# Hermes Android — working rules

Expo / React Native thin client for [Hermes Agent](https://github.com/NousResearch/hermes-agent).
Plan and progress live in `project-planning/implementation-plan/`.

## The one invariant

**The phone dials; it never hosts.** No agent logic, no backend spawn, no `HERMES_*` env
plumbing on the device. Every session created here sends `source: "android"` (later `"ios"`)
through `session.create`; the backend answers from the session alone. Never gate a capability
on anything only a locally-spawned backend would have.

## hermes-agent is read-only

The upstream repo (`HERMES_AGENT_ROOT`, default `../hermes-agent`) is a **source of borrowed
code only**. Never edit it from this project. Anything the app needs from the server must
either already exist upstream or ship from this repo as a user-installed plugin
(`server-plugin/`).

Other sessions may legitimately be working in that checkout. Vendoring therefore reads from git
objects (`git show HEAD:<path>`), never the working tree, and the verification gate is: upstream
`HEAD` equals `src/upstream/UPSTREAM.json.commit`, and `git -C ../hermes-agent status --short`
lists nothing under an allow-listed path (decision D5). Working-tree noise elsewhere is out of
scope.

Rule changes live in `project-planning/DECISIONS.md`. An exit criterion is never rewritten in
place to match a result; a reword needs a D-entry and keeps the original wording visible.

## Vendored code (`src/upstream/`)

`scripts/sync-upstream.mjs` owns every file under `src/upstream/`. Never hand-edit them; add a
programmatic patch to the sync script instead, and re-run it. `src/upstream/UPSTREAM.json`
records the upstream commit. The sync must be idempotent (second run = no diff).

Vendored and gateway code must not touch browser globals (`window`, `document`,
`localStorage`, `navigator`) — enforced by ESLint `no-restricted-globals`.

## Credentials and reauth

- One-time credentials are never reused: OAuth WS tickets are minted per dial.
- Reauth only on a **confirmed** 401/403 (HTTP or WS close 4401/4403). Timeouts, 5xx and
  connection refusals back off and retry; they never trigger a login prompt.
- A rotated refresh token is persisted **before** the refresh promise resolves.
- Secrets (session tokens, OAuth tokens, proxy header values) live in `expo-secure-store`.
  Connection metadata lives in MMKV. Nothing secret is ever logged, including URLs with
  `?token=`.

## State

Small nanostores atoms over component state. Backend is authoritative for anything another
surface can change; the app's copy is a cache. Session state is keyed by the **stored** session
id with a runtime-sid map, because runtime ids die on backend restart or orphan reap.

## Machine features don't exist here

Terminal pane, embedded browser/preview, HUD, pet overlay, quick entry, backend
spawn/bootstrap/update, local fs/git, SSH connection kind, local models, and the
`voice.*`/`wake.*` RPCs (those drive the *server's* mic and speaker). Mobile voice goes through
`/api/audio/*` with on-device capture.

## Verification

`npm run check` (typecheck + vitest + `server-plugin/hermes-push`'s Python tests + eslint) must
be green at every milestone. The Python half runs on stdlib `unittest`
(`python -m unittest discover`, wired in as `npm run test:plugin`) — no pytest, no new
dependency; see M11's Deviations for why. On-device exit criteria are listed per milestone and
get ticked in the milestone file when observed.

**Never run `hermes serve --stop` to tear down a throwaway server.** It is not scoped by
`--port` — confirmed at the source (`hermes_cli/dashboard_procs.py`'s
`_kill_stale_dashboard_processes`, and the flag's own help text: "Stop all running Hermes web
server processes"). It stops *every* Hermes dashboard/serve process on the machine, including
another milestone's throwaway server or the user's own running instance. Kill your own throwaway
server by its own PID instead (recorded when you launch it).
