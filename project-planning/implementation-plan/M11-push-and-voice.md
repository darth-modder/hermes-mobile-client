# M11 — Push plugin + voice

**Status:** in-progress
**Depends on:** M07
**Goal:** Backgrounded approvals and finished turns arrive as push notifications; voice input and output work.

## Push design (no upstream change)

Hermes loads plugins from `~/.hermes/plugins/<name>/`. A plugin can observe
`pre_approval_request` and `on_stream_end` (upstream `hermes_cli/plugins.py`, `VALID_HOOKS`)
and can mount REST routes at `/api/plugins/<name>/` via `dashboard/manifest.json` with an `api`
file (upstream `hermes_cli/web_server_dashboard.py`). Those routes sit behind the normal auth gate.

**Correction (2026-09-09, see Deviations below): `pre_approval_request` does not fire for
gateway/mobile sessions.** The paragraph above is kept as originally written; the actual
mechanism the plugin uses for the gateway path is a poll on
`tools.approval.has_blocking_approval`, documented in full in `watcher.py`'s module docstring.

## Tasks

*Note from D10 (2026-09-08): the client no longer closes its socket on backgrounding, and a frozen app
holds an open socket. Push gating must use the presence endpoint below, never socket state.*

- [x] `server-plugin/hermes-push/plugin.yaml` and `__init__.py`: `register_hook("pre_approval_request", ...)`, `register_hook("on_stream_end", ...)`; publisher POSTs to `https://exp.host/--/api/v2/push/send` with `{ kind, session_id, title }` only, never message content — plus a poll watcher for the gateway approval path `pre_approval_request` doesn't reach (Deviations #1)
- [x] `server-plugin/hermes-push/dashboard/manifest.json` and `dashboard/api.py` router: `POST /devices { token, platform, label }`, `DELETE /devices/{id}`, `POST /devices/{id}/presence { foreground }`; registry at `~/.hermes/hermes-push/devices.json`; push only to devices whose last presence is background
- [x] Install doc: copy the folder to `~/.hermes/plugins/hermes-push/`, restart `hermes serve`, verify `GET /api/plugins/hermes-push/devices` — `server-plugin/hermes-push/README.md`; the round's own install was via a throwaway server (D11), removed afterward
- [x] `src/push/register.ts`: Expo push token registered on login and on rotation (needs an EAS project id); `handlers.ts`: tap opens `hermes-android://session/<id>`; presence sent on AppState changes; settings toggle; graceful degradation when the route 404s (plugin absent)
- [x] `src/voice/recorder.ts`: `expo-audio` records m4a; `POST /api/audio/transcribe { data_url, mime_type }` (upstream `hermes_cli/web_routers/audio.py`); result inserted into the composer
- [x] `src/voice/tts.ts`: `POST /api/audio/speak { text }` returns a data URL; write to a temp file and play — **not reached:** `GET /api/audio/voice-config` for client-direct providers and PCM streaming from `/api/audio/speak-stream` (the task line's own stretch item); the relay path above is what closes both voice exit criteria

## Deliverables

- `server-plugin/hermes-push/**`, `src/push/**`, `src/voice/**`, `app/(main)/settings/{notifications,voice}.tsx`

## Exit criteria

- `[physical]` Screen off 30 minutes; an approval arrives as a push; tapping opens the card and responding succeeds (decision D1: doze and FCM delivery are not faithfully emulated).
- No push is sent while the app is foregrounded.
- Dictation inserts transcribed text into the composer.
- A reply is spoken via TTS.

## Deviations from the literal spec (and why)

1. **`pre_approval_request` never fires for a gateway/mobile session — the plugin's actual
   approval-push mechanism is a poll, not the hook the design section names.** Traced in
   `tools/approval.py`'s `request_approval` (~lines 700-761): the gateway branch
   (`is_gateway or is_ask`) resolves through `_await_gateway_decision` (a live `notify_cb`,
   which `tui_gateway/server.py:905` wires straight to `_emit_approval_request` — a plain WS
   event write, no hook dispatch anywhere in that path) or `_pending_result` (no live
   `notify_cb`), and returns in both cases before reaching the CLI-only
   `approval_context._fire_approval_hook("pre_approval_request", **hook_kwargs)` further down
   (`surface="cli"`, reachable only by the CLI-interactive fallthrough). Every session this
   plugin exists for is `source: "android"`, i.e. gateway — so the hook this milestone's own
   "Push design" section names is a no-op for the actual target. hermes-agent is read-only
   (AGENTS.md); there is no upstream edit on the table to add a gateway-side call site.
   `watcher.py`'s `ApprovalWatcher` instead polls `tools.approval.has_blocking_approval`
   (the same accessor `tui_gateway/server.py` itself uses to answer `session.resume`'s
   `pending_approval` field) every 2s for sessions this process has seen start
   (`on_session_start`/`on_session_end`, which do fire for every surface —
   `agent/conversation_loop.py:733`), and pushes once on the false→true transition. It never
   reads the approval's command/description, only whether one exists, so there's no path for
   approval content to leak into a push body even by accident. `pre_approval_request` is still
   registered (harmless, correct for CLI-interactive use) so a future CLI-driven install gets
   the same behavior for free. Verified live against the real `tools.approval` module from the
   hermes-agent install (see Verification log) — not just against a fake. This is a mechanism
   correction under the existing "no upstream change" design constraint, not a change to any
   exit criterion's wording, so it's recorded here rather than as a fresh D-entry; worth a
   Fable read if the "Push design" section itself should be reworded to match.
2. **`on_stream_end` fires once per model API call, not once per turn — finished-turn pushes
   are debounced, not sent straight from the hook.** `_with_stream_emitters`
   (`agent/chat_completion_helpers.py`) brackets one `agent._interruptible_api_call`, and a
   turn that makes several tool calls re-enters that bracket once per call. Sending a push per
   call would spam a multi-step turn. `StreamEndDebouncer` (`watcher.py`) restarts a 6s timer
   per session on every call and only pushes once the calls go quiet — a reasonable proxy for
   "the turn is actually done" given no upstream hook marks a turn's true end. This is a
   task-list implementation detail, not one of the four exit criteria above.
3. **A pre-existing, unrelated dependency conflict blocked installing `expo-audio` at all —
   fixed by pinning `react-dom`, not by bumping `react`.** `npm ci` against the lockfile
   committed *before* this round's changes already failed (confirmed via `git stash`):
   `expo-router@57.0.19` depends on `@expo/ui`/`vaul`, which pull in `react-dom@19.2.8` as a
   real dependency, peer-conflicting with this project's pinned `react@19.2.3`. `react-dom`
   itself is dead weight in this RN app (only reachable through expo-router's unused
   web-target code), so pinning `"react-dom": "19.2.3"` (matching `react`, and satisfying
   `react-dom@19.2.3`'s own `peer react@^19.2.3`) resolves the graph without changing the
   app's actual React runtime version. `npm ci` now reproduces the tree with no
   `--legacy-peer-deps` (verified: `react-native-nitro-modules@0.37.1` and `react-refresh` —
   both flagged as previously, silently dropped by that flag — are present after a clean
   `npm ci`).

## Verification log

### 2026-09-09 — Sonnet: server plugin, live against a throwaway server

D11 landed first (dev-machine change rules; EAS id and plugin install settled — see
`DECISIONS.md`). `config.yaml` backed up with sha256
(`554aa846c8b3e7353835e05919129454b63377cfa968f696c914147f10031d91`, matching the hash already
on file from the last M07 round — confirms nothing else touched it since) before
`hermes plugins enable hermes-push`. Copied `server-plugin/hermes-push/` to
`~/.hermes/plugins/hermes-push/` (that directory existed but was empty — not quite "no
`plugins/` directory at all" as the brief assumed, a trivial difference). Throwaway
`hermes serve --host 127.0.0.1 --port 9119` with a scratch `HERMES_DASHBOARD_SESSION_TOKEN`,
never the user's own instance (D11 rule 4's whole reason: `pre_approval_request` runs inside
every approval on whichever server loads it).

`logs/agent.log` showed `Mounted plugin API routes: /api/plugins/hermes-push/` with no errors.
Drove the real HTTP API with `curl` + the scratch token: `POST /devices` (register, returns a
stable `id` derived from the token — idempotent), `GET /devices` (token redacted from every
response), `POST /devices/{id}/presence {foreground:false}` then `GET /devices` again (presence
flips), `DELETE /devices/{id}` (200, then a second delete on the same id → 404), and confirmed a
freshly-registered device defaults to `presence: "foreground"` and is excluded from
`backgrounded_tokens()` until it explicitly reports background — the "no push while
foregrounded" exit criterion, proved at the registry level exactly as the brief asked (not by
waiting for a notification not to arrive).

The approval and turn-finished mechanisms were verified against the **real**
`tools.approval` module from the hermes-agent venv (`hermes-agent/venv/Scripts/python.exe`),
not a reimplementation: a scratch script populated `tools.approval._gateway_queues` the same
way `_await_gateway_decision` does (`_ApprovalEntry` from `tools/approval_gateway_wait.py`) and
confirmed `ApprovalWatcher` pushes exactly once on the false→true transition, not again while
still pending, and again for a second later approval after the first resolved — with the
approval's command text never appearing in the push payload. A second script drove
`StreamEndDebouncer` through a simulated 5-tool-call burst (0.3s apart, well inside the debounce
window) and confirmed exactly one `turnDone` push after the burst went quiet, and a separate
errored call produces `turnError` with no error text in the title.

Cleanup: scratch device rows deleted via the API, throwaway server killed (confirmed
unreachable — `curl` exit 7), `~/.hermes/plugins/hermes-push/` and `~/.hermes/hermes-push/`
(the device registry) removed, `config.yaml` restored and reconfirmed byte-identical
(`554aa846...`), scratch session token file deleted.

### 2026-09-09 — Sonnet: client push/voice wiring, `npm run check` and Metro bundle

`npm run check` green at every step (228 tests, up from 210 before this round).
`npx expo export --platform android` bundles clean before and after each commit (2287 → 2302
modules across the push and voice commits) — the standing lesson that only a real Metro bundle
catches what `npm run check` alone misses.

Found and fixed one non-obvious test-authoring gap along the way: `src/voice/api.test.ts`
initially failed to even import (`SyntaxError: Unexpected token 'typeof'`, no useful stack).
Bisected by stripping `src/voice/api.ts` down to nothing and adding imports back one at a time:
the failure traces to `connections/registry.ts` (`react-native-mmkv`) and `connections/secure.ts`
(`expo-secure-store`) — real native modules that crash under plain vitest unless mocked, exactly
as `src/api/sessions.test.ts` and `src/connections/registry.test.ts` already do. My test hadn't
mocked them; fixed to match that existing convention.

### 2026-09-09 — Sonnet: self-review pass, four fixes

Sent the diff to a general-purpose review agent with no other context than the code itself and
the project's own invariants. It found two real bugs, confirmed by tracing the actual control
flow (not just plausible-sounding): (1) `usePushRegistration.ts`'s token-rotation listener was
attached once at mount gated on the enabled flag *at that instant*, never torn down or
re-attached as the toggle changed later, so disabling push left a stale listener that would
silently re-register the device on the next rotation — a real contradiction of `settings.ts`'s
own "off unregisters" contract; (2) `Composer.tsx` could insert dictated text into the *wrong*
session's draft, because `stopRecordingAndTranscribe()` clears the recorder before the network
await starts, so a session switch mid-transcription isn't caught by the existing
`isRecording()` guard. Also fixed two lower-severity findings: TTS temp files
(`hermes-tts-*`) were never deleted (unbounded cache growth over a long session), and
`watcher.py`'s `_pending_state` dict was written by the poll loop without the lock
`untrack_session` uses (a session ending mid-iteration could have its entry resurrected). Fixed
all four; re-ran the watcher's scratch verification against the real `tools.approval` module
(same harness as the initial verification) to confirm the locking fix didn't change its
behavior — still edge-triggered, still no duplicates, still re-arms. `npm run check` green
(228 tests unchanged — these were behavioral fixes, not new test coverage) and a Metro bundle
export clean, both before and after.

The review agent also checked and found no issue with: push-body content minimization (traced
end-to-end that `send_push` never accepts a content field and no call site reads
approval/message text into the push path), `registry.py`'s atomic-write crash safety, the
dashboard router actually sitting behind the app-wide auth middleware chain (not just the
docstring's claim), and the `restAuth`/native-import-laziness conventions in the new
`src/push/api.ts` and `src/voice/api.ts` matching `src/api/sessions.ts` and
`native-notifications.ts` respectively.

### Not reached this round: live on-device verification

`expo-audio` adds new native code, so the previously-installed dev-client APK (from M07's
rounds) can't exercise it — a real Gradle rebuild is needed first. Started one (WSL2,
`./gradlew assembleDebug --no-daemon`, ~20-32 min per `docs/CONNECTING.md`) with
`emulator-5554` booted and `adb reverse` in place for both the backend and Metro ports, but
stopped it partway through on explicit instruction before this round closed. Everything below
is therefore verified at the level `npm run check` + a Metro bundle export + the scripted
Python verification against the real `tools.approval` module can reach, **not** by actually
running the app: dictation inserting into the composer, TTS audio actually playing, the
notifications/voice settings screens rendering, and the tap-to-open deep link resolving on a
live app are all unverified live. The next round should finish that build (or start a fresh
one — nothing about the native module changed since) before treating any of the three
emulator-provable exit criteria as closed. `android/local.properties` was written (WSL SDK
path) and `npm run prebuild` was run to regenerate `android/` with `expo-audio`'s native code —
both reproducible from a clean checkout, nothing to undo.
