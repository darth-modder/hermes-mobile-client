# M07 — Session management + lifecycle

**Status:** todo
**Depends on:** M06
**Goal:** Sessions list and switch reliably; the app survives backgrounding, doze and network changes.

## Tasks

- [ ] `app/(main)/sessions/index.tsx`: `session.list`, search, pin, unread, new session (profile, cwd / project), delete, title
- [ ] `src/gateway/lifecycle.ts`:
  - AppState `active -> background`: keep the socket 20 s (late approvals still land), then `close()`; heartbeat stops with it
  - `background -> active`: redial, automatic replay via `fetchReplay()`, then a `ping` RPC with a 5 s timeout as a half-open probe
  - `expo-network` change: if closed, reset backoff and redial; if "open", ping probe; on timeout `invalidate()` and redial
  - `gateway.ready.replay_epoch` change: cold start (`session.list`, re-resume the active session, drop the runtime-sid map)
  - `replay.truncated`: `session.resume` hydration for that session
- [ ] Never send `close_on_disconnect: true`; honor `gateway.capabilities.per_session_exclusive_submit`
- [ ] Foreground notifications via `expo-notifications` local scheduling; policy ported from upstream `apps/desktop/src/store/native-notifications.ts` (7 kinds, attention set `approval | input`, 1 s throttle, persisted prefs); `notification.show/clear` is an in-app toast only
- [ ] Deep link `hermes-android://session/<id>` opens that session

## Deliverables

- `app/(main)/sessions/index.tsx`, `src/gateway/lifecycle.ts`, `src/store/notifications.ts`

## Exit criteria

- Screen off 15 minutes mid-turn: on resume the transcript is complete with no gaps.
- Wi-Fi to cellular switch reconnects within 10 seconds.
- Backend restart handled without restarting the app.
- An approval for a non-active session shows a local notification whose tap opens that session.
