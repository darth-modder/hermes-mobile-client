# M07 — Session management + lifecycle

**Status:** todo
**Depends on:** M06
**Goal:** Sessions list and switch reliably; the app survives backgrounding, doze and network changes.

## Tasks

- [ ] `app/(main)/sessions/index.tsx`: `session.list`, search, pin, unread, new session (profile, cwd / project), delete, title
- [ ] `src/gateway/lifecycle.ts`:
  - AppState `active -> background`: keep the socket 20 s (late approvals still land), then `close()`; heartbeat stops with it
  - `background -> active`: redial, automatic replay via `fetchReplay()`, then a `ping` RPC with a 5 s timeout as a half-open probe
  - Handle **both** reconnect outcomes (decision D2): no reclaim when the redial lands inside the server's orphan grace, and `session.reclaimed {reason: "ws_orphan_reap"}` when it lands after. State stays keyed by the stored session id (as in M03). Never depend on the server's grace value: `ws_orphan_reap_grace_s` defaults to 20 s (`tui_gateway/server.py:126-133`) but is config-tunable and `0` disables reaping. The client's own 20 s background grace and the server's 20 s are independent defaults that happen to match.
  - `expo-network` change: if closed, reset backoff and redial; if "open", ping probe; on timeout `invalidate()` and redial
  - `gateway.ready.replay_epoch` change: cold start (`session.list`, re-resume the active session, drop the runtime-sid map)
  - `replay.truncated`: `session.resume` hydration for that session
- [ ] Never send `close_on_disconnect: true`; honor `gateway.capabilities.per_session_exclusive_submit`
- [ ] Foreground notifications via `expo-notifications` local scheduling; policy ported from upstream `apps/desktop/src/store/native-notifications.ts` (7 kinds, attention set `approval | input`, 1 s throttle, persisted prefs); `notification.show/clear` is an in-app toast only
- [ ] Deep link `hermes-android://session/<id>` opens that session

## Deliverables

- `app/(main)/sessions/index.tsx`, `src/gateway/lifecycle.ts`, `src/store/notifications.ts`

## Exit criteria

- `[physical]` Airplane-mode toggle mid-turn on a real phone against a gated LAN backend: after
  the radio returns, the app reconnects on its own and the assembled text equals `session.resume`
  history with no duplicate or missing `seq`. (Moved here from M03 by decision D1: covers OS
  socket teardown, `ConnectivityManager` callbacks, and IP change, none of which an emulator
  behind `adb reverse` can exercise.)
- `[physical]` Screen off 15 minutes mid-turn (doze): on resume the transcript is complete with no gaps.
- `[physical]` Wi-Fi to cellular switch reconnects within 10 seconds.
- Reconnect inside the server orphan grace produces no `session.reclaimed`; reconnect after it
  produces one, and the transcript is identical in both cases (emulator, host-side TCP cut with
  gaps of ~9 s and ~44 s as in M03's Opus log).
- Backend restart handled without restarting the app.
- An approval for a non-active session shows a local notification whose tap opens that session.
