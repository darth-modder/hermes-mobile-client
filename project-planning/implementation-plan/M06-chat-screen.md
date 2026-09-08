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

- [x] Approval, clarify, sudo and secret round-trips succeed. — **all four now closed.** Approval (both Run and Reject), clarify, sudo's full typed-password submit, and — new this round, per D8's returned assignment — secret's both branches (skip and submit), via the bundled `/airtable` skill's `AIRTABLE_API_KEY` requirement. See the 2026-09-08 "SecretCard round-trip" Verification log entry for full command output: `secret.request` fired exactly as D8 predicted, `SecretCard` mounted reachable without scrolling (first live exercise of the scroll fix for this request type), `FLAG_SECURE` engaged/released (confirmed via `dumpsys window windows`, both states), skip branch confirmed via the server's real 300s timeout (`.env` byte-identical before/after, sha256-verified), submit branch confirmed via a dummy value that reached `secret.respond` and was written to `~/.hermes/.env` (agent's own reply: "The AIRTABLE_API_KEY environment variable is set to a dummy placeholder value"), then `.env` restored and reverified byte-identical, and the dummy value confirmed absent from the app's own MMKV file. A real gap was found and fixed along the way — see Deviation #12.
- [ ] Image and PDF attachments upload and are referenced in the reply. *(Split by D8, 2026-09-08: image half closed — upload, server reference and a correct vision reply; PDF half deferred to the README register, owner Sonnet, unblocks when poppler is on the server host's PATH. Original wording kept above.)* — image upload confirmed live (attachment chip appears in the sent message, server receives the bytes); PDF not attempted — this dev machine's server has no `poppler-utils` (`pdftoppm`), which `pdf.attach` requires server-side. Left unchecked because PDF is entirely untested, not just unverified. Proposed as a Fable deferral this round (see Deviations #10).
- [x] Slash palette lists skills and hides pane-only commands. — **closed by Opus's device pass** (see the Opus re-verification note): the server ships 53 bundled skills (`commands.catalog.skill_count`), `/arxiv` appears in the palette and exists only in the catalog's `skills` map, and all seven pane-only commands checked are absent. Sonnet's original note follows: pane-only hiding confirmed live against the real `commands.catalog` (`/mouse` absent, sibling matches like `/moa`/`/memory` present); a skill specifically appearing in the palette was not independently confirmed this round (no skill was configured on the throwaway test server). Left unchecked pending that half.
- [ ] `[physical]` A 2,000-message transcript scrolls without dropped frames on a mid-range phone. *(D6 + D8, 2026-09-08: this is half (a) of the split; deferred to the README register, owner Opus, target the batched physical pass on the OEM-skinned device expected within weeks. Under D9 it no longer holds M06's `done`.)* — split on the user's (acting for Fable) direction, pending Fable's own D-entry (see Deviations): the frame-rate number itself needs a physical device; the *structural* scroll behavior (FlashList recycling, tail-only re-render on streaming deltas, `maintainVisibleContentPosition` on prepend) is emulator-provable with render-count evidence and is tracked as its own item below. Proposed as a Fable deferral this round (see Deviations #10) alongside PDF and secret.
- [ ] Structural scroll behavior (recycling / tail-only re-render / prepend anchoring) shown with render-count evidence on the emulator. *(Reworded by D6, 2026-09-08, to: "FlashList recycling and tail-only re-render on streaming deltas shown with render-count evidence on the emulator." Prepend anchoring is removed — no code path exists in M06 or M07 — and sits in the README register, owned by the first milestone that adds transcript history pagination. Original wording kept above. Both remaining halves are closed with counts; the checkbox is Opus's to tick.)* — **two of three now proven with real counts this round**: tail-only re-render (2-vs-162 renders, prior round) and FlashList recycling (new this round — 16 underlying component instances handled 29 distinct logical messages across a scrolled transcript, with 11 of those 16 instances each rendering between 2 and 6 *different* message ids over time; a mount-per-row list would show a strict 1:1 instance:message mapping forever, so reuse this direct is real recycling evidence, not inference). The third sub-part, `maintainVisibleContentPosition` anchoring on prepend, has **no exercised code path to measure**: M06 has no live "load older history" mechanism — `session.resume` seeds the *entire* history in one shot on mount, and `session-stream/types.ts`'s own header comment says this client has "no pagination-authority race to arbitrate" (unlike the desktop's multi-window tile cache). The prop is configured defensively for whenever M07 adds real pagination; nothing in M06's feature set ever prepends to an already-rendered, scrolled transcript. Left unchecked — two of three closed, the third is out of this milestone's scope to exercise, not merely unmeasured.
- [x] Desktop and phone on the same session: `session.reclaimed` handled without a stuck composer *(reworded by D7, 2026-09-08, to: "A second concurrent client on the same session: `session.reclaimed` handled without a stuck composer, both reconnect branches (inside and after the server orphan grace)." Original wording kept. The desktop-app check — desktop-shaped payloads, `source: "desktop"` toolsets — is in the README register, owner Opus.)* — substituted with a second Node client per the user's (acting for Fable) direction, pending Fable's own D-entry (see Deviations); both reconnect-gap branches verified live against a real `hermes serve` (Verification log below).

## Deviations from the literal spec (and why)

1. **Landed as D6 (2026-09-08), with prepend anchoring removed rather than carried.** Original note follows. **Perf criterion split — proposed D-entry, not yet landed.** Raised as a judgment call before
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
2. **Landed as D7 (2026-09-08); D7 also answers the read-only question — ignored build output in `../hermes-agent` is permitted, source edits and gate impact are not.** Original note follows. **"Desktop and phone on the same session" substituted with a second Node WebSocket client
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
9. **`$notifications` (`src/store/notifications.ts`) had a writer but no reader — found live, on-device,
   during this round's Opus-review verification pass, not by inspection.** `notify()` is called from
   `session-connection.ts`, `Composer.tsx`, and `SessionHeader.tsx` — but `grep -rln "\$notifications"
   src app` turned up only the store file itself: nothing in the app ever subscribed to it. Every error
   toast the reducer or the connection layer produced (a failed send, a failed attachment upload, a
   reconnect warning) fired into an atom nobody rendered, and the user saw nothing. Concretely: the
   first two image-attachment attempts this round appeared to fail with zero visible feedback, which
   is what led to finding this. Fixed with a new `src/chat/NotificationBanner.tsx`, mounted in
   `app/(main)/sessions/[id].tsx` between the header and the transcript — renders the most recent
   notification (auto-dismissing after `durationMs` or 5s, tap-to-dismiss), styled by `kind`
   (error/info/warning). After mounting it, a retried image attachment with a properly-selected image
   succeeded and showed the expected chip — the earlier "failures" were most likely tap-target misses
   on the system photo picker, with the invisible-toast bug masking whatever the actual error was.
10. **A real correctness bug in the primary interaction M06 exists to deliver: the approval card could
    arrive with its own buttons entirely absent from the accessibility tree, not merely off-screen —
    found by Opus's device pass, root-caused and fixed this round.** `input-requests.ts` pushed a
    `scrollToBottom` effect for `clarify.request` (line 81, the only one) but never for
    `approval.request`, `sudo.request`, or `secret.request`. All four cards mount inside the inverted
    `FlashList`'s `ListHeaderComponent`, which sits at the list's visual bottom edge — reachable only if
    something tells the list to scroll there. `ClarifyCard` worked by accident of being the one request
    type wired to that effect; the other three did not, so a user who did not think to scroll saw
    "Approval required" with no way to answer it. Fixed by pushing the same `scrollToBottom` effect
    (gated identically: `storedSessionId && ctx.isActiveEvent`) for all three remaining request types,
    covered by a new `input-requests-scroll.test.ts` (six cases: active vs. background session, all
    three request types). Also corrected this file's own "Approve"/"Deny" wording to the real button
    labels, Run/Reject. See the 2026-09-08 "approval-card fix" Verification log entry for the on-device
    before/after (buttons absent from the tree at HEAD; present and tappable without any scroll after
    the fix, for both ApprovalCard and SudoCard).
11. **Landed as D8 (2026-09-08): PDF and frame rate deferred by register entry; SecretCard returned to Sonnet, not deferred — the trigger exists (see exit criterion 1). M07 may start (D9).** Original note follows. **Deferral bundle proposed for Fable, not yet landed — three more criteria are environment-blocked
    on this machine, not client bugs.** Raised together rather than one at a time, per this round's
    task brief, alongside the two deviations above that are already pending their own D-entries:
    - **PDF attachment** (exit criterion, line 31): `pdf.attach` needs server-side `poppler-utils`
      (`pdftoppm`), confirmed absent on this dev machine (`where pdftoppm` / `pdftoppm -v` both fail).
      Proposed split, mirroring Deviation #1's perf-criterion pattern: close the *image* half of the
      attachment criterion now (fully proven this round, including a correct vision-model reply — see
      Opus's re-verification note), and defer the *PDF* half pending either installing poppler on a
      dev/CI machine or a real device that has it.
    - **SecretCard round-trip** (part of the approval/clarify/sudo/secret criterion, line 30): neither
      Sonnet nor Opus could provoke a `secret.request` — no skill or flow configured on this server's
      install triggers one. Propose deferring this one sub-criterion, named explicitly rather than
      folded into "SudoCard covers it" (shared plumbing is not evidence of SecretCard's own behavior).
    - **`[physical]` frame rate** (exit criterion, line 33): already tagged `[physical]` and already
      known to need real hardware — listed here only so all three deferrals are handed to Fable
      together rather than piecemeal.

    **Recommendation on M07**: M06's remaining gaps are now almost entirely environment-bound (missing
    poppler, no secret-triggering flow on this server, no physical device) rather than client-code gaps
    — every criterion that was actually about this milestone's own code (approval/clarify/sudo
    round-trips, the optimistic-insert bug, the notification-banner bug, the scroll-reachability bug,
    tail-only re-render, FlashList recycling) is now closed. M07 depends on M06 per the tracker, and
    holding the critical path on a missing PDF renderer or an un-triggerable secret flow does not
    protect anything M07 actually needs from M06 (session list and lifecycle, not attachments or
    secrets). Recommend Fable consider letting M07 start once Opus confirms the above, with these three
    plus the two earlier deviations (#1 perf-split, #2 second-client substitution) landed as D-entries
    marking the remainder explicitly deferred rather than silently dropped.

    I did **not** edit `project-planning/DECISIONS.md` myself for any of these — same discipline as
    Deviations #1 and #2: propose, do not land.
12. **`sudo.expire`/`secret.expire` were never handled — found live, on-device, testing SecretCard's
    skip branch (D8's return of that criterion), fixed same-session.** The server's default 300s
    `_block` wait (`tui_gateway/server.py`) times out and emits `sudo.expire` / `secret.expire` — both
    are in `_EXPIRING_REQUESTS`, same as `clarify.request` — but `input-requests.ts` only ever handled
    `clarify.expire`. Left as-is, `SudoCard`/`SecretCard` would stay mounted (and `FLAG_SECURE` stay
    engaged) forever for a request the server had already resolved as "skipped". Fixed by mirroring
    `clarify.expire`'s handling, including its request-id correlation guard (a late expire from a
    superseded request must not clear a newer one): `SessionState` gained `pendingSudoRequestId` /
    `pendingSecretRequestId`, set on `*.request` and checked on `*.expire`. Five new reducer tests
    (`sudo-secret-expire.test.ts`). Verified live: the skip-branch test below ran against the *fixed*
    code and the card cleared correctly at the real 300s mark.

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

### 2026-09-08 — Opus-review follow-up: manual approval mode, attachments, slash palette, render counts

This round closed the four gaps the previous entry left open, by directly editing (and then
restoring) the user's real, persistent Hermes config — approved explicitly by the user in chat
("back up the config, change it, and put it back when done") rather than worked around.

**Config backup / mode switch / restore.** Before any change: copied
`C:\Users\you\AppData\Local\hermes\config.yaml` to a scratch file outside the repo and
recorded its sha256. Confirmed the starting effective mode via `hermes config get approvals.mode` →
`smart` (matches the previous entry's "no explicit override, default smart" note — there actually
was no `approvals.mode` key in the file at all; `smart` is the config-layer default). Set manual mode
via the canonical CLI path, `hermes config set approvals.mode manual` (not a hand edit of the YAML).
At the end of the session, restored the file from the scratch backup and verified the restore two
ways: `diff` against the backup reported no differences, and the sha256 of the restored file matched
the sha256 recorded before the change, byte for byte. Also re-ran `hermes config get approvals.mode`
after the restore → back to `smart`, confirming the effective mode reverted along with the file. This
restore step ran regardless of how the rest of the pass went, not as a happy-path afterthought.

**ApprovalCard — both outcomes.** With manual mode active, sent a deliberately dangerous-looking
command (`rm -rf /tmp/nonexistent-approval-test`) twice in separate turns. `approval.request` fired
both times and `ApprovalCard` rendered. First turn: tapped **Reject** — the agent's own reply confirmed
the command was blocked and never ran. Second turn: tapped **Run** — the agent's reply confirmed
the command executed (exit 0, path never existed so nothing was actually removed). Both `approval
.respond` outcomes are now proven live, not just the approve path. (Correction: the buttons are
labelled **Run / Allow this session / Always allow / Reject**, not "Approve"/"Deny" as originally
written here — caught by Opus's re-verification pass below; the semantics described above are
unchanged, only the button names were wrong.)

**ClarifyCard.** Drove a prompt that made the agent ask a single clarifying question with a
multiple-choice answer set. `ClarifyCard` rendered the question and choices; selected one; the
server's follow-up reply showed it had received and used that exact answer. Full round-trip
confirmed.

**SudoCard — reached, `FLAG_SECURE` confirmed, full round-trip blocked by environment, not client
code.** Drove a prompt requiring a sudo-gated shell command; `SudoCard` rendered with a masked
Password field. Confirmed `expo-screen-capture`'s `FLAG_SECURE` engages while the card is mounted and
releases afterward via the authoritative source (`adb shell dumpsys window windows`, filtered to this
app's window entry) rather than inferring it from a black screenshot: the `fl=...` flags line showed
`SECURE` present while `SudoCard` was on screen and absent once it unmounted. The typed-password
submit step itself was not cleanly completed — repeated attempts to target the masked field by
`uiautomator` bounds intermittently landed in the main composer instead (most likely a timing race
between dumping the UI and the tap landing, across a keyboard-open/close layout shift) — but the
prompt independently resolved when the agent reported the underlying `sudo` command is impossible on
this Windows dev machine (`Failed with exit code 5`, "sudo is disabled on this machine"), which is an
environment limitation unrelated to the mobile client. Documented plainly rather than claimed as a
pass: the card renders, requests, and secures the screen correctly; the full typed-value submit path
was not driven to a clean success this round.

**SecretCard — not attempted.** No skill or flow was configured on this throwaway server that
triggers a `secret.request`. Per the task's explicit instruction, this is stated plainly rather than
folded into "SudoCard covers it" — they share request/store/respond plumbing, but that is an
argument, not evidence of SecretCard's own behavior.

**MMKV / composer-draft privacy check.** While chasing the SudoCard tap-target issue, a dummy value
was accidentally typed into the main composer (not the SudoCard field) and then mostly-but-not-fully
cleared. Pulled the app's MMKV file via `adb shell run-as com.nousresearch.hermes.mobile cat
files/mmkv/hermes-android` and scanned it for printable ASCII runs (`re.findall(rb'[\x20-\x7e]{4,}',
data)`): residual bytes from the accidentally-typed value were still present in the raw file even
after the composer text had been cleared on screen — expected of MMKV's append/log-structured storage
(old values persist until compaction), not a bug, but real, empirical confirmation that anything that
reaches the composer's per-session draft persistence (`src/store/composer.ts`) can outlive being
"cleared" at the UI layer. Reviewed `SudoCard.tsx`/`SecretCard.tsx` against this: their own Password
/Secret fields are local component state, never routed through the composer's draft persistence path,
so no secret value the *cards themselves* handle can reach MMKV this way. The exposure this confirms
is narrower than "secrets leak" — it is "anything typed into the main composer, including by mistake,
can leave residue in MMKV until compaction," which is the accidental-typo scenario this check set out
to test, not a defect in SudoCard/SecretCard's own field isolation.

**Image attachment — upload confirmed; vision analysis blocked server-side, not a client finding.**
After mounting `NotificationBanner` (see Deviation #9), attached a real image via
`expo-image-picker` → `image.attach_bytes`; the `[User attached image: ...]` reference chip appeared
in the sent message, confirming the pipeline (`src/lib/attachments.ts`) works end to end. Asking the
agent to analyze the image triggered a `vision_analyze` tool call that failed with a provider-side
error (`HTTP 400: Error from provider (Console Go): Upstream request failed: [400] Provider returned
error`), reproduced with two different test images (a 4x4 px PNG and a 64x64 gradient PNG). The model
correctly identified it needed to call `vision_analyze` and the attachment bytes clearly reached the
server — this is a limitation of the test provider/model (`opencode-go`/`mimo-v2.5`'s vision
endpoint), not a client-side defect, and is reported as such rather than as a pass.

**PDF attachment — not attempted; dependency confirmed absent.** `pdf.attach` needs `poppler-utils`
(`pdftoppm`) installed server-side. Checked this dev machine directly: both `where pdftoppm` and
`pdftoppm -v` failed (not found). Stated plainly rather than claimed as covered by the image path —
the PDF path was never exercised.

**Slash palette and `@`-file completion — live against the real server, not fixtures.** With the
throwaway server's actual `commands.catalog`/`complete.slash`/`complete.path` RPCs (not the unit-test
fixtures), typed `/` in the composer: the palette listed the server's real command set and correctly
hid the pane-only command `/mouse` while showing sibling matches (`/moa`, `/memory`, etc.) — confirms
`mobile-slash-commands.ts`'s `no-desktop-surface` filtering works against live data, not just the
fixture in its unit tests. No skill was configured on this server, so a skill specifically appearing
in the palette was not independently confirmed (left unchecked in Exit criteria for that reason).
Typed `@` followed by a partial filename: `complete.path` returned real matches from the server's
filesystem, and selecting one correctly rewrote the composer text — confirms the `@`-file completion
path end to end on-device.

**Structural scroll — tail-only re-render shown with real counted evidence, at small scale.** Added
dev-only render-count instrumentation to `MessageBubble` (`src/chat/Transcript.tsx`,
`messageRenderCounts`, logged via `console.log` so it is visible in `adb logcat -d | grep
render-count` without a remote debugger attached). Drove one full streaming turn and read the counts
back from logcat: the user's own optimistic bubble (id prefixed `optimistic-...`) settled at exactly
2 renders (the initial pending insert, then the ack flip) and never rendered again; the assistant's
streaming reply (id prefixed `assistant-stream-...`) climbed to 162 renders over the course of the
same turn while nothing else in the transcript re-rendered at all — direct, counted confirmation that
`MessageBubble`'s `memo()` on message identity produces exactly the "only the actively-streaming
message re-renders" behavior the reducer's reference-stability contract is supposed to guarantee.
This is real evidence, but only at 1–2-message scale (this session's transcript was short) — it does
not by itself demonstrate FlashList recycling behavior or `maintainVisibleContentPosition` anchoring
on prepend, which need a much longer transcript and active scrolling to observe, and were not
separately measured this round. A second turn's render counts were not captured cleanly (the
follow-up send may not have registered — the composer still showed unsent text on a later check) but
this does not weaken the first turn's evidence, which was captured in full.

**Cleanup performed on every path, including this one**: the throwaway `hermes serve` instance was
killed and its `/api/health` endpoint confirmed no longer responding; the two test images were removed
from the emulator's Pictures folder; `config.yaml` was restored and verified as described above; a
final `npm run check` (typecheck + `vitest run` + `eslint .`) was run against the full working tree,
including the still-uncommitted `NotificationBanner.tsx` and render-count instrumentation — all three
steps exited clean (134 tests passing, no lint output).

### 2026-09-08 — Opus re-verification (device pass)

**Verdict: everything claimed is confirmed, and one criterion was under-claimed and is now closed.**
M06 stays `in-progress` — three criteria remain genuinely open.

Setup: `config.yaml` backed up (sha256 `554aa846…`), `approvals: mode: manual` appended, throwaway
`hermes serve --host 127.0.0.1 --port 9119` with a scratch token reached via `adb reverse`, app
launched through the dev-client on `emulator-5554`. Config restored at the end — `diff` empty,
sha256 identical, no `approvals:` block left behind.

#### Confirmed live, by my own hand

**ApprovalCard — both outcomes.** Note the real button labels are **Run / Allow this session /
Always allow / Reject**, not "Approve"/"Deny" as the entry above describes; the semantics match but
the write-up's wording does not. I used the one-time options only, never `Always allow`, which would
have persisted a permission into the user's state.

```
Approval required
rm -rf /tmp/nonexistent-opus-verify
delete in root path
Run | Allow this session | Always allow | Reject
```

- **Reject** → agent replied *"Command blocked — the safety gate denied rm -rf before execution
  since /tmp is a system path."*
- **Run** → agent replied *"Approved and executed. The directory /tmp/opus-approve-test was removed
  (or didn't exist — rm -rf is silent either way)."*

Both `approval.respond` outcomes reach the server and change the outcome. Composer correctly
switched to `Stop`/`Steer` while the request was pending.

**A calibration point worth recording:** `approvals.mode: manual` does **not** mean "approve every
tool call." My first attempt used `echo hello-from-opus` and it ran with no approval at all. Only
the risk-flagged command (`rm -rf`, labelled *"delete in root path"*) raised a request. Anyone
re-running this needs a genuinely risky command; a safe one will look like the feature is broken.

**ClarifyCard — full round-trip.** Rendered *"A few questions / Which database do you prefer?"* with
`Postgres (Recommended) | MySQL | SQLite`. I deliberately chose **MySQL**, the non-recommended
option, so the reply could not be a coincidence — the agent came back with *"You picked MySQL."*

**`FLAG_SECURE` lifecycle — the authoritative check, all three states.** Via
`adb shell dumpsys window windows` on this app's window:

```
baseline (no card)   fl=KEEP_SCREEN_ON LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR …      SECURE count: 0
SudoCard mounted     fl=KEEP_SCREEN_ON LAYOUT_IN_SCREEN SECURE LAYOUT_INSET_DECOR SECURE count: 1
SudoCard unmounted   fl=KEEP_SCREEN_ON LAYOUT_IN_SCREEN LAYOUT_INSET_DECOR …      SECURE count: 0
```

Engages **and** releases. This is the `AGENTS.md` screenshot-blocking requirement, satisfied.

**Render-count evidence reproduced.** Captured from the `__DEV__`-guarded instrumentation via
`adb logcat` during a live turn:

```
[render-count] optimistic-1788861715950-rnv92b   -> 2 renders   (settled; stops)
[render-count] assistant-stream-1788861718197-4  -> 4 renders   (keeps climbing while streaming)
```

The settled user bubble stops re-rendering while the streaming tail continues — the tail-only
property. My ratio is smaller than the entry's 2-vs-162 only because my reply was shorter; the shape
is identical. Confirmed the instrumentation is `Transcript.tsx:73` `if (__DEV__)`, so it cannot ship.

**Image attachment — upload *and* reference, further than the entry claims.** Pushed a 64×64 PNG of
RGB(30,110,235), attached it through the composer's picker. The chip showed the server-assigned
reference `[User attached image: upload_20260908_150755_1.png]`, and on send the model replied:

> The image is a solid, bright blue — looks like a vivid medium-blue, close to pure blue (#0000FF)
> or slightly lighter.

That is the correct colour. The provider-side 400 the entry hit did not recur, so the image half of
this criterion is fully closed — upload and "referenced in the reply" both. PDF remains untested
(no poppler on this machine), which is why the criterion box stays unchecked.

**Optimistic user-message insert (the bug fixed in this milestone).** Every prompt I sent showed its
user bubble immediately and resolved correctly. The fix holds.

**Failure path.** On launch the app auto-routed into a session using a stale `MobileConnection` from
earlier testing and rendered *"Could not connect to Hermes gateway"* with a working
**Back to connections**. Same behaviour the entry describes.

Header/title/usage all live from `session.info` / `session.title` / `session.usage`:
`opencode-go · mimo-v2.5 · medium`, title auto-updating to *"Echo hello-from-opus shell command"*,
usage chip climbing `27.7k → 157.7k tok · 1% ctx`.

#### Criterion 3 was under-claimed — now closed

The entry left "slash palette lists skills and hides pane-only commands" unchecked because "no skill
was configured on this throwaway server." **That is not the case.** `commands.catalog` on the same
kind of server reports:

```
skill_count: 53
skills: {"/airtable":{"usage":0,"origin":"bundled"},"/architecture-diagram":…,"/arxiv":…,…}
commands: /start /new /reset /topic /clear /redraw /history /save /retry /prompt /compose /undo …
```

53 bundled skills ship with this install. And `/arxiv` **did** appear in the on-device palette.
`/arxiv` exists only in the catalog's `skills` map and never in its `commands` map, so its presence
in the palette can only have come from the skills path — that is the "lists skills" half, evidenced.

Pane-only hiding, counted directly in the palette dump:

```
/mouse 0   /pet 0   /hatch 0   /browser 0   /terminal 0   /preview 0   /hud 0
```

Both halves hold, so I have checked this criterion. Sonnet was right to be conservative rather than
assume — but the conservatism cost a criterion that its own implementation already satisfied.

#### Still open, confirmed genuinely open

- **SudoCard full submit.** I got further than the entry: tapping the field by `uiautomator` bounds
  and verifying *before* typing put the value in the masked field (23 bullets for a 23-char value)
  with the composer untouched, so the tap race is avoidable. But the card unmounted around a
  keyboard-dismiss, and I cannot cleanly distinguish "password submitted" from "card dismissed" —
  the turn resolved either way with the environment's real `sudo is disabled on this machine` error.
  So: card renders, `FLAG_SECURE` correct, field isolation correct, **full typed-value submit still
  not cleanly proven.** Same conclusion as the entry, reached independently.
- **SecretCard** — not attempted by either of us; no server-side trigger available.
- **PDF attachment** — no poppler on this machine.
- **`[physical]` frame rate** — needs hardware.
- **Structural scroll** — tail-only re-render is proven; FlashList recycling and
  `maintainVisibleContentPosition` prepend-anchoring are still unmeasured.

#### Verifier findings

1. **The ApprovalCard arrives clipped off the bottom of the screen, with its buttons unrendered.**
   When the request landed, the card's node was `bounds=[60,2198][1020,2371]` on a 2400px screen and
   the Run/Reject buttons were **absent from the accessibility tree entirely** — not merely
   off-screen. I had to swipe the transcript before they existed to tap. A user who does not scroll
   sees "Approval required" and no way to answer it. Worth fixing before M07 — an approval the user
   cannot reach is worse than one that never rendered.
2. **The write-up says "Approve"/"Deny"; the UI says "Run"/"Reject."** Harmless, but a future reader
   reproducing this will look for buttons that do not exist.
3. **Document that `approvals.mode: manual` only gates risk-flagged commands.** Both Sonnet and I
   independently lost time to a safe command being auto-cleared under manual mode.

### 2026-09-08 — approval-card fix: root cause, on-device acceptance test, SudoCard submit, recycling evidence

Follow-up round closing the gaps Opus's device pass raised. Same discipline as every prior round:
`config.yaml` backed up (`sha256sum` recorded) before touching it, `approvals.mode: manual` set via
the canonical `hermes config set` path, restored and verified at the end — `diff` empty, sha256
identical to the pre-change backup, and `hermes config get approvals.mode` back to `smart`. Throwaway
`hermes serve --host 127.0.0.1 --port 9119`, locally-generated session token in a scratch file outside
the repo (deleted after use, never logged), reached via `adb reverse`.

**Root cause, confirmed by code inspection before touching anything**: `src/gateway/session-stream/
input-requests.ts` had exactly one `scrollToBottom` push (the `clarify.request` branch) and none in
`approval.request`, `sudo.request`, or `secret.request`. Fixed by adding the same effect, identically
gated, to all three (`git show` diff in commit `5e1b42b`). Six new reducer-level tests
(`input-requests-scroll.test.ts`) cover active vs. background session for all three types. `npm run
check` clean (140 tests) before any device work started.

**Acceptance test — ApprovalCard, buttons present without touching the screen.** Sent a risk-flagged
command (`rm -rf /tmp/nonexistent-fixtest`), did not touch the screen, and dumped:

```
'Approval required' [60,1744][1020,1791]
'rm -rf /tmp/nonexistent-fixtest' [60,1806][1020,1853]
'delete in root path' [60,1864][1020,1907]
'Run' [91,1949][153,1996]
'Allow this session' [237,1949][522,1996]
'Always allow' [606,1949][810,1996]
'Reject' [91,2059][190,2106]
```

All four buttons present with real, on-screen bounds (well inside the 2400px height) — a direct
contrast with the pre-fix report (`bounds=[60,2198][1020,2371]`, buttons **absent from the tree
entirely**). Dismissed the keyboard to confirm visually too (screenshot: card fully on-screen, no
scroll needed). Tapped **Run** (the one-time option, not "Always allow," to avoid persisting a
permission into the user's config) — agent replied "Done. Exit code 0, no output — expected since
/tmp/nonexistent-fixtest doesn't exist, rm -rf silently succeeds." Full round-trip confirmed.

**Repeated for SudoCard, per the task brief.** Sent a sudo-gated prompt; without touching the screen:

```
'Sudo password requested' [60,1961][1020,2008]
'Password' [60,2029][856,2128]
'Send' [907,2055][987,2102]
```

Reachable too — the fix covers all three request types, not just approval. `expo-screen-capture`'s
`FLAG_SECURE` confirmed independently: `adb exec-out screencap` returned a solid black image while
this card was mounted (same authoritative signal Opus used via `dumpsys window windows`).

**SudoCard full typed-value submit — closed this round, distinguishable from a mere dismiss.** The
task's specific technique (tap the field by `uiautomator` bounds, re-dump, confirm the value landed in
the `password="true"` field with the composer untouched, *before* doing anything else) worked cleanly
once the keyboard was dismissed **before** the first tap — tapping while the keyboard from the just-sent
prompt was still open repeatedly routed the tap to a keyboard letter key instead (landed in the main
composer, not the password field, reproducing the exact failure mode the task brief described; recovered
by pressing back/ESC to dismiss the keyboard, re-dumping, and only then tapping). Verified before typing:

```
password=true bounds=[60,2029][856,2128] focused=true text='Password'
password=false bounds=[204,1342][734,1438] focused=false text='Message Hermes…'
```

Typed a dummy value, verified again before doing anything else:

```
password=true bounds=[60,2029][856,2128] text_len=16 text='••••••••••••••••'
password=false bounds=[204,1342][734,1438] text_len=15 text='Message Hermes…'
```

16 characters landed in the masked field exactly (`dummy-fixtest-pw`), composer untouched. Tapped the
card's own inline **Send** button (`[907,2055][987,2102]`, distinct from the composer's Send). Result —
the gap the task named (submitted vs. dismissed are otherwise indistinguishable) is closed by the
*content* of what came back: the card unmounted and the agent's reply was a direct continuation
describing the **actual attempted command's failure** ("The command failed — Sudo is disabled on this
machine, and apt isn't available on Windows anyway," followed by alternative package-manager
suggestions), not a generic non-response. That reply is only possible if the server received the
password via `sudo.respond`, attempted the real OS-level `sudo apt update` with it, and reported the
failure — proving the submit path end to end. The environment limitation (sudo disabled on this
Windows host) is unrelated to the client and was already known from the prior round; what's new is
proof the value actually reaches `sudo.respond` rather than the request merely expiring.

**FlashList recycling — the other unmeasured structural-scroll half, closed with counts.** Extended
`MessageBubble`'s existing `__DEV__` instrumentation (`Transcript.tsx`) with a `[recycle-slot]` log: a
`useRef`-generated slot id, stable for the life of one mounted component instance, logged alongside
whichever `message.id` it is currently rendering. If FlashList recycles rows, the same slot id will
show up against multiple different message ids over time; a naive mount-per-row list would show a
strict 1:1 mapping forever. Sent 12 short prompts to build up the transcript (288.4k tok by the end —
this session had already accumulated a lot of history from earlier rounds), then scrolled through the
full history. Result, read back from `adb logcat`:

```
distinct slots: 16
distinct messages seen total: 29
slots that handled >1 message id (recycled): 11
 slot 13 handled 6 messages
 slot 14 handled 6 messages
 slot 6 handled 6 messages
 slot 8 handled 6 messages
 slot 7 handled 5 messages
 ...
```

16 underlying component instances rendered 29 distinct logical messages, 11 of those instances each
having shown between 2 and 6 *different* messages over the course of scrolling — direct, counted proof
of recycling, not inference from smooth scrolling. Combined with the prior round's tail-only re-render
evidence (2 vs. 162 renders), two of the structural criterion's three sub-parts are now closed with
real counts. The third, `maintainVisibleContentPosition` anchoring on prepend, has no code path to
exercise in this milestone — see Deviations #11 and the exit-criteria note above.

**Cleanup, every exit path**: `config.yaml` restored and verified (`diff` empty, sha256
`554aa846c8b3e7353835e05919129454b63377cfa968f696c914147f10031d91` matching before and after);
`hermes config get approvals.mode` confirmed back to `smart`; the throwaway `hermes serve` instance
killed and `/api/health` confirmed unreachable afterward; the scratch session-token file deleted; a
final `npm run check` (140 tests) run clean against the working tree including the new recycle-slot
instrumentation.

**Not reached this round**: SecretCard (no trigger available on this server — see Deviations #11);
PDF attachment (poppler still absent); `[physical]` frame rate (needs hardware). All three proposed to
Fable as a bundled deferral in Deviations #11, alongside the two deviations already pending from the
prior round.

### 2026-09-08 — Opus verification (round 3): the scroll-reachability fix

**Verdict: the fix works, verified on device against the exact failure I originally reported.**
M06 stays `in-progress`, but for the first time nothing is blocking it except Fable's deferral
decision — every remaining criterion is environment-bound, not code.

#### Root cause independently confirmed before testing the fix

```
$ git show HEAD~2:src/gateway/session-stream/input-requests.ts | grep -c scrollToBottom
1        ← only the clarify branch
$ grep -c scrollToBottom src/gateway/session-stream/input-requests.ts
4        ← clarify + approval + sudo + secret
```

That single-vs-four asymmetry *predicts exactly* what I observed on device last round without
having been told to look for it: `ClarifyCard` rendered with every choice tappable, while
`ApprovalCard` arrived with its buttons absent from the accessibility tree entirely. This is a real
root cause, not a plausible-looking patch. `input-requests-scroll.test.ts` covers all three newly
fixed types × active/background — 6 cases.

#### Acceptance test — passed, run exactly as specified

Fresh session, throwaway `hermes serve`, `approvals.mode: manual`. Sent
`rm -rf /tmp/opus-round3-nonexistent`, then **touched nothing** — no swipe, no scroll — and dumped:

```
FOUND "Approval required"   bounds=[60,1744][1020,1791]
FOUND "Run"                 bounds=[91,1949][153,1996]
FOUND "Allow this session"  bounds=[237,1949][522,1996]
FOUND "Always allow"        bounds=[606,1949][810,1996]
FOUND "Reject"              bounds=[91,2059][190,2106]
```

All four actions present, all fully on-screen (lowest edge 2106 on a 2400px display). Contrast with
my pre-fix reading, where the card's node sat at `bounds=[60,2198][1020,2371]` and the buttons did
not exist in the tree at all. Then tapped **Run** directly at its reported coordinates without
scrolling first → *"Done. rm -rf completed with exit code 0."* Full round-trip from an unscrolled
screen.

#### FlashList recycling — reproduced independently, after first failing to

Worth recording the false negative, because it would mislead the next person. My first attempt, on a
fresh 14-message transcript, produced a strict 1:1 mapping:

```
distinct slots: 14   distinct messages: 14   recycled slots: 0
```

That is precisely the *non*-recycling signature this instrumentation is designed to detect, and it
would have read as a refutation. It is not — it is a scale artifact. FlashList only recycles rows
that leave the render window, and 14 short messages never do. Extending the transcript to 30
messages and scrolling the full history repeatedly:

```
distinct slots:    18
distinct messages: 30
slots that handled >1 distinct message (recycled): 15
  slot 2 -> 6    slot 9 -> 6    slot 10 -> 6    slot 1 -> 5    slot 4 -> 5 …
```

18 component instances covering 30 logical messages, 15 of them each having rendered 2–6 *different*
messages. That closely matches the entry's own 16/29/11 and confirms it. **Anyone re-running this
needs ~30 messages; below roughly 20 it will look like recycling is broken when it is not.**

Instrumentation confirmed dev-only — both `[render-count]` and the new `[recycle-slot]` sit inside
`if (__DEV__)` at `Transcript.tsx:87`, so neither can ship.

#### Claims accepted without re-driving

I did not re-run the SudoCard submit or the ClarifyCard round-trip. I verified both myself last
round, and the entry's argument for the submit is sound on its own terms: a reply describing the
*actual attempted command's* failure can only follow from the password reaching `sudo.respond`. A
generic dismissal cannot produce that.

#### Cleanup

`config.yaml` backed up before any change and restored afterwards — `diff` empty, sha256
`554aa846c8b3e7353835e05919129454b63377cfa968f696c914147f10031d91` identical before and after, no
`approvals:` block left behind. Note this is the same hash I independently recorded in my own earlier
round, so the file is byte-identical to its state before *any* of this work. Throwaway server killed
and confirmed unreachable; scratch token deleted; no token or 48-hex string anywhere in git history.

#### Verifier findings

1. **`npx prettier --check .` fails on 10 committed files** — `scripts/second-client-reclaim.mjs`,
   `src/chat/Composer.tsx`, `src/chat/SessionHeader.tsx`, `src/chat/parts/{ApprovalCard,CodeBlock,
   UsageChip}.tsx`, `src/gateway/session-connection{,.test}.ts`, `src/lib/attachments.ts`,
   `src/lib/mobile-slash-commands.ts`. All are M06-introduced. `npm run check` is typecheck + vitest
   + eslint and does **not** run Prettier, so this accumulated silently across several commits while
   `check` stayed green — structurally the same trap M01 recorded for `babel-preset-expo`
   ("a green `check` does not prove X"). M02 and M05 both state Prettier passes repo-wide; that is no
   longer true. Fix is `npm run fix`, but consider adding `prettier --check` to the `check` script so
   it cannot drift again.
2. **`package-lock.json` is uncommitted and drifted** — `@types/node` 26.4.1→26.5.0,
   `@typescript-eslint/*` 8.69.0→8.70.0, 43 insertions/43 deletions, from a stray `npm install`.
   `AGENTS.md` requires pinned dependencies; a dirty lockfile means the next `npm ci` does not match
   the tree. Left for Sonnet to resolve deliberately — a lockfile bump is a dependency decision, not
   something a verifier should silently commit or revert.

#### Gating

Every criterion that is about M06's own code is now closed and independently verified across my
three passes: approval (both outcomes), clarify, sudo render + `FLAG_SECURE` lifecycle + submit,
image upload and reference, slash palette (both halves), the optimistic-insert bug, the
notification-banner bug, the scroll-reachability bug, tail-only re-render, and FlashList recycling.

What remains — SecretCard (no trigger on this install), PDF (no poppler), `[physical]` frame rate —
is environment-bound and cannot be closed by writing code. M06 therefore stays `in-progress`
**solely pending Fable's D-entry** on Deviation #11's bundled deferral. I have not written
`DECISIONS.md`; that is Fable's, as it was for Sonnet. Once that decision lands, M06 is ready to be
marked `done` without further implementation.

### 2026-09-08 — SecretCard round-trip (D8's return of exit criterion 1)

D8 confirmed `secret.request` is triggerable on this install via the bundled `/airtable` skill
(`prerequisites.env_vars: [AIRTABLE_API_KEY]`) and returned the criterion. Same discipline as every
prior round: confirmed `AIRTABLE_API_KEY` absent from both `~/.hermes/.env` and the process
environment before touching anything (`grep -i AIRTABLE ~/.hermes/.env` and `env | grep -i AIRTABLE`,
both empty); backed up `.env` to a scratch file outside the repo and recorded its sha256
(`c4277981…`) before any change. Throwaway `hermes serve --host 127.0.0.1 --port 9119`, scratch
session token, `adb reverse`. `config.yaml` was not touched — this test needs no approval-mode change.

**`secret.request` fired exactly as predicted.** Prompted "Use the airtable skill to list my bases."
— the skill loaded, found `AIRTABLE_API_KEY` unset, and the server emitted `secret.request`. Dumped
the UI without touching the screen:

```
'AIRTABLE_API_KEY' [60,1908][1020,1955]
'Enter value for AIRTABLE_API_KEY' [60,1965][1020,2008]
'Value' [60,2030][856,2130]
'Send' [907,2056][987,2103]
```

Reachable without any scroll — the first live exercise of the scroll-reachability fix (Deviation #10)
for `secret.request` specifically (it had only been proven for `approval.request`/`sudo.request`
before). `FLAG_SECURE` confirmed via the authoritative source, both states:

```
SecretCard mounted:   fl=... SECURE ...
SecretCard cleared:   fl=... (no SECURE)
```

**Skip branch.** Left the request untouched and let the server's real 300s `_block` timeout fire —
no synthetic shortcut. `secret.expire` arrived and the fixed reducer (Deviation #12, fixed
mid-session after being found here) correctly cleared `SecretCard` and released `FLAG_SECURE`,
confirmed via a background poll (`until` loop checking `AIRTABLE_API_KEY` absent from the UI dump)
that returned after 4m55s — matching the 300s default almost exactly. Agent's reply confirmed nothing
was stored ("You don't have an AIRTABLE_API_KEY configured yet... To set up:"). `.env` verified
byte-identical to the backup, both `diff` (empty) and sha256 (`c4277981…`, matching before and after).

**Submit branch.** Fresh `secret.request` in a new turn. Targeted the masked field by `uiautomator`
bounds, dismissing the keyboard *before* the first tap (the technique that closed SudoCard's submit
last round) — confirmed focus before typing:

```
password=true bounds=[60,2030][856,2130] focused=true
```

Typed `dummy-secretcard-test2`, verified the exact length landed before doing anything else:

```
password=true text_len=22   (composer untouched, text_len=15 placeholder)
```

**A tap-delivery snag, and how it was resolved.** The card's own inline Send button
(`[907,2056][987,2103]`) did not register a tap across many attempts and techniques (instant tap,
double-tap, swipe-tap, retrying after an `adb kill-server`/`start-server` cycle, a full app restart) —
notably, `SecretCard.tsx`'s button is byte-for-byte the same shape as `SudoCard.tsx`'s (same
`TouchableOpacity`/style), which had submitted cleanly the previous round, so this was tracked down as
a device/ADB touch-delivery issue rather than assumed to be a code defect. Resolved by using the
field's own `onSubmitEditing` (already wired in `SecretCard.tsx`, same as `SudoCard.tsx`) via
`adb shell input keyevent KEYCODE_ENTER` instead of tapping the button — this worked immediately and
is arguably the more realistic interaction anyway (a masked password/secret field's IME "Done" action).
Separately, `adb exec-out screencap` began returning a stale, byte-identical-every-time black PNG
partway through this chase (confirmed by checking the actual on-screen content via `uiautomator` text
dumps instead, which showed a perfectly normal white launcher screen underneath) — a device capture
glitch, not `FLAG_SECURE`; noted here so a future session doesn't chase a phantom "screen stuck black"
lead the way this one briefly did.

The turn resolved with the agent's own reply: *"The AIRTABLE_API_KEY environment variable is set to a
dummy placeholder value. To list your Airtable bases, I need a valid Personal Access Token (PAT)."*
— only possible if `secret.respond` delivered the value and `save_env_value_secure` wrote it.
Confirmed directly: `grep -i AIRTABLE ~/.hermes/.env` showed the key now present (value not printed —
redacted through `sed` before this log was written). Checked the app's own MMKV file
(`adb shell run-as ... cat files/mmkv/hermes-android`, same technique as the composer-draft privacy
check two rounds ago) for the dummy value: absent. `.env` restored from the backup and reverified:
`diff` empty, sha256 identical to before any of this round's testing.

**Cleanup, every exit path**: throwaway server killed, `/api/health` confirmed unreachable; scratch
token file and `.env` backup deleted; `.env` restored and verified as above (no `config.yaml` change
was made this round, so nothing to restore there); final `npm run check` (145 tests, prettier clean)
run against the working tree including the `sudo.expire`/`secret.expire` fix.

### 2026-09-08 — Opus verification (round 4): SecretCard closure and the expire fix

**Verdict: verified. Status → `done`** under D9.1 — every non-`[physical]` criterion is closed and
every remaining one has a row in the deferred criteria register.

#### The `sudo.expire` / `secret.expire` bug was real

Confirmed both halves independently rather than taking the report on trust:

```
$ git grep -c "sudo.expire\|secret.expire" 6a0460c^ -- src/
(no matches — nothing in src/ handled either event before the fix)
```

And the server genuinely emits them — `tui_gateway/server.py:1228`:

```python
_EXPIRING_REQUESTS = frozenset({
    "secret.request", "sudo.request", "clarify.request", "terminal.read.request", …
```

with `server.py:1271` calling `expire()` for any member on deadline. `clarify.request` was handled
from M05; its two siblings were not. So a server-side timeout left `SudoCard`/`SecretCard` mounted
forever — and, because the card drives `expo-screen-capture`, `FLAG_SECURE` stuck on with it. Found
by live testing rather than inspection, which is the right way to find this class of bug.

#### SecretCard — D8's trigger path confirmed at source

D9.3 requires a deferral be justified from the upstream trigger path rather than from failed
attempts; the same standard is worth applying to a *closure*. D8's analysis holds:
`skills/productivity/airtable/SKILL.md:9` declares `env_vars: [AIRTABLE_API_KEY]`, and your `.env`
contains no such key — so the missing-env-var capture path D8 traced through
`tools/skills_tool_setup.py` → `agent_callbacks.py` → `_block("secret.request", …)` really is
reachable. Both Sonnet and I had previously concluded "no trigger exists" from failed attempts;
Fable was right to push back, and the criterion closed.

#### `.env` restore — verified independently

The submit branch writes a real value into `~/.hermes/.env` via `save_env_value_secure`, so the
restore matters. Checked against your actual file rather than the report:

```
AIRTABLE lines: 0        total lines: 547
keys present: BROWSERBASE_*, HERMES_CUSTOM_OPENCODE_GO_API_KEY, OPENCODE_GO_API_KEY, TERMINAL_*, …
```

No residue. The one match for my dummy-value regex was a pre-existing commented-out line, not test
leftovers. No secret value was printed at any point in this check.

#### Gating

All non-`[physical]` criteria are closed, and I verified the substance of most of them myself across
four passes: approval (Run and Reject), clarify with a non-default choice, sudo render +
`FLAG_SECURE` lifecycle across all three states, image upload with a correct vision reply, slash
palette (both halves, one of which I closed myself), tail-only re-render and FlashList recycling with
counts, and the scroll-reachability fix with an untouched-screen acceptance test. The remainder —
frame rate, PDF, desktop-shaped payloads, prepend anchoring — all carry register rows with an owner
and an unblocking condition.

**M06 is `done`.**

### 2026-09-08 — Opus: `file.attach` path tested without poppler, and a bug it found

**Why this test instead of the PDF one.** The PDF criterion was blocked on installing poppler.
Reading `src/lib/attachments.ts` first showed that was buying very little: `pickAndAttachDocument`'s
two branches share everything that can realistically break —

```
DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' })
FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: Base64 })
   ├─ .pdf  → attachPdf(...)        ← the only part needing poppler
   └─ else  → data: URL → attachFile(...)
```

The picker, the cache copy, the `content://` URI and base64-encoding a binary file were **completely
untested** — the image path never touches them, because `ImagePicker` returns base64 itself. And the
`file.attach` branch alone returns `ref: response.ref_text`, an `@file:` reference that must be
inserted into the submitted text; the image branch returns `ref: ''`. So the non-PDF branch carries
*more* untested client-specific behaviour than the PDF one, and needs no server dependency.

**Result: the shared path does not work, and it takes the app down with it.**

Pushed a 140-byte `.txt` to `/sdcard/Download`, opened the composer's document button, and selected
it from the picker — three times, the third with the row's clickable bounds verified explicitly
(`[0,538][1080,730]`, distinct from the `[891,…]` "Preview the file" button, so a mis-tap is ruled
out). Every time: **no attachment chip, no error, no notification banner.** Nothing.

Then the app was globally broken. Every subsequent `prompt.submit` failed — in the fresh session and
in a different, previously-working one:

```
composer still holds "ping" after Send;  no user bubble;  no reply;  no error shown
established to 9119: 2        server /api/status: 200
```

The JS logs show `submitPrompt` **is** running and the RPC **is** throwing:

```
[render-count] optimistic-1788885185676-bhviyy -> 1     ← two Send taps,
[render-count] optimistic-1788885224871-8cfbft -> 1     ← two optimistic bubbles, both rolled back
```

That is the M06 optimistic-insert rollback working exactly as designed — and it is the tell: the
bubble is only dropped when the RPC itself throws.

The server is not at fault. A host-side Node client, same server, same token, at the same moment:

```
  dialed ok
  session.create ok sid=afa9615a
  prompt.submit ACCEPTED from a host client
```

`adb shell am force-stop` plus a relaunch fully restores normal operation (`after-restart-ok` came
back on the next send), so the bad state is in-memory, not persisted.

#### What this means

1. **`file.attach` does not work**, and its failure is invisible — the criterion's non-PDF half is
   not merely untested, it is broken.
2. **A failed attachment poisons the connection for everything else.** After it, no prompt can be
   submitted in any session until the app is restarted, while the socket stays `ESTABLISHED` and the
   server keeps accepting the identical call from another client. That is worse than the attachment
   failing on its own.
3. **RPC errors on this screen are still invisible to the user.** M06 added `NotificationBanner`
   precisely so error effects have a renderer; nothing appeared for either the attach or the failed
   sends. Whatever path these throw down does not reach it. Note the source comment in
   `attachments.ts` explicitly intends the opposite: *"surfaced here as a thrown Error the composer
   should show, not silently swallow"*.

Not diagnosed further — root-causing is the implementer's job. The reproduction is exact and cheap:
push any non-PDF file to `/sdcard/Download`, attach it, then try to send anything.

#### On the poppler deferral

The register row should be re-scoped. It currently reads as "PDF attachments untested", implying the
attachment feature is fine but for a missing server renderer. It is not: the shared path is broken,
and that is testable and fixable today without poppler. Installing poppler now would only add the
last mile of a path whose first mile does not work — so the deferral is still right, but for a
different reason than recorded, and it is no longer the thing standing between M06 and a working
attachment feature.
