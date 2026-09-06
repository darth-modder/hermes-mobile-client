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

`npm run check` (typecheck + vitest + eslint) must be green at every milestone. On-device exit
criteria are listed per milestone and get ticked in the milestone file when observed.
