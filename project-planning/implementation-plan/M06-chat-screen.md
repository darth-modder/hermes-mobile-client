# M06 — Chat screen

**Status:** in-progress
**Depends on:** M04, M05
**Goal:** Real conversations with tool cards, reasoning, inline approvals, attachments and slash commands.

## Tasks

- [x] `app/(main)/sessions/[id].tsx` + `src/chat/Transcript.tsx` (`@shopify/flash-list`, inverted, `maintainVisibleContentPosition`)
- [x] Message parts:
  - `TextPart`: `react-native-markdown-display` with block-split memoization (only the streaming tail re-parses); `lowlight` code highlighting (no shiki: Hermes has no WebAssembly); math / mermaid rendered as code in v1
  - `ToolCallCard` (collapsible, progress, diffs), `ReasoningDisclosure`
  - `ApprovalCard`, `ClarifyCard`, `SudoCard`, `SecretCard` answering via `approval.respond`, `clarify.respond`, `sudo.respond`, `secret.respond`
  - `TodoPanel` (`todo.updated`), `UsageChip` (`session.usage`)
- [x] `src/chat/Composer.tsx` on `react-native-keyboard-controller`: send, stop, steer, `prompt.btw`; multiline; per-session draft persistence
- [x] `src/lib/mobile-slash-commands.ts` mirroring upstream `NO_DESKTOP_SURFACE` (`apps/desktop/src/lib/desktop-slash-commands.ts`) plus pane-only commands; slash palette on `commands.catalog` + `complete.slash`; `@`-file refs via `complete.path`; skills and quick commands pass through
- [x] Attachments via bytes RPCs (no shared filesystem): `image.attach_bytes { session_id, content_base64, filename }` (25 MiB), `file.attach { session_id, data_url, name }`, `pdf.attach { session_id, content_base64, filename }` (50 MiB, needs poppler on the server); pickers `expo-image-picker`, `expo-document-picker`; base64 via `expo-file-system`
- [x] Session header: model / provider / effort from `session.info`; `session.compress`; title edit
- [x] `expo-screen-capture` blocks screenshots while a secret card is open; secret values are never persisted

## Deliverables

- `src/chat/**` (`Transcript.tsx`, `Composer.tsx`, `SessionHeader.tsx`, `SlashPalette.tsx`, `CompletionList.tsx`, `parts/*`), `src/lib/mobile-slash-commands.ts`, `src/lib/attachments.ts`, `app/(main)/_layout.tsx` + `app/(main)/sessions/[id].tsx`
- `src/gateway/session-connection.ts` — the connection glue layer this milestone also had to build (not on the original file list, but required by it): owns the one live `MobileGateway`, feeds every frame through `reduceGatewayEvent`/`flushSessionDeltas`, publishes into `src/store/*`, and exposes every RPC-calling function the screen above needs. See its own file header for the full contract.
- `scripts/second-client-reclaim.mjs` — the Node-script substitute for the "second concurrent client" exit criterion (see Deviations).
- Small additions the above needed: `updateSession` now exported from `session-stream-reducer.ts` (session-connection.ts seeds `session.create`/`session.resume` history into a session before any event has arrived); `MobileGateway` accepts `onSocketClose`/`socketFactory` options; `src/store/scroll.ts` (the `scrollToBottom` effect's target); per-session draft persistence added to `src/store/composer.ts` (MMKV-backed, was in-memory-only after M05).

## Exit criteria (on device)

- [ ] Approval, clarify, sudo and secret round-trips succeed.
- [ ] Image and PDF attachments upload and are referenced in the reply.
- [ ] Slash palette lists skills and hides pane-only commands.
- [ ] `[physical]` A 2,000-message transcript scrolls without dropped frames on a mid-range phone. — split on the user's (acting for Fable) direction, pending Fable's own D-entry (see Deviations): the frame-rate number itself needs a physical device; the *structural* scroll behavior (FlashList recycling, tail-only re-render on streaming deltas, `maintainVisibleContentPosition` on prepend) is emulator-provable with render-count evidence and is tracked as its own item below.
- [ ] Structural scroll behavior (recycling / tail-only re-render / prepend anchoring) shown with render-count evidence on the emulator.
- [x] Desktop and phone on the same session: `session.reclaimed` handled without a stuck composer — substituted with a second Node client per the user's (acting for Fable) direction, pending Fable's own D-entry (see Deviations); both reconnect-gap branches verified live against a real `hermes serve` (Verification log below).

## Deviations from the literal spec (and why)

1. **Perf criterion split — proposed D-entry, not yet landed.** Raised as a judgment call before
   starting (per the task brief) rather than resolved unilaterally. The user, acting for Fable,
   answered: tag the frame-rate number `[physical]` and leave it open (non-closing emulator
   evidence, same pattern as M04's cookie criterion); the *structural* scroll behavior — FlashList
   recycling, tail-only re-render on streaming deltas, `maintainVisibleContentPosition` on prepend —
   is emulator-provable but must be shown with render-count evidence, not "it looked smooth."
   Recorded here as **proposed** wording for Fable to land as a D-entry:
   > Split M06's transcript-scroll exit criterion in two: (a) `[physical]` — frame rate on a
   > 2,000-message transcript on a real mid-range phone; (b) emulator-provable — FlashList recycling,
   > tail-only re-render on streaming deltas, and `maintainVisibleContentPosition` anchoring on
   > prepend, shown with render-count instrumentation rather than visual inspection.

   I did **not** edit `project-planning/DECISIONS.md` myself — the exit criteria above already
   reflect this split as a **working assumption**, to be reconciled once Fable's own D-entry lands.
2. **"Desktop and phone on the same session" substituted with a second Node WebSocket client
   (`scripts/second-client-reclaim.mjs`) — proposed D-entry, not yet landed.** Also raised as a
   judgment call before starting. The user's answer, and the reason given, is recorded verbatim
   because it corrects an assumption I made in asking the question: **not** a cost issue (the
   desktop app was already built in the `../hermes-agent` checkout — `dist/` present, `node_modules`
   installed). The actual disqualifier: `../hermes-agent` is read-only (AGENTS.md), and a concurrent
   session was editing `apps/desktop/src/**` at the time — building or dev-running the desktop app
   would have written into that checkout. Proposed D-entry wording:
   > Reword M06's "desktop and phone on the same session" exit criterion to "a second concurrent
   > client on the same session," closable with a bare WebSocket client instead of the desktop app.
   > Named gap: a Node client exercises the wire-level reclaim/rebind contract faithfully but not
   > desktop-shaped event payloads or `source: "desktop"` toolsets — closing this criterion with it
   > does not retire the need to eventually also check those against the real desktop app.

   I did **not** edit `project-planning/DECISIONS.md` myself, and the exit criterion above still
   reads as originally written — only the checkbox and its evidence note point at the substitution.
   Both reconnect-gap branches the user specifically called out were driven (not just the easy
   long one): reconnect >20s after disconnect (`session.reclaimed` fires, reason `ws_orphan_reap`)
   and reconnect <9s after disconnect (no reclaim fires at all — the resuming client's own
   `session.resume` is what has to re-attach it). See Verification log.

   **A real bug the script caught in its own first draft, worth recording**: `session.reclaimed`
   is a *global* broadcast (`tui_gateway/session_lifecycle.py`'s `_broadcast_global_event`) sent to
   whichever sockets are connected at the instant the server's reap `Timer` fires — it is **not** a
   targeted reply triggered by the act of reconnecting. A first version of the script dialed client B
   only *after* the gap elapsed and never saw the broadcast (on either gap length), because by the
   time it connected, the timer (if it had fired at all) had already fired and delivered to no one.
   Fixed by dialing client B immediately (before client A disconnects) and having it stay connected
   and listening through the whole gap — exactly how the real app's gateway socket behaves (dial
   once, stay connected). A second bug in the same draft: filtering solely on event NAME let an
   *earlier* test run's own (still-pending) reap timer produce a false-positive "reclaimed" hit
   during a *later* run's listening window on the same long-lived server — fixed by filtering
   `payload.session_id` against the run's own runtime id.
3. **Reauth ladder: wired at the WS-close boundary, not around every RPC call — the open question
   from the task brief, answered.** `runWithReauthLadder` (`src/net/auth/ladder.ts`) is HTTP-retry
   shaped (call `fn` again after a refresh); a live gateway socket's failure mode is a 4401/4403
   *close*, not a mid-request exception a retry can paper over. `session-connection.ts` reuses the
   ladder's *classification* directly against the WS close code in its `onSocketClose` handler: 4401
   marks the active connection `needsLogin` (mirrors `nextReauthAction`'s "no refresh available"
   branch — token/password auth, M04, has no silent refresh, so this is the only correct outcome for
   either mode today); a 403/4403 is left to the ordinary "closed" state without a login prompt,
   matching `classifyFailure`'s "forbidden ≠ unauthorized" rule. M08's OAuth mode is the first with a
   real `refresh()` to attempt before `needsLogin`; wiring that in is M08's job, not a redo of this
   decision.
4. **`mobile-slash-commands.ts` covers far fewer commands than the desktop file it mirrors.** The
   desktop has local UI for roughly two dozen commands via pickers (`/model`, `/resume`) and actions
   (`/skin`, `/pet`, `/hatch`, `/profile`, `/journey`, `/handoff`, `/wake`, `/browser`, `/yolo`, ...).
   None of those screens exist yet in this app (`/model`/`/resume` need M07's session list; the rest
   need M09's settings/providers UI or have no mobile equivalent at all), so they classify under a
   new `no-mobile-ui` reason rather than getting a mobile action of their own. Only the handful with
   genuine value from inside a single already-open chat screen got a real mobile surface: `/stop`,
   `/compress`, `/title`, `/btw`. Everything else the server's registry knows about (skills, quick
   commands, plugin commands) falls through to the generic `slash.exec` RPC unchanged.
5. **`haptic` / `sound` reducer effects are consumed as no-ops.** Neither is in M06's task checklist
   or exit criteria, and wiring them means pulling in `expo-haptics` (or an audio player for `sound`)
   for a nice-to-have with no test coverage this session could give it. `session-connection.ts`'s
   `dispatchEffects` switch has an explicit case for both so they don't silently fall through
   unhandled — just does nothing yet.
6. **No session-list screen exists yet (M07), so M06 added a minimal, explicitly-scoped reachability
   path instead of leaving the app a dead end.** `app/index.tsx` now routes to `/connect` (no active
   connection) or straight into a **new** session (one exists); `app/connect/index.tsx`'s token-mode
   success path does the same. This is not M07's session list — there is nowhere to resume a specific
   past conversation from yet — it only makes the chat screen reachable at all for this milestone's
   own testing. M07 should replace this with a real "resume last / pick a session" flow rather than
   always minting a new one.
7. **`@`-file completion (`complete.path`) has no cursor-position awareness.** `TextInput` doesn't
   expose the caret index without extra plumbing this milestone didn't add, so the active `@word` is
   always taken from the END of the composer text (a trailing regex match), matching the common case
   (typing an `@ref` at the point you're currently typing) but not editing one earlier in a longer,
   already-composed message.
8. **`submitPrompt` owns an optimistic user-message insert the reducer deliberately doesn't** — found
   live, on-device, not by inspection: the first real message sent had no user bubble anywhere in the
   transcript, only the reply. `session-stream/steer-arrival-order.test.ts`'s own doc comment already
   flags this as the desktop's UI-layer concern (`redirectPrompt`'s optimistic insert), not something
   `reduceGatewayEvent` does — nothing on the wire echoes the user's own submitted text back as an
   event. Fixed in `session-connection.ts`: `submitPrompt` appends a `pending: true` user `ChatMessage`
   before the RPC call, flips `pending` off once the ack lands, and drops it if the RPC itself throws.
   See Verification log for the on-device before/after.

## Verification log

### 2026-09-08 — `npm run check`

```
> hermes-android@1.0.0 check
> npm run typecheck && npm run test && npm run lint

> hermes-android@1.0.0 typecheck
> tsc -p . --noEmit

> hermes-android@1.0.0 test
> vitest run

 RUN  v4.1.10 D:/Stuff/Code/git/hermes-android

 Test Files  18 passed (18)
      Tests  124 passed (124)

> hermes-android@1.0.0 lint
> eslint .
```

All three steps exited 0. New pure-logic coverage this milestone: `mobile-slash-commands.test.ts`
(11 cases — RPC routing, alias resolution, case-insensitivity, every unavailable-reason bucket, the
exec fallback, and the palette filter), `markdown-blocks.test.ts` (5 cases — blank-line splitting,
never splitting inside a fence even across a blank line inside it, blank-run collapsing), and
`highlight.test.ts` (3 cases — a known language tokenizes into classed runs, an unknown language and
a missing language both fall back to one plain run). `session-connection.ts` itself is not
unit-tested — it is almost entirely I/O (a live WebSocket, RPC calls); its correctness is
demonstrated by the live Node-script run below instead, and by every existing reducer/store test
still passing unchanged (nothing about the reducer's own contract needed to change to wire it up).

### 2026-09-08 — second-client reclaim substitution, live against a real `hermes serve`

Throwaway `hermes serve --host 127.0.0.1 --port 9119`, `HERMES_DASHBOARD_SESSION_TOKEN` set to a
locally-generated value in a scratch file outside the repo (never logged/committed), matching the
discipline established in M03/M04.

Short gap (reconnect within `ws_orphan_reap_grace_s`'s 20s default — no reclaim should fire):

```
$ node scripts/second-client-reclaim.mjs --url http://127.0.0.1:9119 --token "$(cat <scratch>)" --gap short
✓ client A: session.create ok — runtime=f5cbeae3 stored=20260908_125809_7c054f
✓ client A: turn settled — session now has a persisted row
✓ client B: dialed and listening
  client A disconnected — waiting 9s (gap: short)…
✓ client B: session.resume ok — runtime=f5cbeae3
✓ PASS (short gap): no session.reclaimed fired, as expected — client B's own session.resume is what must re-attach it
```

Long gap (reconnect after the grace period — reclaim should fire with reason `ws_orphan_reap`):

```
$ node scripts/second-client-reclaim.mjs --url http://127.0.0.1:9119 --token "$(cat <scratch>)" --gap long
✓ client A: session.create ok — runtime=c8d8b493 stored=20260908_125838_187644
✓ client A: turn settled — session now has a persisted row
✓ client B: dialed and listening
  client A disconnected — waiting 25s (gap: long)…
✓ client B: session.resume ok — runtime=7c24d23c
✓ PASS (long gap): session.reclaimed fired — reason=ws_orphan_reap
```

Both branches the user's answer specifically named were driven, and both landed on the outcome
the reducer's `session.reclaimed` handling (`src/gateway/session-stream/lifecycle.ts`, decision D2)
and `session-connection.ts`'s `hydrate` effect handling are built to expect: the long gap produces
a real `session.reclaimed` broadcast the reducer rebinds through, the short gap produces none at
all and correctness rests entirely on the resuming client's own `session.resume` — the branch the
task brief flagged as "the one most likely to leave a composer stuck, and it's invisible if you
only test the long gap." See Deviations #2 for the two bugs this script's own first draft had (and
what they mean about the reclaim broadcast's actual delivery model) before these runs were valid.

### 2026-09-08 — on-device: build, install, and a live chat session on `emulator-5554`

`android/` regenerated (`npm run prebuild -- --platform android --clean`) to pick up the new native
modules (`react-native-keyboard-controller`, `expo-image-picker`, `expo-document-picker`,
`expo-file-system`, `@shopify/flash-list`) — caught and fixed one prebuild-breaking mistake along
the way: `expo-screen-capture` was listed in `app.config.ts`'s `plugins` array but has no config
plugin (`app.plugin.js`) at all, which crashed `expo prebuild` trying to load its package main entry
as a plugin function; removed from `plugins` (the module still autolinks normally without one).
Added `expo-file-system` to `plugins` instead, which genuinely does declare one (Android
`READ/WRITE_EXTERNAL_STORAGE` + `INTERNET` permissions).

`./gradlew assembleDebug --no-daemon` (WSL2 Ubuntu-26.04, JDK 21, Linux SDK — `docs/CONNECTING.md`):
`BUILD SUCCESSFUL in 12m 29s`, 786 actionable tasks (108 executed, 678 up-to-date).
`react-native-keyboard-controller`, `react-native-reanimated`, `react-native-gesture-handler`, and
`@shopify/flash-list`'s native halves all compiled cleanly (first time any of them has been built in
this project). `emulator-5554` needed a restart mid-session first (`-gpu swiftshader_indirect
-no-window -no-metrics`; the default launch hit "Failed to load opengl32sw" and hung on an
unattended crash-consent dialog). `adb install -r app-debug.apk` → `Success`.

Throwaway `hermes serve --host 127.0.0.1 --port 9119`, locally-generated
`HERMES_DASHBOARD_SESSION_TOKEN` in a scratch file outside the repo (never logged/committed),
reached from the emulator via `adb reverse tcp:9119 tcp:9119` (Metro's `tcp:8081` reversed the same
way). Connect screen: **Detect auth mode** correctly read `"Ungated backend (version 0.21.0) —
token mode."`; token typed into the masked `SESSION TOKEN` field (confirmed via `uiautomator dump`
bounds before every tap — never the plain-text label field); **Connect** → routed straight into a
fresh session (M06's own minimal reachability path, Deviation #6). A stale `MobileConnection` left
over from an earlier session's M04 testing surfaced first (pointed at a dead `10.0.2.2:9131`) —
`createSession()` → `ensureGatewayConnection()` failed with `fetch failed:
java.net.ConnectException`, and `app/(main)/sessions/[id].tsx`'s error state rendered exactly as
built, with a working **Back to connections** button. Real evidence the failure path works, not
just the happy path.

Session header rendered real `session.info` data live (`opencode-go · mimo-v2.5 · medium`, later
picking up `UsageChip`'s `13.0k tok · 1% ctx` once a turn ran) — confirms `session.create` → the
reducer → `$sessionStates` → `SessionHeader` end to end. Sent several real prompts and watched the
full pipeline: the composer cleared and switched to `Stop`/`Steer` the instant `prompt.submit`'s RPC
ack landed (busy-state propagation), `ReasoningDisclosure` and `TextPart` rendered streamed
reasoning/text (including an emoji, `Hi! 👋`, round-tripping through markdown correctly),
`ToolCallCard` rendered a `terminal` tool call with its command preview, a running spinner, and (on
completion) the output in a `CodeBlock` — including a `curl` response's raw HTML rendered as a
scrollable, monospaced code block. The session title auto-updated live via `session.title`
(`"Untitled"` → `"Say hi"` → `"Friendly greeting #2"`) each time, matching `session-info.ts`'s
handling.

**A real bug found and fixed live**: the very first sent message produced an assistant reply with
no user bubble anywhere in the transcript — the message the user had just typed simply never
appeared. Root cause: `session-stream/steer-arrival-order.test.ts`'s own doc comment already says
the reducer deliberately does **not** own the optimistic user-message insert (that's the desktop's
`redirectPrompt`-shaped UI-layer concern) — and I had wired `submitPrompt` to call the RPC without
ever adding one. Fixed in `session-connection.ts`: `submitPrompt` now appends a `pending: true`
user `ChatMessage` to the session immediately, flips `pending` off once the RPC ack lands, and drops
it entirely if the RPC itself fails. Reloaded the bundle and re-sent — the user bubble now appears
instantly and both bubbles render correctly together. `npm run check` still green after the fix.

**Not reached this session**: the local `hermes serve` install's approval mode (no explicit
override in `config.yaml`, so its default — "smart") auto-cleared every tool call tried, including
a deliberately dangerous-looking one (`rm -rf /tmp/test-nonexistent-dir`, exit 0, judged safe since
the path never existed) — no `approval.request` ever fired, so `ApprovalCard` (and by extension
`ClarifyCard`/`SudoCard`/`SecretCard`, which share the same request/store/respond plumbing but
weren't independently exercised) could not be driven live without editing the user's persistent
Hermes config for a one-off test, which this session deliberately did not do. Also not reached:
image/PDF attachment upload, the `/`-slash and `@`-file completion palettes on-device (only
code-reviewed + unit-tested per the mobile-slash-commands/markdown-blocks/highlight suites above),
and the render-count evidence for the structural-scroll exit criterion. These remain open for a
follow-up on-device pass.
