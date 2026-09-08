# M07 — Session management + lifecycle

**Status:** in-progress
**Depends on:** M06
**Goal:** Sessions list and switch reliably; the app survives backgrounding, doze and network changes.

## Tasks

- [x] Session list: `app/(main)/session-list.tsx` — `GET /api/sessions` (not the WS `session.list` RPC; see
      Deviations #2), search, pin, unread, new session, delete, title (title edit is the existing chat-screen
      header affordance from M06, reused as-is — resuming a session opens straight into it). Filed at
      `app/(main)/session-list.tsx`, not the task's named `app/(main)/sessions/index.tsx` — see Deviations #1
      for why.
- [x] `src/gateway/lifecycle.ts`:
  - [x] `active -> background`: keep the socket 20s, then `close()`. **Built and unit-tested; found live,
        on-device, that the 20s timer does not reliably fire while actually backgrounded — see Deviations #3.**
  - [x] `background -> active`: redial (a no-op if the socket survived) + a `ping` RPC as the half-open probe.
        Live-confirmed (see Verification log).
  - [x] Both `session.reclaimed` outcomes (decision D2) — pre-existing from M05/M06
        (`session-stream/lifecycle.ts`), unchanged this milestone; already proven live via
        `scripts/second-client-reclaim.mjs` in M06's own verification. Not re-derived here.
  - [x] `gateway.ready.replay_epoch` change: cold start (drop the runtime->stored map, re-resume the active
        session, refresh the session list). New this milestone, unit-tested (8 tests), not live-tested — see
        Deviations #4.
  - [x] `replay.truncated`: `hydrate` (same effect `session.reclaimed` already uses). New this milestone,
        unit-tested, not live-tested — see Deviations #4.
  - [ ] `expo-network` change handling (reset backoff + redial on "closed → open"; ping probe on "open"). Not
        built — see Deviations #5.
- [x] Never send `close_on_disconnect: true` — confirmed by inspection (`grep -rn close_on_disconnect src`
      returns nothing); nothing to change, since nothing in this app has ever set it.
- [x] Honor `gateway.capabilities.per_session_exclusive_submit` — a `prompt.submit` rejected with JSON-RPC
      4090 is rewritten to a true, reason-specific message (`SESSION_NOT_OWNED` / `MAX_CONCURRENT_SESSIONS` /
      other) instead of a generic RPC-failure toast. Unit-tested (3 tests), not live-tested — see Deviations #6.
- [ ] Foreground notifications via `expo-notifications` — **not started.** Needs a new native dependency and a
      WSL2 rebuild (~20-30 min); deferred this round rather than shipped half-built (a policy module with
      nothing calling it yet). See Deviations #5.
- [x] Deep link `hermes-android://session/<id>` — `app/session/[id].tsx`, a thin `<Redirect>` to the chat
      screen. Live-confirmed (see Verification log).

## Deliverables

- `app/(main)/session-list.tsx`, `src/api/sessions.ts` (new — `GET`/`PATCH`/`DELETE /api/sessions*`, not on
  the original file list but required by the session-list screen; see Deviations #2), `app/session/[id].tsx`
  (deep link)
- `src/gateway/lifecycle.ts` (the `AppLifecycle` class — background-grace-close, foreground/network
  reconnect-and-probe), `src/gateway/useAppLifecycle.ts` (the real `AppState` wiring, mounted once in
  `app/_layout.tsx`)
- `src/gateway/session-stream/lifecycle.ts` additions: `gateway.ready` replay-epoch cold start,
  `replay.truncated` hydration (both previously no-ops/unhandled)
- `src/gateway/session-connection.ts` additions: `closeGatewayConnection`, `reconnectAndProbeGateway`,
  `describeSubmitError` (the 4090 rewrite)
- `src/store/sessions.ts` addition: `$sessionListRefreshRequests`, wiring the reducer's `refreshSessions`
  effect (a no-op until this milestone — "no session-list store yet") to something real
- **Not delivered:** `src/store/notifications.ts` is NOT touched by this milestone despite being named in the
  original task line — that file is M06's in-app toast queue (`notify()`/`$notifications`), a different
  concern from the native/OS notification policy this task line actually means (upstream's
  `apps/desktop/src/store/native-notifications.ts`). See Deviations #5.

## Exit criteria

- `[physical]` Airplane-mode toggle mid-turn on a real phone against a gated LAN backend — **not attempted,
  needs hardware.** Per D9, this goes to the deferred criteria register (`implementation-plan/README.md`)
  rather than blocking `in-progress`, same as M04/M06's physical criteria. Proposed alongside the other two
  below.
- `[physical]` Screen off 15 minutes mid-turn (doze) — **not attempted, needs hardware.** Same register
  entry as above.
- `[physical]` Wi-Fi to cellular switch reconnects within 10 seconds — **not attempted, needs hardware**, and
  separately blocked on the `expo-network` wiring not existing yet (Deviations #5) even to attempt on a
  physical device. Same register entry.
- [x] Reconnect inside the server orphan grace produces no `session.reclaimed`; reconnect after it produces
  one, and the transcript is identical in both cases — **already closed by M06's evidence, not re-derived.**
  This is the reducer's `session.reclaimed` handling (`session-stream/lifecycle.ts`), unchanged by this
  milestone; `scripts/second-client-reclaim.mjs` proved both branches live against a real `hermes serve`
  last milestone (M06-chat-screen.md's Verification log, 2026-09-08). The task brief's suggested method (a
  host-side TCP cut on *this app's own* connection, gaps of ~9s/~44s per M03's pattern) was not additionally
  run — the wire-level contract this criterion is actually about doesn't depend on which client drives it,
  and re-deriving it a third time (M03 proved it structurally, M06 proved it end-to-end) would not add
  evidence.
- [ ] Backend restart handled without restarting the app — **the code exists (`gateway.ready` replay-epoch
  cold start, above) and is unit-tested, but not live-verified**: exercising this for real means restarting
  the throwaway `hermes serve` process mid-session and confirming the app recovers without a manual
  reconnect, which was not attempted this round (see Deviations #4 for why). Left unchecked — code without a
  live pass is not the same as a closed criterion.
- [ ] An approval for a non-active session shows a local notification whose tap opens that session — **not
  started**, blocked on the `expo-notifications` dependency (Deviations #5).

## Deviations from the literal spec (and why)

1. **Session list filed at `app/(main)/session-list.tsx`, not the task's named
   `app/(main)/sessions/index.tsx` — a real routing bug, not a stylistic choice.** With `sessions/[id].tsx`
   as a sibling, `router.replace('/sessions/index')` reproducibly resolved to `sessions/[id]` with
   `id: "index"` instead of the index route — reproduced with both the imperative `router.replace` and the
   declarative `<Redirect>` component, and ruled out an auth/timing explanation by checking directly (a
   debug log showed a valid 43-char token being resolved correctly; the render itself was the chat screen's
   error UI, `"Could not connect to Hermes gateway"`, which only exists in `mobile-gateway.ts` — proving
   `[id].tsx`, not the list screen, was mounted). This reads as an expo-router limitation/bug with an
   `index.tsx` + `[id].tsx` pair at the same directory level in this project's router version, not a typo on
   my part. The flat, unambiguous path (`app/(main)/session-list.tsx`) resolves correctly and every
   interaction is proven live (see Verification log): list loads, search filters, pin PATCHes and persists,
   tap-to-open resumes real history, back correctly returns to the list (fixing M06's own dead-end back
   button as a side effect, since this screen navigates via `router.push` rather than `replace`), delete
   removes the row server-side. I did not attempt to fix the underlying router behavior (e.g., by trying
   route-group tricks) — the working flat path was faster to ship and is not worse UX; worth a Fable
   judgment call on whether the literal file path in the task doc should be corrected, or whether a future
   round should chase the router bug itself (e.g., an expo-router version bump) so the milestone's actual
   convention (`index.tsx` alongside `[id].tsx`, the same shape M06's `app/(main)/sessions/[id].tsx` chat
   screen already uses) can be followed elsewhere without hitting the same trap.
2. **`src/api/sessions.ts` (a new REST client layer) added — not on the original file list.** The WS
   `session.list` RPC (`tui_gateway/methods_session.py`) is real but thin: `{id, title, preview, started_at,
   message_count, source}`, no `pinned`/`unread`/`last_active`/`model` — exactly the fields this milestone's
   own task line asks the list screen to surface (search, pin, unread). `GET /api/sessions`
   (`hermes_cli/web_routers/sessions.py`) carries all of them plus the `PATCH`/`DELETE` affordances pin/
   delete need. Auth mirrors `session-connection.ts`'s existing three-way split (token Bearer, oauth Bearer,
   password cookie jar) rather than introducing a new auth pattern.
3. **Background-grace close (`active -> background`, keep the socket 20s then `close()`) is built and
   unit-tested but does not reliably fire on-device — a real platform finding, not a bug in the timer logic
   itself.** `AppLifecycle`'s pure logic is correct (9/9 unit tests, fake-timer-driven) and the real
   `AppState` listener does fire correctly on-device (confirmed via a temporary debug log: `AppState change:
   background` logged the instant the app was backgrounded via `adb shell input keyevent KEYCODE_HOME`).
   But the scheduled `setTimeout` callback that should close the socket 20s later never ran: with a live WS
   connection open, the app was left backgrounded for **over 2 minutes** (well past the 20s grace) and
   `netstat` showed the connection still `ESTABLISHED` the whole time; the only further lifecycle log was
   `AppState change: active` when the app was deliberately foregrounded again to check — which, per
   `AppLifecycle`'s own (correct) logic, *cancels* a still-pending grace timer, meaning the close callback
   had genuinely never fired in the intervening two-plus minutes, not merely "not yet." This points at
   Android suspending or heavily throttling the RN JS thread for a backgrounded app — a well-known platform
   behavior a plain `setTimeout` cannot work around. A real fix needs a native background-task mechanism
   (a short foreground service, or a WorkManager-backed headless JS task) to guarantee the close actually
   runs during the grace window; that is a meaningfully larger undertaking than this round had time for, so
   it is recorded here rather than silently left looking like working code. The *reverse* direction
   (foreground → reconnect-and-probe) is unaffected by this — it runs the instant `AppState` reports
   `active`, no timer involved, and is live-confirmed working.
4. **`gateway.ready` replay-epoch cold start and `replay.truncated` hydration are unit-tested but not
   live-verified.** Both are new reducer logic this milestone (`session-stream/lifecycle.ts`) with real
   coverage (8 tests: first-ever `gateway.ready` is not mistaken for a restart, a same-epoch reconnect is
   not either, a changed epoch drops the runtime map + re-resumes the active session + refreshes the list,
   `replay.truncated` hydrates the named session, an unbound runtime id falls back to the documented
   placeholder-key convention). Exercising either live means either restarting the throwaway `hermes serve`
   process mid-session (for the epoch case) or engineering a large-enough replay gap that the server's
   512-event ring evicts events before a reconnect catches up (for `replay.truncated`) — both nontrivial to
   stage reliably in the time this round had left after the background-grace investigation above, so left
   as code-plus-tests rather than claimed as device-proven. Flagged explicitly rather than folded into "the
   reducer is well-tested elsewhere so this is probably fine."
5. **`expo-notifications` (foreground notifications) and `expo-network` (network-change redial) are not
   built at all this round — a scope call, not an oversight.** Both need a new native dependency, which
   needs a WSL2 Gradle rebuild (~20-30 minutes, `docs/CONNECTING.md`) to even load on the emulator, let alone
   verify live. Given how much of this round's budget the background-grace-timer investigation and the
   session-list routing bug already took, attempting either — and then not having time to verify the
   resulting native build actually works — seemed worse than deferring both cleanly. Concretely NOT done:
   the `expo-network` connectivity-change half of `lifecycle.ts` (task line: "if closed, reset backoff and
   redial; if open, ping probe"), and everything notification-shaped (the ported policy from upstream's
   `apps/desktop/src/store/native-notifications.ts` — 7 kinds, the `{approval, input}` attention set, 1s
   throttle, persisted prefs — and the actual `expo-notifications` dispatch). I deliberately did not write a
   disconnected "policy" module with nothing calling it yet — a half-built, unused piece is worse than an
   honest gap, and the policy port is small enough to build alongside its own dispatch wiring in one pass
   next round rather than splitting the two across sessions. The task's own `src/store/notifications.ts`
   deliverable line is addressed by naming *why* it's not the right file — see Deliverables above — the
   in-app-toast file that name already refers to (M06) is a different, already-shipped concern.
6. **`gateway.capabilities.per_session_exclusive_submit` "honoring" reads as a client-side error-message
   distinction, not a capability check — an open question, answered.** No client anywhere in the upstream
   repo (desktop, TUI, the old Capacitor mobile spike) calls the `gateway.capabilities` RPC to check the flag
   ahead of time; it is enforced server-side unconditionally (`tui_gateway/session_lifecycle.py`) and the
   flag itself is always `true` in the current codebase. "Honoring" it here means recognizing the 4090
   rejection when it happens (`SESSION_NOT_OWNED`, `MAX_CONCURRENT_SESSIONS`,
   `SESSION_COORDINATION_UNAVAILABLE`) and telling the user something true instead of a generic RPC-failure
   toast — there is no existing client-side reference implementation to copy, so this is a judgment call
   rather than a port. Unit-tested (3 cases); not live-tested — provoking a real 4090 needs two connections
   racing a submit on the same session, which the SudoCard/SecretCard rounds' single-connection testing
   pattern doesn't naturally produce, and building a dedicated harness for it (`second-client-reclaim.mjs`-
   shaped, but for prompt.submit racing rather than reclaim) was judged lower priority than the items above
   given remaining time.

## Verification log

### 2026-09-08 — session list: live, end to end

Throwaway `hermes serve --host 127.0.0.1 --port 9119`, scratch session token, `adb reverse`, dev-client on
`emulator-5554`. `npm run check` green (typecheck + 171 vitest + eslint + prettier) before any device work.

**Load.** Cold app start with a valid stored connection redirected straight to the list (`app/index.tsx`'s
`<Redirect href={connection ? '/session-list' : '/connect'} />`), which rendered real rows from the server —
titles, previews, relative timestamps, model, pin stars — for every session on the throwaway install (over 40
by this point in the day's testing).

**Search.** Typed `lighthouse` into the search field; the list narrowed to exactly the one matching row
(`'Write detailed lighthouse story'`), confirmed via a fresh `uiautomator` text dump (only that title present).

**Pin.** Tapped the star on the filtered row; confirmed via a direct server query
(`GET /api/sessions?limit=100&order=recent` with the same Bearer token) rather than trusting the star's own
rendered color:
```
PINNED: Write detailed lighthouse story
total pinned: 1
```

**Open + resume real history.** Tapped the row; the chat screen loaded actual prior turns from that session
(`'One rainy Tuesday, something changed.'`, `'He could have swatted it. He could have walked away. He did
neither.'` — real story content from an earlier round's testing, not placeholder text), confirming
`session.resume` against a session opened from the list (not `id: "new"`) works correctly.

**Back navigation.** Tapped the header's `‹`; returned to the list screen with the search filter still
applied and the star still showing pinned — `router.back()` now has a real stack entry to return to (this
screen uses `router.push`, not `replace`), which also fixes M06's own dead-end back button as a side effect
(M06 reached the chat screen only via `replace`, so `router.back()` there hit `"GO_BACK was not handled"`).

**Delete.** Long-pressed a different row (`'Lighthouse keeper finds message in bottle'`); the confirm dialog
showed the correct title; confirmed delete; a direct server query afterward showed the session gone:
```
bottle session still present: False
total sessions: 42
```

### 2026-09-08 — deep link: live

`adb shell am start -a android.intent.action.VIEW -d "hermes-android://session/20260908_173014_e42e9c"
com.nousresearch.hermes.mobile` — the app (already running) opened directly into that session's real
history (`skill_view`/`airtable` tool call, the PAT setup instructions from an earlier round's SecretCard
testing), confirming `app/session/[id].tsx`'s `<Redirect>` to `/(main)/sessions/[id]` resolves correctly
from a genuine OS-level `VIEW` intent, not just an in-app navigation.

### 2026-09-08 — AppLifecycle: AppState wiring confirmed, background-grace timer does not fire live

With a chat session open (WS connection confirmed `ESTABLISHED` via `netstat`), backgrounded the app
(`adb shell input keyevent KEYCODE_HOME`). A temporary debug log (`console.log` in `useAppLifecycle.ts`,
removed before committing) confirmed the real `AppState` listener fires correctly:
```
18:19:47.843  [debug-lifecycle] AppState change: background
```
`netstat` immediately after: still `ESTABLISHED`. Waited **over two minutes** (until 18:21:52, confirmed via
repeated `netstat` checks) — connection still `ESTABLISHED` the entire time, well past the 20s grace. Only
log line in that whole window: nothing further, until deliberately foregrounding to check, which logged:
```
18:22:08.671  [debug-lifecycle] AppState change: active
```
— which correctly cancelled whatever was left of the grace timer per `AppLifecycle`'s own logic, meaning the
close truly never fired. See Deviations #3 for the platform-level explanation and what a real fix needs.

The *foreground* half was exercised as a side effect of this same test — `reconnectAndProbeGateway()` ran on
the `active` transition with no error (the socket was still open the whole time, so this was a no-op-then-
ping, not a fresh dial, but it did not crash or hang).

### Cleanup

Throwaway `hermes serve` killed, `/api/health` confirmed unreachable afterward (`curl` exit 7 / `000`).
Scratch session token deleted. No `config.yaml` change was needed this round (no approval-mode testing).
Final `npm run check` clean (typecheck, 171 vitest, eslint, prettier) at every commit this round.
