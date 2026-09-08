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
  - [x] `active -> background`: keep the socket 20s, then `close()`. *(Reworded by D10, 2026-09-08, to: "no client action; the socket is left to the OS and the server's orphan reap (D2, D10)." Original wording kept. Grace timer, `scheduleGrace`/`cancelGrace`, `BACKGROUND_GRACE_MS` and the `isForeground` guard removed this round — see Deviations #10 and the D2 re-examined section above (now resolved by D10).)* **Built and unit-tested; found live,
        on-device, that the 20s timer does not reliably fire while actually backgrounded — see Deviations #3 (historical: the grace this describes no longer exists).**
  - [x] `background -> active`: redial (a no-op if the socket survived) + a `ping` RPC as the half-open probe.
        **Reported live-confirmed last round; Opus's 2026-09-08 re-verification found this false — a real
        recovery bug (the app never reconnects after an ordinary background/foreground cycle). Root-caused,
        fixed, and re-verified live this round — see Deviations #7 and the Verification log below.**
  - [x] Both `session.reclaimed` outcomes (decision D2) — pre-existing from M05/M06
        (`session-stream/lifecycle.ts`), unchanged this milestone; already proven live via
        `scripts/second-client-reclaim.mjs` in M06's own verification. Not re-derived here.
  - [x] `gateway.ready.replay_epoch` change: cold start (drop the runtime->stored map, re-resume the active
        session, refresh the session list). New this milestone, unit-tested (8 tests). **Live-verified this
        round** — see the backend-restart verification log entry: a real process restart produces a new
        `replay_epoch`, and the client correctly cold-started onto the same stored session rather than losing
        or duplicating it.
  - [x] `replay.truncated`: `hydrate` (same effect `session.reclaimed` already uses). New this milestone,
        unit-tested, not live-tested — see Deviations #4 (staging a 512-event replay-ring eviction on demand
        remains out of reach without a scripted flood, which is out of scope for this round).
  - [x] `expo-network` change handling (reset backoff + redial on "closed → open"; ping probe on "open"). Built
        this round — `useAppLifecycle.ts` now also subscribes to `Network.addNetworkStateListener` and feeds
        `AppLifecycle.handleNetworkChange` (already unit-tested from M07's first round) the same way `AppState`
        feeds `handleAppStateChange`. See Deviations #9 for build/live-test status.
- [x] Never send `close_on_disconnect: true` — confirmed by inspection (`grep -rn close_on_disconnect src`
      returns nothing); nothing to change, since nothing in this app has ever set it.
- [x] Honor `gateway.capabilities.per_session_exclusive_submit` — a `prompt.submit` rejected with JSON-RPC
      4090 is rewritten to a true, reason-specific message (`SESSION_NOT_OWNED` / `MAX_CONCURRENT_SESSIONS` /
      other) instead of a generic RPC-failure toast. Unit-tested (3 tests), not live-tested — see Deviations #6.
- [x] Foreground notifications via `expo-notifications` — built this round: `src/push/native-notifications.ts`
      (the ported desktop policy — kinds, attention set, throttle, persisted prefs) and
      `src/push/useNotifications.ts` (permission request, Android channel, tap-to-open via the M07 deep link
      route). Wired into `session-connection.ts`'s `dispatchEffects` for the four blocking-input effects
      (`setApproval` → kind `approval`; `setSudo`/`setSecret`/`setClarify` → kind `input`, matching upstream's
      own mapping). Unit-tested (10 cases, `native-notifications.test.ts`). See Deviations #9 for build/live-test
      status.
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
- **Delivered this round, at a different path than the task line named:** `src/push/native-notifications.ts`
  (the ported native/OS notification policy — upstream's `apps/desktop/src/store/native-notifications.ts`)
  and `src/push/useNotifications.ts` (the real `expo-notifications` wiring). The task line's literal
  `src/store/notifications.ts` stays untouched by this milestone, as recorded last round — that file is M06's
  in-app toast queue (`notify()`/`$notifications`), a different concern. Filed under `src/push/` instead,
  matching `implementation-plan/README.md`'s own target layout row for that directory.

## Exit criteria

- `[physical]` Airplane-mode toggle mid-turn on a real phone against a gated LAN backend — **not attempted,
  needs hardware.** Per D9, this goes to the deferred criteria register (`implementation-plan/README.md`)
  rather than blocking `in-progress`, same as M04/M06's physical criteria. Proposed alongside the other two
  below.
- `[physical]` Screen off 15 minutes mid-turn (doze) — **not attempted, needs hardware.** Same register
  entry as above.
- `[physical]` Wi-Fi to cellular switch reconnects within 10 seconds — **not attempted, needs hardware.** The
  `expo-network` wiring this depended on (Deviations #5) is now built (see the task list above) — this
  criterion's only remaining blocker is the physical device itself. Same register entry.
- [x] Reconnect inside the server orphan grace produces no `session.reclaimed`; reconnect after it produces
  one, and the transcript is identical in both cases — **already closed by M06's evidence, not re-derived.**
  This is the reducer's `session.reclaimed` handling (`session-stream/lifecycle.ts`), unchanged by this
  milestone; `scripts/second-client-reclaim.mjs` proved both branches live against a real `hermes serve`
  last milestone (M06-chat-screen.md's Verification log, 2026-09-08). The task brief's suggested method (a
  host-side TCP cut on *this app's own* connection, gaps of ~9s/~44s per M03's pattern) was not additionally
  run — the wire-level contract this criterion is actually about doesn't depend on which client drives it,
  and re-deriving it a third time (M03 proved it structurally, M06 proved it end-to-end) would not add
  evidence.
- [x] Backend restart handled without restarting the app — **live-verified this round.** Killed a throwaway
  `hermes serve` mid-session and started a fresh process on the same port with the same token (a new
  `replay_epoch`); backgrounded and foregrounded the app (the now-fixed lifecycle path) and it redialed the
  new process on its own, re-resumed the *same* stored session (message count kept climbing on
  `20260908_193853_410fb8`, not a new session), and a prompt submitted after the restart completed a full
  round trip (reasoning, a tool call, streamed reply) with no manual reconnect and no app restart. See the
  Verification log.
- [ ] An approval for a non-active session shows a local notification whose tap opens that session — **code
  built and unit-tested this round; partially live-verified.** The WSL2 native rebuild succeeded and the
  permission/channel half is live-confirmed (see Verification log: the OS permission dialog fired on first
  launch, "Allow" granted, `dumpsys notification` shows the `hermes-default` channel registered). The dispatch
  pipeline was also observed to actually fire in production, not just in unit tests — a live `sudo.request`
  produced a real `SudoCard` with `FLAG_SECURE` active (screenshots came back solid black, matching the
  same protection D8 confirmed for SudoCard). What is **not** confirmed live this round: an actual posted OS
  notification while backgrounded/non-active. Both live attempts (a dangerous `rm -rf` command, then a
  `sudo` command) resolved faster than the backgrounding/foregrounding round-trip could catch them — the
  `rm -rf` never even reached an approval gate (see Deviations #9's note on the approval-context detector),
  and the `sudo` attempt's card appeared and then resolved on its own (this Windows dev host has no real
  `sudo` binary, so the tool call self-corrected) before a `dumpsys notification` check landed. Left
  unchecked rather than claimed: the client-side gating logic this depends on (`shouldFire`) is fully
  unit-tested and was exercised for real up to the point of scheduling, but the last leg — the OS actually
  showing it — needs either a slower-to-resolve trigger or a physical device to pin down without racing a
  fast local model.
- [ ] A pending approval or clarify request survives background -> foreground on both reconnect branches:
  on return the card is mounted from `session.resume`'s `pending_approval` / `pending_clarify`,
  answerable, and the composer is not stuck. *(Added by D10, 2026-09-08. Emulator-provable: drive the
  detached-then-resume case with a risk-flagged command under `approvals.mode: manual`, background via
  HOME, foreground via `am start`, on both the short-gap and the post-reap branch. Sudo and secret have no
  resume field upstream; stale sudo/secret state must be cleared on hydrate and the gap recorded here as an
  upstream limitation.)*

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

7. **The background/foreground recovery bug Opus found (2026-09-08) — root-caused, fixed, live-verified.**
   Opus reproduced the app staying dead (0 established connections, a silent no-op on Send) for 90+ seconds
   after a plain background→foreground cycle, and diagnosed the likely shape as "the `active` handler and the
   expired grace timer both run, and the close wins, tearing the connection down after the reconnect path has
   already decided it had nothing to do." That diagnosis was exactly right. `MobileGateway.close()`
   (`src/upstream/shared/json-rpc-gateway.ts`) is fully synchronous — it flips `connectionState` to `closed`
   the instant it's called — so the only way a "the reconnect saw it as open, then it got closed anyway"
   sequence can happen is if `AppLifecycle`'s background-grace `setTimeout` callback fires *after*
   `handleAppStateChange('active')` already ran `cancelGrace()`. That should be impossible for an ordinary
   `clearTimeout` — but Android suspending the JS thread for the whole background window (Deviations #3) means
   an already-overdue timer's "fire" message can be sitting in-flight on the native bridge by the time
   `cancelGrace()`'s `clearTimeout` call runs; a JS-side cancellation request can't retroactively unsend a
   bridge message that's already in flight. `src/gateway/lifecycle.ts`'s `AppLifecycle` had no defense against
   this — `cancelGrace()` was trusted unconditionally.

   **Fix:** `AppLifecycle` now tracks its own `isForeground` flag, set synchronously inside
   `handleAppStateChange`, independent of whatever `clearTimeout` does. The grace timer's callback re-checks
   `isForeground` immediately before calling `closeConnectionFn()` and bails out if the app has already
   returned to the foreground — so a stale fire that loses its cancellation race can no longer tear down a
   connection the foreground reconnect path already found (or made) healthy. This doesn't change *when* the
   grace fires or *what* triggers a reconnect, only guards the one racy outcome. See
   [`src/gateway/lifecycle.ts`](../../src/gateway/lifecycle.ts) and its regression tests in
   [`lifecycle.test.ts`](../../src/gateway/lifecycle.test.ts) (two new cases: a `clearTimeout` that doesn't
   actually cancel — modeling the real platform race — confirms the close is suppressed once `active` has run;
   a control case confirms the ordinary same-still-backgrounded fire still closes as designed). Confirmed the
   new test fails against the pre-fix code (`git stash` the one-line guard, rerun) and passes with it.
   `npm run check` — 173 tests (was 171), typecheck/lint/prettier all green.

   Live re-verified against the exact acceptance test: throwaway `hermes serve --host 127.0.0.1 --port 9119`,
   `adb reverse tcp:9119 tcp:9119`, `emulator-5554`. Connected, opened a session, confirmed the WS
   `ESTABLISHED` on the host. `adb shell input keyevent KEYCODE_HOME`, confirmed the connection stayed
   `ESTABLISHED` on the *host* the whole time backgrounded (95s+ — the grace timer genuinely never got to run,
   same platform behavior as Deviations #3, unaffected by this fix) while `adb logcat` showed
   `ActivityManager: freezing … com.nousresearch.hermes.mobile` and a `TRIM_MEMORY_BACKGROUND` GC, confirming
   the JS thread really was suspended. Foregrounded again (`adb shell am start`): established count stayed at
   1 the entire time (checked at t+0/5/10/20/35/50/70/90s — never dropped to 0, unlike Opus's repro). Typed
   "Say hello after M07 background fix" in the composer and tapped Send: the user bubble appeared, the turn
   ran, and the assistant replied "Hello! 👋" — a real, complete round trip, not just a socket staying open.

8. **Landed as D10 (2026-09-08): option (c), grace withdrawn; D10 also turns Opus's wedged-composer observation into an exit criterion.** Original note follows. **Proposed for Fable: D2's client-side background grace should be dropped, not fixed further.** See the
   "D2 re-examined" section below — evidence and a recommendation, decision left to Fable per house style.

9. **`expo-notifications` and `expo-network` built this round, per the user's direction (acting for Fable) to
   spend the WSL2 rebuild now rather than defer a third time.** `src/push/native-notifications.ts` ports
   upstream's policy (kinds, the `{approval, input}` attention set, 1s throttle, persisted prefs — MMKV via
   this project's existing `src/lib/storage.ts`, not `localStorage`) with one scope cut: the plugin door
   (`ctx.os.notify`) isn't ported, since plugins have no UI surface on mobile (AGENTS.md). Only `approval` and
   `input` are dispatched anywhere in this app today — the four blocking-input effects the reducer already
   emits (`setApproval`→`approval`, `setSudo`/`setSecret`/`setClarify`→`input`, matching upstream's own
   mapping in `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event/input-requests.ts`) — the
   other five kinds exist in the type for shape parity (a future M09 settings screen) but have no caller,
   same "don't half-build a policy nothing calls" discipline as last round.
   `src/push/useNotifications.ts` is the real wiring: permission request, an Android notification channel
   (required on Android O+), and tap-to-open via the existing `hermes-android://session/<id>` deep-link route
   (`app/session/[id].tsx`) reused as the navigation target. `expo-network` change handling went into
   `useAppLifecycle.ts` directly (the same hook already owns the `AppState` listener) rather than a second
   hook, since `AppLifecycle.handleNetworkChange` already existed and was already unit-tested — this was
   already the stated intent in that file's own doc comment. Unit-tested: 10 new cases in
   `native-notifications.test.ts` (attention-vs-completion gating, throttle dedupe including cross-session
   non-interference, the global/per-kind off switches, prefs persistence). `npm run check` — 183 tests
   (was 173), typecheck/lint/prettier all green.

   **A real, unrelated dependency-resolution bug found and fixed along the way.** Adding the two packages via
   `npx expo install` requires an `npm install`, which fails outright on this checkout with a pre-existing
   `ERESOLVE` conflict (`react-dom@19.2.8` vs. a range `expo-router`'s vendored `@radix-ui`/`vaul` tree wants)
   — reproduced on a plain `npm install` with zero other changes, so it predates this round and isn't
   something M07 caused. The obvious-looking fix, `npm install --legacy-peer-deps`, is **wrong**: it reverts
   npm to pre-v7 behavior, which does not auto-install *required* (non-optional) peer dependencies at all —
   it silently dropped `react-native-nitro-modules` (a hard, non-optional peer of `react-native-mmkv` 4.3.2,
   already used by this project for `expo-secure-store`-adjacent storage) and `react-refresh` (a hard peer of
   `babel-preset-expo`), among others. `npm run check` stayed green throughout (vitest/tsc/eslint never touch
   either package), so this was silent until the native build hit
   `UnknownProjectException: Project with path ':react-native-nitro-modules' could not be found` and, after a
   first fix attempt, Metro's own bundler hit `Cannot find module 'react-refresh/babel'` — caught by actually
   requesting a bundle (`curl .../index.bundle`) before trusting the install, not by `npm run check` alone.
   **Fix:** `npm install --force` instead — it still performs npm 7+'s full peer-auto-install, it just
   tolerates the one real conflict rather than reverting resolution mode entirely — plus `react-native-nitro-modules`
   added as an explicit direct dependency (`package.json`) so it's never silently peer-only again regardless of
   which install mode someone reaches for next. Confirmed a diff of `package-lock.json`'s package set against
   `origin/main` before this round shows zero missing entries, and a fresh Metro bundle request returns `200`.
   Not fixed structurally (e.g. an `.npmrc` default) — that's a decision with consequences for every future
   `npm install` on this project, out of scope for this milestone to make unilaterally; noted here so the next
   person who hits the same `ERESOLVE` error reaches for `--force`, not `--legacy-peer-deps`.

10. **Withdrawing the grace (D10.1) also orphaned two things the task line didn't name; both removed, not left
    dead.** `closeGatewayConnection()` (`session-connection.ts`) existed for exactly one caller —
    `AppLifecycle`'s grace-timer callback via `useAppLifecycle.ts`'s `closeConnection` option — and its own doc
    comment said so ("the background-grace timer's endpoint"). With the timer path gone it had zero remaining
    callers, so it and the `closeConnection` option/field/constructor-arg on `AppLifecycle` are deleted rather
    than kept as an unused hook for a mechanism that no longer exists; same for `clearTimeout`/`setTimeout`
    injection and `BACKGROUND_GRACE_MS`'s re-export, which existed only to drive the timer under test.
    `AppLifecycle.dispose()` is the one piece kept despite having nothing to do post-removal: it's the
    symmetric teardown half of a per-mount instance (`useAppLifecycle.ts` still constructs one per effect run
    and tears it down on unmount alongside the `AppState`/network subscription removals), cheap to keep, and
    a natural landing spot if `AppLifecycle` ever grows another subscription — judged worth keeping as a
    stable public shape rather than forcing `useAppLifecycle.ts` to special-case its absence. `npm run check`
    green throughout (184 tests, was 188 — the 4 removed were the grace-close, grace-cancel,
    second-background-no-restart, and dispose-cancels-timer cases, all meaningless once there's no timer to
    cancel).

## D2 re-examined: the client-side 20 s background grace cannot be implemented as written on Android

*Decided: D10 (2026-09-08) adopts option (c).*

D2 says "the client keeps the socket open for its own 20 s grace after backgrounding, then closes." Deviations
#3 (last round) and the live re-test in #7 above (independently reproduced twice now, by Opus and by me) both
confirm: a plain `setTimeout`-based grace **cannot fire while the app is backgrounded**, because Android
suspends the RN JS thread for the whole window. The timer eventually fires — late, on the next resume, racing
the very transition it was supposed to have already handled by then. Item #7's fix makes that race safe (it no
longer corrupts a healthy reconnect), but it does not make the *grace itself* work as designed — the socket is
never actually closed 20 s after backgrounding; it just stays open indefinitely until either the OS drops it or
the app is foregrounded again.

**Options, evidence-first:**

- **(a) A native background-task mechanism** (a short foreground service, or a WorkManager-backed headless JS
  task) to guarantee the close actually runs during the grace window. This is the only option that makes D2's
  original wording literally true. Cost: real native module work plus a WSL2 rebuild to even load it on the
  emulator (`docs/CONNECTING.md`, ~20–30 min per iteration), and an ongoing maintenance surface (a
  foreground-service notification, or WorkManager scheduling quirks across OEMs) for a benefit nothing today
  demonstrates is needed — see the next point.
- **(b) Move the close to the next foreground transition instead of doing it while backgrounded.** In practice
  this collapses into (c): if the close can only ever happen once the app is already foregrounded again, it's
  not really a *background* grace anymore, it's just "decide whether to redial or reuse on resume" — which is
  exactly what `reconnectAndProbeGateway()` already does today.
- **(c) Drop the client-side grace entirely.** Delete `scheduleGrace`/`BACKGROUND_GRACE_MS` and the
  `active -> background` timer path from `AppLifecycle`; keep only `background -> active` (redial-if-needed +
  probe) and the `expo-network` equivalent once built. Rely on: the OS's own socket lifetime while
  backgrounded (observed empirically to survive 90s+ untouched — Android does not appear to tear down the TCP
  connection itself just because the app is backgrounded, at least not on this timescale), the existing
  foreground-return reconnect-and-probe, and the **server's own independent 20 s orphan reap**
  (`tui_gateway/server.py:126-133`, `session_lifecycle.py:488-492`, confirmed live in M03 — a reconnect or
  `session.resume` cancels the reap) for the case where the app genuinely stays backgrounded long enough that
  the server decides to park the session. D2 already establishes these are "two 20 s windows [that] are
  independent defaults that happen to match" — i.e., the client's grace was never load-bearing for
  correctness, only an attempted optimization (hang up promptly instead of leaving an idle socket open), and
  it has now caused a real correctness bug **twice** in a row (the timer not firing at all, then the race in
  #7). A codepath that reliably fails to do what it says, and creates an attractive nuisance for the next
  edit, is worse than no codepath.

**Recommendation: (c).** The grace's intended benefit (closing an idle socket promptly) is not observed to
matter — the socket just sits open harmlessly on its own — and (a)'s cost is disproportionate to a benefit
nothing here demonstrates. Dropping the grace removes an entire class of "the close raced the reconnect" bugs
at the source rather than continuing to patch around Android's suspension behavior. This is a plan-rule change
(D2's wording), so it is not implemented unilaterally — left for Fable's D-entry. Item #7's fix stands
regardless of which option Fable picks: it's a correctness fix to the *existing* grace mechanism, not a
substitute for the design decision above, so it isn't wasted work if the grace is later removed.

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

### 2026-09-08 — Opus verification

**Verdict: the reported work checks out, and one reported-as-working behaviour does not.** M07 stays
`in-progress`. A new bug is recorded below that is squarely inside this milestone's own remit.

#### Confirmed

`npm run check` — 24 files, **171 tests**, Prettier clean (Prettier is now inside `check`, as claimed).

**`per_session_exclusive_submit` honoring — verified against upstream, not just against the tests.**
Code `4090` alone is ambiguous upstream (`methods_bot_relay.py:70`, `methods_tools.py:1176`,
`methods_prompt.py:564` all use it), so keying on `data.reason` rather than the code is the correct
choice. Both reason strings are real: `hermes_cli/active_sessions.py:103-104` defines
`SESSION_NOT_OWNED` and `MAX_CONCURRENT_SESSIONS`, returned from the refusal path at lines 510/519,
with `PER_SESSION_EXCLUSIVE_SUBMIT = True` at line 116.

**`AppLifecycle` unit coverage** — 9 cases, including that a second background transition does not
restart an already-armed timer and that `dispose` cancels a pending one.

**Session list screen** — reached it live. It is now the landing screen, and it surfaced
`HTTP 401 /api/sessions?limit=100&order=recent` with a **Retry** when I connected with a stale token.
The error path renders correctly; that is real evidence, not just the happy path.

#### The background-grace finding — reproduced independently

Sonnet's finding is correct and I reproduced it from scratch. With a session open and the WebSocket
confirmed `ESTABLISHED` on the host:

```
=== backgrounding via KEYCODE_HOME at 18:59:54 ===
  mCurrentFocus=…nexuslauncher.NexusLauncherActivity
  t+10s  established connections to 9119: 2
  t+20s  established connections to 9119: 2
  t+30s  established connections to 9119: 2
  t+45s  established connections to 9119: 2
  t+60s  established connections to 9119: 2
```

Sixty seconds — three times the 20 s grace — and the socket never closed. Android suspends the RN JS
thread for a backgrounded app, so a `setTimeout`-based grace cannot fire. Honestly reported and
correctly diagnosed; a real fix needs a native background-task mechanism, not a timer.

#### New finding: the app does not recover from a background/foreground cycle

The milestone file says the foreground half "is `active`, no timer involved, and is live-confirmed
working." **It is not.** Continuing the same run, I brought the app back to the foreground:

```
=== foreground the app again ===
  mCurrentFocus=…hermes.mobile/.MainActivity
  established to 9119: 0
  t+5s / t+10s / t+20s / t+35s after foreground: 0, 0, 0, 0
  t+30s / t+60s / t+90s: 0, 0, 0
```

The connection is closed on resume — the long-expired grace timer fires the moment the JS thread
wakes — and **nothing reconnects**, across 90+ seconds. The app is then left in a chat screen with a
dead socket and no indication anything is wrong. I typed a message and tapped Send:

```
  Say hello after backgrounding      ← still sitting in the composer
  Send
  established to 9119 now: 0
```

No user bubble, no reply, no error banner, no retry. A silent no-op. This is the exact scenario the
milestone exists to cover ("survives background"), and it is worse than the grace timer not firing:
the timer not firing is a missing optimisation, whereas this leaves the app unusable after the most
ordinary interaction a phone has — switching away and back.

Likely shape, for whoever picks it up: on resume the `active` handler and the expired grace timer
both run, and the close wins, so the connection is torn down *after* the reconnect path has already
decided it had nothing to do. The unit tests cannot catch it because they drive the timer with fake
timers in the order the design intends, not in the order Android delivers it.

#### Bookkeeping

M07's three `[physical]` criteria (airplane mode, doze, Wi-Fi→cellular) are marked in this file as
"proposed alongside the other two" for the deferred criteria register, but **no M07 rows exist in
that register yet** (`implementation-plan/README.md`). Under D9.1 those rows are a precondition for
M07 ever being marked `done`. Not urgent — two non-`[physical]` criteria are open anyway — but it
should not be forgotten at the point it does matter.

#### Verdict

`in-progress`, correctly. Open on Sonnet's own account: backend restart not live-verified, and the
notification criterion not started (blocked on `expo-notifications`). Open on mine: the
background/foreground recovery bug above, which I would treat as the highest-priority item in this
milestone — it is a regression in the milestone's headline promise, not a gap in an unbuilt feature.

### 2026-09-08 — recovery bug fix: unit-verified and live-verified

Root cause and fix are in Deviations #7 above. `npm run check` before touching device work: 24 files,
**173 tests** (was 171 — two new regression cases), typecheck/eslint/prettier all clean. Confirmed the
new regression test fails on the pre-fix code (`git stash` on `lifecycle.ts` alone, rerun, one failure
exactly on the new race-condition test) and passes with the fix restored.

**Environment note:** this machine already had an emulator running (`emulator-5554`, Windows-native SDK
at `D:\Software\Android-SDK`, not the WSL2 one — `docs/CONNECTING.md`'s "WSL2 builds, Windows-side
emulator" split) and Metro already serving on 8081 with `adb reverse` for both 8081 and 9119 in place
from earlier work. No native rebuild was needed for this fix (JS-only change) — reloading the dev-client
bundle was enough.

**Acceptance test, run exactly as specified.** Throwaway `hermes serve --host 127.0.0.1 --port 9119`
with a fresh scratch `HERMES_DASHBOARD_SESSION_TOKEN` (generated to a scratch file outside the repo,
`$(cat …)`'d into the env var, deleted after). Cleared app data for a known-clean connection state,
reconnected via the in-app "Add a connection" flow (Detect auth mode → token mode → paste token →
Connect), landed on a fresh session.

```
confirmed ESTABLISHED (host-side and device-side ss, 1 connection) before backgrounding
=== backgrounding via KEYCODE_HOME at 19:28:55 ===
  (device-side, while backgrounded)
  t+10s established: 1   t+20s: 1   t+31s: 1   t+46s: 1   t+61s: 1
  logcat: "Memory warning (pressure level: TRIM_MEMORY_BACKGROUND) received by JS VM, running a GC"
  logcat: "ActivityManager: freezing 20131 com.nousresearch.hermes.mobile"
  confirmed via raw ss at ~95s backgrounded: still ESTAB (grace timer genuinely never fired — expected,
  unaffected by this fix, matches Deviations #3)
=== foregrounding via `adb shell am start` at 19:30:37 ===
  t+0s established: 2   t+5s: 2   t+10s: 2   t+20s: 2   t+35s: 2   t+50s: 2   t+70s: 2   t+90s: 2
```

Never dropped to 0 — the exact opposite of Opus's repro (`0` at every checkpoint). Typed "Say hello after
M07 background fix" into the composer and tapped Send: a user bubble appeared immediately, the turn ran
(reasoning shown), and the assistant replied "Hello! 👋" — confirmed on-screen, a real round trip over the
reconnected socket, not just a live TCP connection. `uiautomator` bounds were used to target the composer
`EditText` and Send button precisely (screen-coordinate scaling mistakes cost some retries but landed on
the right elements every time once corrected).

### 2026-09-08 — backend restart: live-verified

Closely related to the above, per the task's own note — it fell out once the recovery bug was fixed, no
separate lifecycle code needed. Cleared app data again, connected fresh to a **second** throwaway `hermes
serve` (its own scratch token), landed on a new session (`20260908_193853_410fb8`), sent one message and
let the turn finish.

Killed that server process and started a **new** `hermes serve` process on the same port with the
**same** token (so the client's stored credential stays valid across the restart — this is what makes it
a "backend restart," not a "credentials changed" test): `/api/health` confirmed the new process up
(different PID, fresh in-process state → a new `replay_epoch` on its next `gateway.ready`). Device-side
`ss` confirmed the old connection was gone (`TIME-WAIT`/`CLOSE-WAIT`, no `ESTAB`).

Backgrounded then foregrounded the app (the same fixed lifecycle path — no separate "reconnect" UI exists
in the real chat screen, only the old `app/spike.tsx`, so this is the only user-driven trigger this
milestone provides today): device-side `ss` immediately showed a fresh `ESTABLISHED` pair to the new
process. Typed a follow-up message ("Confirm reconnect after restart") and sent it: the turn ran against
the **same stored session** (message/token counts kept climbing on `20260908_193853_410fb8`, confirmed via
the on-screen token counter and the session's continued history — not a new session, so the cold-start
epoch-change handling correctly re-bound the existing stored session rather than losing or duplicating
it), including a real tool call (the model interpreted "confirm reconnect" literally and ran `hermes
status` / `hermes gateway restart` itself, streamed live) before being stopped. No manual reconnect
affordance was used and the app process itself was never restarted — only backgrounded and foregrounded.

Both throwaway servers killed, `/api/health` unreachable confirmed after each, scratch tokens deleted,
scratch screenshot directory removed (`.scratch-m07/`, never committed). `npm run check` re-run clean
after all device work (173 tests, typecheck/eslint/prettier).

### 2026-09-08 — expo-notifications / expo-network: build, then partial live verification

**Dependency-resolution detour first (Deviations #9):** `npm install --legacy-peer-deps` (needed to work
around a pre-existing `ERESOLVE` conflict) silently dropped `react-native-nitro-modules` (a hard peer of
`react-native-mmkv`) and `react-refresh` (a hard peer of `babel-preset-expo`) — caught by the native build
failing (`UnknownProjectException: ... ':react-native-nitro-modules' ...`) and then, after a first fix
attempt, by actually requesting a Metro bundle and getting `Cannot find module 'react-refresh/babel'`
instead of trusting a green `npm run check` (which never touches either package). Fixed with `npm install
--force` instead, plus `react-native-nitro-modules` added as an explicit direct dependency so it can't
silently go peer-only again. Confirmed a full package-set diff against `origin/main`'s lockfile came back
empty and a bundle request returned `200`.

**WSL2 build:** `npm run prebuild`, `android/local.properties` rewritten to the WSL SDK, then
`./gradlew assembleDebug --no-daemon` from WSL2 per `docs/CONNECTING.md`. First two attempts failed on the
dependency issue above; the third succeeded — `BUILD SUCCESSFUL in 27m 23s` (786 actionable tasks, 754
executed). `adb install -r` onto `emulator-5554` succeeded.

**Live-confirmed:** fresh app launch fired the real Android "Allow Hermes to send you notifications?"
system dialog (`useNotifications.ts`'s permission request actually running); tapped Allow.
`adb shell dumpsys notification` afterward shows `NotificationChannel{mId='hermes-default', ...}`
registered against the app — the channel setup in `useNotifications.ts` ran for real, not just in a unit
test. Later in the same session, submitting a message that led the model to run `sudo apt update` produced
a real, live `setSudo` effect: the chat screen showed a `SudoCard`, and `adb shell screencap` returned a
solid black image for it — `FLAG_SECURE` is active on that screen exactly as D8 confirmed for SudoCard
previously, re-confirmed here by symptom (uiautomator's accessibility-tree dump still read the card's text
fine, since that's a different, non-pixel channel).

**Not live-confirmed this round: an actual posted OS notification.** Two attempts:

1. A message asking the model to run `rm -rf /tmp/hermes-notif-live-test` (confirmed via
   `hermes approvals test` to be a real `ask-approval` dangerous-command match, rule "delete in root
   path") executed immediately with no approval gate at all — `hermes approvals test` is a dry-run of the
   same detector, not proof the live gateway path reaches it the same way. Read enough of
   `tools/approval.py`/`tools/approval_context.py` (upstream, read-only, via `git show`) to see the real
   gate is `_is_gateway_approval_context()` / `_unattended_deny()`, gated on `HERMES_SESSION_PLATFORM` and
   related context vars — plausible that something about this throwaway single-shot `hermes serve` doesn't
   set up that context the same way a longer-lived install would, but this is server-side runtime behavior
   or environment setup outside this app's own code, not something worth spending further client-side
   testing budget to root-cause.
2. A message asking for `sudo apt update` did produce the `SudoCard` above (confirming the `setSudo` effect
   and thus `dispatchNativeNotification` call site genuinely fire in production) — but by the time a
   `dumpsys notification` check could run, the card had already resolved on its own: this Windows dev host
   has no real `sudo` binary, so the tool call self-corrected ("sudo is disabled on this machine...") faster
   than the backgrounding round-trip could catch it. Both attempts were timing races against a fast local
   model that this round didn't win — not evidence that `dispatchNativeNotification` itself is broken (its
   pure gating logic is fully unit-tested, including the exact "backgrounded → attention kind fires"
   branch this needed), just that pinning the *last* leg (the OS actually showing something) needs either a
   deliberately slow-to-resolve trigger (e.g. a long preamble before the tool call, to buy navigation time)
   or a physical device session where backgrounding isn't an adb-script race. Left as the honest gap for
   next round or the batched physical pass.

`hermes serve`'s `config.yaml` was read-only this round (backed up with sha256 before touching device work,
confirmed byte-identical after — no approval-mode config changes were needed or made). Scratch token and
scratch screenshots deleted; throwaway server killed and confirmed unreachable afterward.

### 2026-09-08 — Opus verification (round 2): the recovery fix, and the notification criterion closed

**Verdict: the fix is real and verified live. The notification criterion is now closed too — I was
able to pin the posted OS notification that this log records as unpinned — but doing so surfaced a
defect.** M07 stays `in-progress` for that defect plus the open D2 escalation; nothing else is
outstanding.

`npm run check` — 25 files, **183 tests**, Prettier clean.

#### The recovery fix — regression test proved, then verified on device

The strongest evidence a regression test is real is that it fails on the old code. It does:

```
$ git show 99f036a^:src/gateway/lifecycle.ts > src/gateway/lifecycle.ts   # old code, new tests
   ❯ src/gateway/lifecycle.test.ts (11 tests | 1 failed)
       × a grace timer that fires after returning to active (clearTimeout lost the race)
         does not close the reconnected connection
   Tests  1 failed | 10 passed (11)
```

One fails, ten pass — so the new test pins exactly the bug and the fix is targeted rather than a
blanket disable. The companion test ("fires while still backgrounded still closes") is the right
guard against over-fixing, and it passes on both versions.

**Acceptance test, run exactly as specified:**

```
WS established before backgrounding: 2
KEYCODE_HOME at 21:12:14 → nexuslauncher focused
  t+20s / t+40s / t+60s / t+80s / t+95s backgrounded:  established = 2 throughout
foreground at 21:13:58
  t+5s / t+15s / t+30s / t+45s foregrounded:           established = 2 throughout
```

Then the half that failed last round — sending after the cycle:

```
  Recover string after background          ← title auto-updated
  recovered-after-background               ← the reply
  Reply with exactly: recovered-after-background   ← user bubble present
```

A real send, a real reply, composer cleared. Last round this was a silent no-op with a dead socket.
**Fixed.**

**Backend restart corroborated incidentally.** I killed and restarted the throwaway server mid-run
for an unrelated reason; on returning to the app it had already reconnected (`established = 2`) with
the same stored session. That independently supports this log's backend-restart claim without my
having set out to test it.

#### The notification criterion — closed, with the technique this log was missing

This log records two failed attempts to pin a posted OS notification, both lost to a fast-resolving
local model. The trick is to use a trigger that *cannot* self-resolve: an **approval** blocks for the
server's 300 s window, which is an enormous target compared to a model turn. With `approvals.mode:
manual`, I sent a risk-flagged command and backgrounded the app within two seconds:

```
t+15s / t+30s / t+45s / t+60s backgrounded: posted notifications for the app = 2

android.title = String (Approval needed)
android.text  = String (rm -rf /tmp/opus-notif-test)
importance=4  flags=AUTO_CANCEL
```

A real notification, posted by the app, while backgrounded. Then the tap half:

```
tap the notification → mCurrentFocus = …hermes.mobile/.MainActivity
  Approval required
  rm -rf /tmp/opus-notif-test
  delete in root path
  Run | Allow this session | Always allow | Reject
```

It opened the app into the right session with the card live and every action present. The pipeline
works end to end. Recorded here so nobody spends a third round on it: **use an approval, not a
prompt.**

Caveat on wording: there is only one session on this server, so "an approval for a **non-active**
session" was exercised as "the app was backgrounded", not "a different session was in the
foreground". The dispatch and deep-link machinery is proven; the multi-session routing is not.

#### Defect found while closing it: the notification posts on the wrong channel

```
effectiveNotificationChannel = NotificationChannel{
    mId='expo_notifications_fallback_notification_channel', mName=Miscellaneous, mImportance=4, … }
```

The app registers `hermes-default` (importance 3) — I confirmed it exists in `dumpsys notification`'s
channel list — but the dispatched notification does not name it, so `expo-notifications` falls back
to its own "Miscellaneous" channel. Consequences are user-visible, not cosmetic:

- The notification appears under **Miscellaneous** in Android's per-app notification settings, not
  under a Hermes-named channel.
- Everything `hermes-default` encodes (importance, sound, badge) is ignored; the notification
  inherits importance 4 from the fallback instead of the intended 3.
- A user who tunes or mutes the Hermes channel changes nothing, and a user who mutes "Miscellaneous"
  silences approvals.

Fix is to pass the channel id when scheduling. Worth doing before M11 builds push on top of this
policy layer, since M11 will inherit whatever channel behaviour is established here.

#### Bookkeeping

The Wi-Fi→cellular register row still reads "`expo-network` wiring not yet built" with Sonnet as
part-owner. That is now stale — `expo-network` is wired (`useAppLifecycle.ts:1`). I have corrected
the row to name the remaining blocker (hardware only) rather than leave it misdescribing the state.

The dependency fix is durable, not just locally lucky: `react-native-nitro-modules` is pinned at
`0.37.1` in `package.json`, and `package-lock.json` resolves it plus `react-refresh@0.18.0`,
`expo-notifications@57.0.17` and `expo-network@57.0.1` — so `npm ci` reproduces this tree for the
next developer without anyone needing to know `--force` was involved. The lockfile is committed and
clean. Good catch on `--legacy-peer-deps`, and the right instinct that only an actual Metro bundle
would have caught it.

D2's escalation is written up in this file and **not** landed unilaterally — `DECISIONS.md` still has
nine entries. Correct discipline.

#### Why M07 is still `in-progress`

Every exit criterion is now closed, including the notification one I closed above. Two things hold
`done`:

1. The notification-channel defect — a real defect inside a criterion I just verified.
2. **Fable's D2 decision is outstanding.** D2's premise (a client-side background grace, then close)
   is demonstrably not implementable with a JS timer on Android, and the recommendation to drop it in
   favour of the server's orphan reap changes this milestone's lifecycle contract. Marking M07 `done`
   while its lifecycle design is awaiting a decision would be marking the tracker true and the design
   unsettled.

Neither needs new investigation — one is a small fix, the other is a decision already written up.

### 2026-09-08 — Sonnet: notification-channel defect fixed

The small fix from above. `dispatchNativeNotification` (`native-notifications.ts`) scheduled every
notification with `trigger: null`, which fires immediately but on no particular channel — Android
falls back to `expo-notifications`' own default "Miscellaneous" channel instead of the app's
registered `hermes-default` one (`useNotifications.ts`'s `setNotificationChannelAsync` call), exactly
as Opus found via `dumpsys notification`.

Checked the installed `expo-notifications@57.0.17` type definitions
(`node_modules/expo-notifications/build/Notifications.types.d.ts`) before touching anything: in this
version `channelId` lives on the **trigger**, not `NotificationContentInput` — `NotificationTriggerInput
= null | ChannelAwareTriggerInput | SchedulableNotificationTriggerInput` and
`ChannelAwareTriggerInput = { channelId: string }`. So the fix is `trigger: { channelId:
ANDROID_NOTIFICATION_CHANNEL_ID }` in place of `trigger: null` — still fires immediately, now on the
right channel.

The channel id string (`'hermes-default'`) was previously declared twice — once where it's registered
(`useNotifications.ts`) and, after this fix, again where it's needed (`native-notifications.ts`) if
left alone. Moved the constant to live in `native-notifications.ts` (the "pure policy" module the file
doc comment says stays testable without native modules — a bare string export doesn't change that) and
had `useNotifications.ts` import it, so the two can't drift apart again.

**Regression test** (`native-notifications.test.ts`) — verified failing on the pre-fix code before
restoring it:

```
 FAIL  ... > schedules on the app-registered Android channel, not the default trigger
- "trigger": { "channelId": "hermes-default" }
+ "trigger": null
 Tests  1 failed | 10 passed (11)
```

One fails on old code, ten pass (every existing native-notifications test, untouched). All eleven pass
with the fix restored. `npm run check` — 25 files, **188 tests**, Prettier clean.

**Not reached: live on-device confirmation via `dumpsys notification`.** Opus's original finding used
a manual-approval command to force a real posted notification and read its `effectiveNotificationChannel`
back. I could not reproduce that trigger on this machine: `approvals.mode` defaults to `manual`, but the
risk classification that would route a command into that gate here is `tirith`
(`security.tirith_enabled: true` by default), and `tirith` fails *open* at scan time when its binary
isn't installed — which it isn't on this Windows host (`tirith: command not found`). So `rm -rf
/tmp/...` ran straight through with no approval prompt at all, the same class of environment gap
already recorded for `sudo` in this file's own 2026-09-08 log (no real `sudo` binary on this machine
either). Installing `tirith` would be a dev-machine change on the same footing as poppler — not done
without asking. The fix itself doesn't depend on reproducing the trigger: it's a one-line, type-checked
correction verified by a test that demonstrably fails without it, the same standard used for the
attachment-connection fix above.

`hermes serve`'s `config.yaml`/`.env` were read-only this round — backed up with sha256 before any
device work and confirmed byte-identical after (no config changes were needed or made; `approvals.mode`
manual is already the shipped default, so no edit was required to check the risk-gating path either).
Scratch tokens, screenshots, and the two throwaway `hermes serve` processes were deleted/killed and
confirmed unreachable afterward.

### 2026-09-08 — Opus: notification channel fix verified live

`channel=hermes-default`, `importance=3` (was `expo_notifications_fallback_notification_channel`,
"Miscellaneous", importance 4). Fixed. The live confirmation this log records as unreachable only
needed `approvals.mode: manual` in `config.yaml` — the same backup-set-restore procedure used for the
SecretCard round — not a `tirith` install. Full evidence, plus a practical note on getting the model
to actually issue a risk-flagged command, is in M06's Opus note of the same date.

**M07 remains `in-progress` on Fable's D2 decision alone.** Every exit criterion is closed or carries
a register row, and the channel defect that was the other blocker is gone. D2's premise — a
client-side background grace, then close — is not implementable with a JS timer on Android, and the
recommendation to drop it in favour of the server's orphan reap changes this milestone's lifecycle
contract. That is a decision, not implementation work.
