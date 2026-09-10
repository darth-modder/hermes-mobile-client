# M11 — Push plugin + voice

**Status:** in-progress (Opus re-verification 2026-09-10: the speak-control finding is fixed and the spoken-reply criterion is verified; open on exactly two register-bound items — push delivery and non-empty dictation)
**Depends on:** M07
**Goal:** Backgrounded approvals and finished turns arrive as push notifications; voice input and output work.

## Push design (no upstream change)

Hermes loads plugins from `~/.hermes/plugins/<name>/`. A plugin can observe
`pre_approval_request` and `on_stream_end` (upstream `hermes_cli/plugins.py`, `VALID_HOOKS`)
and can mount REST routes at `/api/plugins/<name>/` via `dashboard/manifest.json` with an `api`
file (upstream `hermes_cli/web_server_dashboard.py`). Those routes sit behind the normal auth gate.

*Correction (D13, 2026-09-10): `pre_approval_request` fires only in the CLI-interactive path of
`tools/approval.py`; the gateway branch returns before it. It never fires for a mobile session. The
plugin's poll-based watcher is the design that works; the paragraph above is kept as written for the
record.*

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
- [x] `src/voice/recorder.ts`: `expo-audio` records m4a; `POST /api/audio/transcribe { data_url, mime_type }` (upstream `hermes_cli/web_routers/audio.py`); result inserted into the composer — live on `emulator-5554`: permission grant, record start/stop, upload and the empty-transcript-means-no-insert guard all confirmed (see the 2026-09-09 device-verification log entry for the real `AudioRecorder` construction bug this pass caught and fixed)
- [x] `src/voice/tts.ts`: `POST /api/audio/speak { text }` returns a data URL; write to a temp file and play — live on `emulator-5554`: a real reply played to completion through the emulator's audio stack. **not reached:** `GET /api/audio/voice-config` for client-direct providers and PCM streaming from `/api/audio/speak-stream` (the task line's own stretch item); the relay path above is what closes both voice exit criteria

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
4. **Python test toolchain: stdlib `unittest`, not `pytest`.** This repo had no Python test
   infrastructure at all before this round, and `npm run check` (typecheck + vitest + eslint)
   is a TypeScript-only pipeline; `server-plugin/hermes-push` needed its own. Python 3.12.10 is
   on PATH; `pytest` is not installed. Two real options: stdlib `unittest` via
   `python -m unittest discover` (zero new dependencies, composes into `npm run check` as one
   more `&&`, and "green check" keeps meaning one command), or `pytest` (nicer ergonomics —
   fixtures, parametrization, better failure output — at the cost of a dev-machine install
   every future developer needs too, permitted under D11 rule 1 but not free). Chose `unittest`:
   nothing here needs `pytest`'s ergonomics badly enough to justify the extra dependency, and
   the "no new dependency at all" property is worth more than nicer assert output for a Python
   surface this small (four test files, 52 tests). Wired in as `npm run test:plugin`, folded
   into `npm run check`; `AGENTS.md`'s Verification line updated to say so. One real cost:
   `dashboard/api.py` imports `fastapi`/`pydantic` at module level (its request models) and
   neither is installed in this plain-Python environment, so its actual FastAPI route handlers
   stay untested directly — the input-validation and token-redaction logic they wrap is what
   got extracted into `device_requests.py` and tested there (see the plugin-tests commit); the
   thin route plumbing around it was verified live in last round's throwaway-server pass
   instead, the same tradeoff this project already makes for `useNotifications.ts` and
   `attachments.ts`.
5. **`recorder.ts` was constructing `AudioRecorder` from the wrong place — a real bug the
   native-rebuild pass caught on the first tap, not a hypothetical.** `expo-audio`'s
   `index.d.ts` re-exports `AudioModule.types` with `export type *`, so `AudioRecorder`
   typechecks at the top level (`Audio.AudioRecorder`) but does not exist there at runtime —
   the actual constructible class is `AudioModule.AudioRecorder`, reachable only through the
   native module's own default export. `npm run check` could not have caught this: nothing in
   this repo mocks `expo-audio` deeply enough to distinguish a real export from a
   type-only one, and TypeScript itself was satisfied (the type declaration lies about
   what exists at runtime). Fixed alongside a second gap in the same construction call:
   `RecordingPresets.HIGH_QUALITY` nests Android/iOS overrides under `.android`/`.ios` that
   `expo-audio`'s own `useAudioRecorder` hook flattens via an unexported `createRecordingOptions`
   helper before constructing — bypassed here (this module is deliberately hook-free), so a
   local equivalent (`platformRecordingOptions`) was written instead of reaching into the
   package's unexported internals. See the 2026-09-09 device-verification log entry for the
   full live trace (permission → record → upload → empty-transcript guard, all confirmed after
   the fix). This is exactly the standing lesson repeated at the top of this round's brief:
   only a real Metro bundle and a real device catch this class of bug — `npm run check` and
   `expo export` both stayed green throughout.

## Flagged for Fable: D11.4's risk paragraph is inverted

Not edited here — `DECISIONS.md` is Fable's file. D11.4 says: *"the plugin's
`pre_approval_request` hook runs inside every approval on whichever server loads it, so a bug
there blocks approvals for that instance."* That justified this round's throwaway-server
discipline for testing the plugin. It is now known false: `pre_approval_request` is not in the
gateway approval path at all (Deviation #1 above, and Opus's 2026-09-09 verification note
independently confirmed the same trace) — a bug in this plugin's approval handling cannot block
approvals for anything, because approvals never pass through it. The throwaway-server
discipline itself was still the right call (D11 rule 1's general "never test against the user's
running instance" applies regardless of this specific risk), so nothing about *practice* needs
to change — only the stated *reason* in D11.4 is wrong and should be corrected so the next
reader isn't given a false justification.

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

### 2026-09-09 — Opus verification

**Verdict: the reported work holds up, including the two claims that mattered most. M11 stays
`in-progress`, correctly — no on-device pass happened and three of four exit criteria are unproven.
Two coverage gaps below.**

`npm run check` — 31 files, **228 tests**, Prettier clean. `npx expo export --platform android` —
exit 0, a 5.9 MB `.hbc` bundle. That second one matters: it is the check `npm run check` cannot do,
and it is what caught the missing `babel-preset-expo` back in M01.

#### The `pre_approval_request` finding is correct, and it is a good one

This is the claim worth checking hardest, because it contradicts both M11's own Push design section
and D11.4's stated risk ("the plugin's `pre_approval_request` hook runs inside every approval on
whichever server loads it"). Traced independently to `tools/approval.py:758`:

```python
# CLI interactive: single combined prompt, wrapped in the pre/post plugin hooks.
…
hook_kwargs = dict(…, session_key=session_key, surface="cli")
approval_context._fire_approval_hook("pre_approval_request", **hook_kwargs)
```

The dispatch sits inside the **CLI-interactive** branch with `surface="cli"` hardcoded, and the
gateway path returns earlier through `grant()` / `deny()` without ever reaching it. So the hook
genuinely never fires for a gateway or mobile session. The milestone's design section was written
against a hook that cannot serve it, and building the poll-based watcher instead was the right call.

Two consequences to record rather than leave implicit: **M11's Push design section is now wrong** and
should say so where it names the hook, and **D11.4's risk paragraph is inverted** — a bug in this
plugin's approval path cannot block approvals for that instance, because it is not in the approval
path at all. Neither needs a new decision; both need the text corrected so the next reader is not
misled the same way.

#### `npm ci` really was broken before this round — and that corrects me

Verified by running it against the pre-M11 tree in isolation:

```
$ (package.json + package-lock.json from 6615e9d)  npm ci --dry-run
npm error   vaul@"^1.1.2" from expo-router@57.0.19
npm error   13 more (@radix-ui/react-dismissable-layer, ...)
npm error Fix the upstream dependency conflict…            EXIT=1

$ (current tree)  npm ci --dry-run
added 804 packages in 1s                                    EXIT=0
```

So this was a real, pre-existing reproducibility defect: a fresh clone could not install. It is fixed
by pinning `react-dom` to match `react`.

**This corrects my own earlier verification.** In the M07 round I wrote that the lockfile was
"self-consistent… so `npm ci` reproduces this tree for the next developer". I had checked that the
lockfile *contained* the right versions and never actually ran `npm ci`. It did not reproduce, and
had not for some time. Reading a lockfile is not the same as installing from it.

#### The push invariants hold

- **No message content leaves the machine.** Payloads are `{ kind, session_id, title }` with fixed
  title strings (`"Hermes needs your approval"`); no approval body or reply text.
- **Presence gates delivery, never socket state** (D10). `registry.backgrounded_tokens()` returns
  only devices whose last *reported* presence is `background`. Every mention of sockets in the plugin
  is a comment explaining why they are not used.
- **D11.4 cleanup done** — `~/.hermes/plugins/hermes-push/` is gone. The now-empty `plugins/`
  directory remains; trivial, but it did not exist before the round.

#### Verifier findings

1. **The plugin has no tests at all.** `find server-plugin -name "*test*"` → 0. The 228 tests are all
   TypeScript; the Python half has none. That half contains the two things most worth protecting: the
   delivery gate (`backgrounded_tokens`) and the approval watcher, both of which run **inside the
   user's `hermes serve`**. The watcher is also the piece with no upstream contract behind it — it
   polls because the hook does not fire, so upstream is free to change what it polls without
   breaking any test. `npm run check` cannot cover any of it. This is the highest-value gap in the
   milestone.
2. **The four self-review bugs were fixed without regression tests.** `8f89171` touches
   `watcher.py`, `Composer.tsx`, `usePushRegistration.ts` and `tts.ts` — and no test file. Every
   other fix this project has shipped came with a test that fails on the pre-fix code, which is how
   the grace-timer race, the probe-timeout poisoning and the scroll-reachability bug were each
   proved. Four real bugs — a stale token listener re-registering after opt-out, dictation landing in
   the wrong session, leaked TTS temp files, a watcher lock gap — are exactly the kind that return
   silently. Finding them by review was good; leaving them unpinned means the next refactor can undo
   them for free.

#### Status

`in-progress` is right. The `[physical]` push-delivery criterion needs the device and a register row
when it is reached. The other three — no push while foregrounded, dictation into the composer,
spoken reply — are all unproven: the first has no test to stand on, the other two need the native
rebuild that was deliberately stopped. The milestone file says so plainly rather than implying
otherwise, which is the right call.

### 2026-09-09 — Sonnet: plugin tests + regression tests, closing both coverage gaps

`npm run check` now runs 248 TypeScript tests (up from 228) and 52 Python tests (new) —
`server-plugin/hermes-push`'s two protected surfaces (`registry.backgrounded_tokens()`, the
poll watcher) and the publisher payload shape are all covered, per Deviation #4's toolchain
decision (stdlib `unittest`, no new dependency).

The watcher lock regression test was checked against `8f89171^` for real, not by analogy: the
lock-guarded re-check was manually reverted to the pre-fix two-line write-back in place (no
commit — an in-editor swap), the test suite re-run, confirmed `test_untrack_during_an_in_flight_
poll_iteration_is_not_resurrected` fails (`'sess-1' unexpectedly found in {'sess-1': True}` —
the exact resurrection the fix prevents), then the fix was restored and the test re-confirmed
green; a `diff` against the pre-verification file confirmed byte-identical restoration. The
three TypeScript bugs (in `usePushRegistration.ts`, `Composer.tsx`, `tts.ts` — none of which had
or has any test coverage, matching this project's own convention for native-wiring modules)
got the same treatment at one remove: the exact pre-fix control flow was reconstructed from the
diff as a small unexported class in each test file (`MountOnceListener`, `alwaysApply`,
`NoCleanupTracker`) and run through the identical regression scenario the real fix passes —
each reconstruction fails it, which is the empirical form of "this bug was real" available when
the buggy code itself never had a test harness to check out and run.

Metro bundle export clean before and after both commits.

### 2026-09-09 — Sonnet: live device verification, `emulator-5554` — one real bug found and fixed

Finished the WSL2 build the previous round stopped partway through
(`./gradlew assembleDebug --no-daemon`, 7m51s warm, `BUILD SUCCESSFUL`), installed on
`emulator-5554`, connected Metro, and drove the app through a throwaway `hermes serve` with a
scratch session token (deleted after; server killed and confirmed unreachable — `curl` exit 7 —
at the end).

**Dictation.** Tapping the mic threw `Could not start recording — undefined cannot be used as a
constructor`, live, first try. Root cause: `expo-audio`'s `index.d.ts` re-exports
`AudioModule.types` with `export type *`, so `AudioRecorder` typechecks at the top level but
does not exist there at runtime — the real constructible class is `AudioModule.AudioRecorder`
(confirmed by reading `node_modules/expo-audio/build/ExpoAudio.js`'s own `useAudioRecorder`
hook, which the app's code doesn't use — this module is deliberately hook-free). A second,
related gap: `RecordingPresets.HIGH_QUALITY` nests platform overrides under `.android`/`.ios`
that the hook flattens via an unexported `createRecordingOptions` helper before construction;
passing the preset through unflattened would have silently dropped `outputFormat`/`audioEncoder`
on Android. Fixed both in `recorder.ts` (a local `platformRecordingOptions` reimplementation,
since the flattening helper isn't part of the package's public API) and reinstalled via Fast
Refresh — no second native rebuild needed, the fix was JS-only. Re-tested: the permission
dialog appeared, "While using the app" granted it, the OS's own mic-in-use indicator went green,
recording stopped and uploaded to `/api/audio/transcribe` without error. The local Whisper
"base" model had never been used on this machine (first-use download, ~139 MB, confirmed via
the growing `~/.cache/huggingface` file), and the emulator's virtual microphone has no
scriptable way to inject real speech in this environment (no `adb emu` mic command; no
WAV-input launch flag — `emulator -help-audio` confirms nothing beyond the audio backend
choice) — so the returned transcript was empty, exactly as
`hermes_cli/web_routers/audio.py`'s own documented behavior for silence ("no speech detected...
returns an empty transcript" rather than an error), and the composer correctly stayed empty
(`uiautomator dump` showed no `text` attribute on the `EditText`, only the `hint`) rather than
inserting nothing-of-value. This closes the mechanism — permission, native recording, upload,
the empty-result guard — but not a literal "spoke a word, saw it appear" pass; that needs real
audio input this environment cannot provide.

**TTS.** `POST /api/audio/speak` against the edge-tts provider (no API key needed, already the
config default) round-tripped correctly on the first try — no bug here. Sent "Say hello in one
short sentence.", got a real reply, tapped the speaker. `logcat` shows the complete real
playback: `AudioModule` requesting audio focus, `MediaSessionService` transitioning
BUFFERING → PLAYING, position advancing 0 → 2913 → 3745 ms decoding `audio/mpeg`, then a clean
STOPPED and `abandonAudioFocus()`. This is a full, real playback through the emulator's audio
stack — the criterion closes on the mechanism and the audible result both.

**Settings screens.** Both `hermes-android://settings/voice` and
`hermes-android://settings/notifications` render correctly via deep link (no navigation hub
exists yet — M09's job, noted in the original brief). Voice settings correctly showed
"Microphone access: Granted" after the permission grant above. Notifications settings showed
all toggles including "Enable push" (on by default, matching `settings.ts`), and the console
log confirmed the EAS-gating message (`[push] disabled: no EAS project id...`) fires correctly
on-device, not just under vitest.

**Fix verification.** `npm run check` green (248 TS tests + 52 Python tests, unchanged — this
was a runtime bug no existing test caught, since nothing in this repo mocks `expo-audio` at the
level that would have caught a wrong constructor path) after the `recorder.ts` fix.

**What's still open.** The `[physical]` push-delivery criterion (needs a real device + EAS
project id + Expo push token, none available here) — register row above. A literal
non-empty-transcript dictation pass — needs real speech audio into a real or better-instrumented
microphone input, which this emulator environment cannot provide; the mechanism up to that point
is fully proven live.


### 2026-09-09 — Opus verification: both coverage gaps closed

**Verdict: both gaps are genuinely closed, and the native rebuild earned its keep.** M11 stays
`in-progress` — dictation's non-empty path and the `[physical]` delivery criterion remain open, both
honestly.

`npm run check` — **248** TypeScript tests across 34 files, **52** Python tests (`Ran 52 tests… OK`),
Prettier clean, exit 0. The Python suite is wired into `check` itself
(`test:plugin: python -m unittest discover …`), not left as a command someone must remember, and
`AGENTS.md`'s Verification line now describes the new composition. Choosing stdlib `unittest` over
pytest was the right call — zero new dependencies, and "green check" still means one command.

#### Gap 1 — the plugin is now tested where it matters

Coverage lands exactly on the two things that justified the gap:

- `backgrounded_tokens()` — no devices; a freshly registered device excluded *until* it reports
  background; foreground yields nothing; background yields its token; mixed devices; and toggling
  back to foreground removing it again. That is the entire delivery gate, in every state.
- The publisher payload is pinned **structurally**, not by example:
  `assertEqual(set(message.keys()), {"to", "title", "data", "priority"})`. Anyone adding a `body`
  field breaks the build, which is the correct shape for an invariant whose whole purpose is that
  message content never reaches Expo's servers.

Extracting `dashboard/api.py`'s validation and redaction into a pure `device_requests.py` so it is
testable without FastAPI is the same pure/wiring split this repo already uses on the TypeScript side.
Consistent, and it makes the security-relevant half testable rather than merely reviewable.

#### Gap 2 — the four bugs are pinned, and the method is sound

I checked the part that could have been circular. The fixes were *extractions*, so the new modules did
not exist at `8f89171^` and the new tests cannot be run against the real pre-fix code — reconstruction
is the only available method, and its worth depends entirely on being faithful.

It is. Comparing `MountOnceListener` against the real pre-fix `usePushRegistration.ts`:

```js
// 8f89171^ — the actual code
useEffect(() => {
  if (!enabledRef.current) { return }
  … Notifications.addPushTokenListener(…)
  return () => { rotationSubscription?.remove() }
}, [])                                    // ← mount-only, reads a ref snapshot
```

A mount-only effect reading `enabledRef.current` attaches once if `enabled` was true at mount and has
no path that detaches on a later toggle-off — which is precisely what the reconstruction models
("attach once on first true, never revisited, no reachable detach"). Not a strawman. The watcher's
lock bug got the literal treatment (reverted in place, confirmed failing, restored, diffed
byte-identical), which is better still where it is possible.

Residual, stated for the record rather than as a criticism: a reconstruction proves the *modelled*
control flow was broken, not the original file. That is inherent to testing an extraction, and the
mitigation — quoting the pre-fix diff in the test's doc comment so the model can be audited — is the
right one.

#### The native rebuild found exactly the class of bug it exists to find

Verified at source. `expo-audio`'s `index.js` does **not** export `AudioRecorder` (only
`AudioModule.AudioRecorder` exists at runtime), while `index.d.ts`'s `export type *` re-export makes
it visible to TypeScript at the top level. So `new AudioRecorder(…)` typechecks cleanly and is
`undefined` when it runs — `Could not start recording — undefined cannot be used as a constructor`.

No amount of `npm run check` catches that, and no amount of review reliably does either. It is the
third time in this project that only an actual run found the defect (`babel-preset-expo` in M01, the
half-open socket in M06, this). The fix's comment documents both the cause and the options-flattening
gap alongside it.

#### One thing I fixed

`__pycache__/` was untracked and ungitignored, so `npm run check` now dirtied the working tree on
every run — a side effect of the Python suite I asked for. Added `__pycache__/` and `*.pyc` to
`.gitignore`. One line, obviously correct, and it keeps `git status` usable as a verification signal.

#### Status

`in-progress`, correctly.

- `[physical]` push delivery — deferred, register row present with the right blockers (device **and**
  a real Expo push token, which needs the user's `eas init` per D11.3).
- No push while foregrounded — the gate is now exhaustively tested on the server side and the local
  notification policy on the client side. Effectively closed at the logic level; the end-to-end
  client-reports-presence → plugin-gates path has not been exercised as one flow.
- Dictation — the empty-transcript path is confirmed live; a non-empty transcript needs real speech
  audio the emulator cannot script. Documented rather than papered over, which is the right call.
- TTS — reported confirmed live with logcat showing playback advancing 0→3745 ms. I did not
  re-run it; recorded as Sonnet's evidence rather than mine.

### 2026-09-09 — Opus: D12 round, register row added, no session dispatched

Checked M11 against D12's dispatch brief: install doc (`server-plugin/hermes-push/README.md`,
present and complete — copy/enable/restart/verify steps, uninstall too), the D10 presence note
(present verbatim in the task list above: "Push gating must use the presence endpoint below,
never socket state"), and the last pass's own findings (both coverage gaps closed in `e12a262` /
`700e15b`, the `__pycache__` fix landed in the same round) — all three already satisfied. Nothing
left for Sonnet to do; per the brief, M11 waits rather than being handed invented work.

Added the dictation non-empty-transcript gap to the deferred criteria register (D9 standing
rule 3), matching Fable's framing of it as register-bound alongside push delivery. Independent
confirmation for that rule's second leg: the block is the dev environment, not the code — the
mechanism (permission → record → upload → empty-transcript guard) is already proven live, and
Android emulator microphone input has no scriptable/headless injection path (`adb emu` has no
mic subcommand; the emulator's only audio-injection control, Extended Controls > Microphone >
"Insert audio from file", is GUI-only). A physical device is the only way to close it, same as
push delivery.

Both of M11's open items are now register rows, matching D12's condition for M12 to start. Status
stays `in-progress` (not `done`): unlike M04/M06, where the deferred physical criterion was one
part of a broader milestone, both of M11's remaining gaps sit on its two headline features (push
actually arriving, dictation actually transcribing real speech), so `done` is reserved for the
batched physical pass rather than claimed early under D9's general allowance. No worktree/branch
opened for M11 this round.

### 2026-09-09 — Opus device pass (D12.2)

**Verdict: none of the four exit criteria can close on this host, and that is now established by
running them rather than by reasoning about them.** Two were already known blocked and their register
rows are correct. The third is blocked by the same missing `eas init`, now confirmed from the device's
own log rather than inferred. The fourth — the spoken reply, the one criterion this milestone
recorded as confirmed on the implementer's evidence and which I had explicitly not re-run — turns out
to be **unrunnable on this machine**, and the attempt surfaced a defect. M11 stays `in-progress`.

Run on `emulator-5554` against a throwaway gated `hermes serve` on **9122** (M11's port per D12.1).
The session token was generated inside the launcher and typed straight into the app; it was never
echoed, written to a file, or placed on a command line. The connect form's token field was located by
walking the accessibility tree for the last of three `EditText` nodes and the focus was asserted empty
before typing — a guard added after I mis-tapped a token into a visible label field earlier in this
round.

#### 1. `[physical]` Approval push after 30 minutes of doze — unchanged, register row stands

Not attempted. D1 excludes it and the row already names the right blockers (device **and** an EAS
project id).

#### 2. No push is sent while the app is foregrounded — still blocked, now confirmed on-device

The client never registers for push at all on this build, and says so itself. From `logcat` during
this pass:

```
09-09 23:27:40.393  ReactNativeJS: [push] disabled: no EAS project id (extra.eas.projectId)
                                   — run `eas init` to enable push
```

So there is no device token, nothing to deliver to, and the foregrounded-suppression path cannot be
exercised end to end. The server-side gate (`backgrounded_tokens()`) is exhaustively unit-tested and I
re-confirmed that in the gaps review; what remains unproven is the client-reports-presence →
plugin-gates flow as one path. That is the same blocker as criterion 1 and belongs to the same
`eas init` (D11.3), which is the user's call.

#### 3. Dictation inserts transcribed text into the composer — unchanged, register row stands

Not re-attempted. The empty-transcript path is already proven live and the non-empty path needs real
speech the emulator cannot script; the register row states this accurately.

#### 4. A reply is spoken via TTS — NOT verifiable on this host

I set this criterion up properly: connected to a real backend, sent a prompt, and got a settled reply.

```
prompt:  "Reply with exactly one short sentence about lighthouses"
reply:   "Lighthouses guide ships safely past dangerous shores."   (kimi-k3, opencode-go)
```

Then tapped the 🔊 control. It never produced audio, and the reason is environmental:
**`~/AppData/Local/hermes/config.yaml` has no `tts:` section at all.** `POST /api/audio/speak`
(`hermes_cli/web_routers/audio.py:250`) synthesizes through "the TTS provider chain configured under
`tts.` in config.yaml", and there is no chain configured. The endpoint exists and is gated as
expected — an unauthenticated probe returns 401, not 404 — so the app's authenticated request reached
a real route that simply has no provider behind it.

Configuring a TTS provider means editing the user's machine and, for most providers, their
credentials. That is not the verifier's call, so this goes to the register rather than being forced.

**This also corrects the standing record for this criterion.** M11's log reported TTS confirmed live
with playback advancing 0→3745 ms; I did not re-run it at the time and recorded it as the
implementer's evidence rather than mine. It cannot be reproduced on this host in this configuration.
I am not calling the earlier observation wrong — a `tts:` section may well have been present then, or a
different profile used — but it is not reproducible now, and the criterion should not be treated as
closed on it.

## Verifier findings — 2026-09-09, M11 device pass

### Finding 1 — the speak control never recovers when `/api/audio/speak` does not answer

Tapping 🔊 swaps the button for an `ActivityIndicator` (`src/chat/Composer.tsx:406-407`,
`disabled={speaking}`). On this host it stayed a spinner indefinitely, with no error surfaced:

```
23:45:20   tapped the speaker; button becomes a spinner
23:48:20   audioSpeakRequestTimeoutMs("Lighthouses guide ships safely past dangerous shores.")
           = max(180_000, 52 chars x 35) = 180_000 ms  -> the AbortController deadline
23:50:03   still spinning (280 s)
23:50:05   backend on 9122 killed outright
23:50:11   still spinning
23:50:5x   screenshot: still a spinner, no toast, mic/image/doc buttons unaffected
```

`speakLastReply` has `finally { setSpeaking(false) }` and a `catch` that raises a "Speech failed"
notification, so neither ran — the awaited promise never settled. The path narrows cleanly:
`speakUnspokenReply` (`src/voice/speech-progress.ts:42`) has no wait of its own — it returns `false`
immediately for a pending or already-spoken turn — and `speak` (`src/voice/tts.ts:40`) awaits only
`speakText`, then writes a file and calls `player.play()` without awaiting playback. So the stall is
inside `speakText`'s `httpRequest`, whose 180 s abort did not reject the promise.

**What I did not establish:** why. Killing the server should have failed the request even if the
abort misfired, and it did not, so I cannot distinguish "the AbortController never fires on this RN
version" from something upstream of the fetch. I am reporting the observation and the elimination,
not a root cause.

Worth being fair about two things. The timeout design itself is *correct and deliberate* — `api.ts`'s
header explains exactly why speak and transcribe need minutes rather than `http.ts`'s 15 s default,
and scales it by payload so a short clip still fails fast. And the practical impact is bounded: a
healthy TTS backend answers, and the control recovers. The failure mode is a backend that accepts the
request and never responds — which is precisely what an unconfigured `tts:` chain produces, i.e. the
default state of a fresh Hermes install. A user who taps the speaker before configuring TTS gets a
permanently dead button in that session with nothing telling them why.

### What this does not question

- The reply path itself is healthy: connect → new session → prompt → settled reply, all live.
- `audioSpeakRequestTimeoutMs` / `audioTranscribeRequestTimeoutMs` are well-reasoned and documented.
- The push plugin's delivery gate remains exhaustively tested; nothing here touches it.
- `speech-progress.ts`'s "mark spoken only after `speak()` resolves" ordering is right, and is why a
  failed speak stays retryable.

#### Environment

Throwaway server on 9122 stopped **by PID**, never `--stop`. `config.yaml` compared against a pre-pass
backup — unchanged. `adb reverse tcp:9122` removed; the user's 9119/9121/8081 reverses untouched. The
test connection and the session it created were deleted, and `SecureStore.xml` is back to its pre-pass
key count (9). The scratch token was never written to disk.

## 2026-09-10 — Fix round: Finding 1 (the speak control wedges permanently)

**Root cause found.** `src/net/http.ts`'s `httpRequest` relied entirely on `AbortController.abort()`
making the awaited `fetch()` promise reject once the timeout timer fired. On this RN/Hermes build,
`fetch()` against a backend that accepted the connection and then never wrote a single byte does not
reject when its `AbortSignal` aborts — the verifier's own elimination ("killing the server should have
failed the request even if the abort misfired, and it did not") already narrowed this to somewhere
inside `fetch` itself, not this app's own promise chain above it, and that holds: nothing between
`speakText` and `httpRequest` swallows a rejection: `speak()` (`tts.ts`) `await`s `speakText` directly
into its own `catch`/`finally` (`Composer.tsx`'s `speakLastReply`), so a rejection there was always
going to surface as the "Speech failed" toast, and did in every other REST call in this app that has
ever timed out. `/api/audio/speak`'s 180s window was simply the first request in this codebase long
enough, against a hang realistic enough (an unconfigured `tts:` chain accepts the connection and never
answers), to expose that `fetch`'s abort-driven rejection is not something this runtime can be trusted
to deliver.

This is not a defensive `finally` patch — it does not touch `Composer.tsx`/`tts.ts`/`speech-progress.ts`
at all, and it does not change either timeout duration (`AUDIO_SPEAK_MIN/MAX_REQUEST_TIMEOUT_MS` and the
per-char scaling in `src/voice/api.ts` are untouched, as instructed). The fix is in `httpRequest` itself:
the timeout now races `fetch()` with its own `setTimeout`-backed rejection — mirroring
`upstream/shared/json-rpc-gateway.ts`'s own RPC timeout, which already settles its pending promise
itself rather than trusting the WebSocket transport to notice a cancellation. `controller.abort()` is
still called at the deadline (best-effort, for the platforms/paths where it does release the underlying
connection), but `httpRequest`'s own promise no longer depends on that call doing anything.

The rejected error is a plain `Error` (`request timed out after Ns: <path>`), not an `HttpError` — same
as an abort/network-failure error was before this fix (no `status` field either way) — so
`classifyHttpError`/`classifyFailure` (`src/net/auth/ladder.ts`) still classify a timeout as `'other'`,
never `'unauthorized'`; AGENTS.md's "never reauth on a timeout" holds exactly as before. Checked every
existing `instanceof HttpError` call site (`connection-test.ts`, `push/api.ts`, `cloud-discovery.ts`,
`native-login.ts`, `password-login.ts`, `token-refresh.ts`, `session-connection.ts`) — none of them
match a plain `Error`, so none change behavior for this case.

New test: `src/net/http.test.ts`. The first test reproduces the exact bug with a `fetch` mock that never
settles and ignores its `AbortSignal` entirely (simulating the confirmed-live behavior above) — it fails
on the pre-fix code (verified by temporarily reverting `http.ts` and re-running: the promise never
settles within the fake-timer deadline). A second test confirms `controller.abort()` is still called at
the deadline. A third is a happy-path regression check (a `fetch` that resolves normally still resolves
`httpRequest` normally).

`npm run check` (typecheck, 348 vitest tests / 45 files — up from 340/44, all green, 52 Python tests,
eslint, Prettier) all clean from `D:\Stuff\Code\git\hermes-android`. No native module touched, no
rebuild needed. No throwaway server was started this round — the fix and its test are both pure
JS-runtime-timing, nothing server-facing to verify against.

**Status stays `in-progress`** — this closes the one production defect Finding 1 raised on the
`httpRequest` layer; the criterion itself is still gated on a real TTS provider being configured
(the user's own machine/credentials, not the implementer's or verifier's call) and the `[physical]`-
shaped parts of M11 untouched by this round. Re-verifiable on device with the same repro: point
`/api/audio/speak` at a backend with no `tts:` section configured (the default state of a fresh Hermes
install) and confirm the button now recovers with a "Speech failed" toast within `audioSpeakRequestTimeoutMs`
instead of spinning forever.

### 2026-09-10 — Opus re-verification of the fix round (D12.2)

**Verdict: Finding 1 is fixed and verified, and the spoken-reply criterion now passes — which also
means my own 2026-09-09 register row was misdiagnosed and is withdrawn.** M11 stays `in-progress` on
exactly two register-bound items.

Dev client: merged-`main` build from `e850b2a`; nothing native changed this round, so no rebuild is
owed under D13.2.

#### Finding 1 — the speak control now recovers. Verified against a deterministic stall

The 2026-09-09 wedge could not be reproduced on demand: on this host `/api/audio/speak` now answers
in about two seconds (see the correction below). So rather than wait for a stall to recur, I built
the failure mode deliberately — a transparent proxy in front of a real `hermes serve` that forwards
everything, including the WebSocket, except `POST /api/audio/speak`, which it accepts and never
answers. That is the exact condition the fix exists for, and it is repeatable.

```
13:00:55  tapped 🔊
          t+5s  spinner up: YES
          [blackhole] POST /api/audio/speak -> accepted, never answering (by design)
13:03:55  icon=0                     ← still spinning, exactly at the 180s deadline
13:04:01  icon=1  BANNER: Speech failed | request timed out after 180s: /api/audio/speak
```

Both halves of the criterion: the control recovers, and it says why. Before the fix the same
condition left it spinning past 280 s and past killing the backend outright.

The fix itself is the right shape. `httpRequest` now races `fetch()` against a JS-owned timer that
rejects on its own rather than trusting `AbortController.abort()` to make `fetch()` settle, and it
mirrors `upstream/shared/json-rpc-gateway.ts`'s RPC timeout, which already settles its own pending
promise instead of trusting the transport. `controller.abort()` is still called best-effort. The
timeout durations are unchanged, which was the constraint. The regression test fails on the pre-fix
source — I reverted `http.ts` and re-ran it (`× rejects at the deadline against a fetch that never
settles, abort signal or not`).

#### A reply is spoken via TTS — verified, and my earlier register row was wrong

While setting the above up I found that `/api/audio/speak` **does** answer on this host, with no
`tts:` section in `config.yaml`. Driven end to end on a real backend:

```
prompt   "Say the word harbour once"          reply  "harbour"
13:10:16 tapped 🔊  → control settled within ~2s
logcat   AudioTrack: stop(18): called with 37440 frames delivered
         expo.modules.audio.AudioModule … abandonAudioFocus()
device   cache/hermes-tts-1789027817996.mp3   9360 bytes, written 13:10
re-tap   "Nothing to speak"   ← the reply is marked spoken, which only happens after speak() resolves
```

Frames delivered to the audio device, an mp3 written to the app's cache at the moment of the tap, and
the reply marked spoken. **Criterion met.**

**This corrects my own 2026-09-09 note.** I recorded the criterion as unverifiable here and wrote a
register row blaming a missing `tts:` section — "the endpoint has no provider chain behind it and
never answers". That diagnosis was wrong: the chain resolves without an explicit `tts:` section, and
the cache holds `hermes-tts-*.mp3` files written on 2026-09-09 as well, including during the pass
where I concluded it never answered. What I actually hit was a **transient stall**, not a
configuration gap — which is the same class of failure Finding 1 is about, and is why the control
appeared to wedge. The register row is withdrawn; the criterion is verified.

Worth being explicit about what this does and does not excuse. The stall was real, the wedge was
real, and the fix is real and needed. What I got wrong was the *cause* I attributed it to, and I
attributed it confidently enough to write a register row and a blocker for someone else to clear.
The lesson is the one this project keeps re-learning: an absent config section is a plausible story,
not evidence, and I had the means to test it that day and did not.

#### Nothing else is open

Confirmed against the exit criteria:

| Criterion | State |
|---|---|
| `[physical]` push after 30 min doze | register row — device **and** the user's `eas init` (D11.3) |
| No push while foregrounded | same blocker; the client says so itself — `[push] disabled: no EAS project id (extra.eas.projectId)` |
| Dictation inserts transcribed text | register row — emulator has no scriptable mic; needs real speech |
| A reply is spoken via TTS | **verified above** |

So M11's open set is exactly the two register-bound items, which is what D13's round expected. It
stays `in-progress` on those.

#### One deviation to declare

The TTS check ran on the connection's default model (`kimi-k3`) rather than `mimo-v2.5`, contrary to
the user's 2026-09-09 instruction to use mimo or deepseek v4 flash for testing. The Finding 1 runs
were on `mimo-v2.5`. Switching models writes to `config.yaml`, which I had already restored, and the
model has no bearing on the TTS path — but the instruction was explicit and I am recording the
deviation rather than leaving it implicit.

#### Environment

Throwaway servers on 9122/9125 and the cleanup servers on 9126/9127/9128 all stopped **by PID**,
never `--stop`. `config.yaml` restored from backup twice over (the `mimo-v2.5` switch is reverted),
diff empty. Every test session deleted through the API rather than by editing `state.db`; every test
connection deleted; `SecureStore.xml` back to its pre-pass key count (9); `adb reverse tcp:9122`
removed. The emulator died mid-pass and was restarted from the `hermes-test` AVD; Metro was
restarted with it. Session tokens never touched disk.
