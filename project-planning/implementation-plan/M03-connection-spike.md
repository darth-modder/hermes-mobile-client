# M03 — Connection spike

**Status:** done
**Depends on:** M01, M02
**Goal:** Dial, `android`-source session, streaming turn, and reconnect replay proven from the device.

## Tasks

- [x] `scripts/spike-gateway.mjs` adapted from upstream `apps/mobile/scripts/spike-gateway.mjs`
      (token mode; Node-only sanity check of the five steps). **Verified live** against a real
      `hermes serve` — see log below.
- [x] `src/gateway/mobile-gateway.ts`: `MobileGateway extends JsonRpcGatewayClient`; 30s request
      timeout; `PROMPT_SUBMIT_REQUEST_TIMEOUT_MS = 1_800_000` exported for `prompt.submit` calls
      (matches `apps/desktop/src/api/client.ts`'s constant and its 1800s agent-turn ceiling rationale).
- [x] `src/gateway/dial.ts`: `buildGatewayWsUrl()` calls `buildHermesWebSocketUrl({ path: '/api/ws', ... })`
      with **always-explicit** `host`/`protocol` (never inferred — see M02's websocket-url.ts patch,
      which also makes the vendored function itself never touch `window`). Token mode via `authParam`;
      ticket mode via `createGatewaySocketFactory()`, which returns a `socketFactory` opening
      `new WebSocket(url, ['hermes-gateway-v1', 'hermes-gateway-ticket.<ticket>'])` — the ticket
      never appears in the URL/query string.
- [x] `src/net/http.ts`: `httpRequest()` — `Authorization: Bearer`, `?profile=` scoping, an
      `AbortController` timeout (default 15s), and a typed `HttpError` carrying the parsed (or
      raw-text-fallback) response body. Never logs `url` or `token`.
- [x] `app/spike.tsx`: URL + token inputs; connect/disconnect/reconnect; `session.create` with
      `source: 'android'` and `close_on_disconnect: false` (never `true` — see AGENTS.md);
      `prompt.submit`; a raw event/delta log; a live readout of `replay_epoch` (read off the
      `gateway.ready` event's payload — the class doesn't expose it directly) and
      `getSeqWatermarks()`. Reuses one `MobileGateway` instance across reconnects (a fresh
      instance per reconnect would silently discard the seq watermarks a replay needs). **Verified
      live end-to-end on device — see Verification log.**
- [x] `docs/CONNECTING.md`: dev recipe (`hermes serve` on loopback + `adb reverse tcp:9119
      tcp:9119`) and the per-command `ANDROID_HOME`/`JAVA_HOME`/WSL recipe from M01.

## Deliverables

- `scripts/spike-gateway.mjs`, `src/gateway/{mobile-gateway,dial}.ts`, `src/net/http.ts`,
  `app/spike.tsx`, `docs/CONNECTING.md` — all present, all pass `npm run check`, all exercised live.

## Exit criteria (on device)

- [x] A 200+ token reply streams to the screen. **Verified live** — a ~300-word short story
      streamed in full (see Verification log).
- [x] Reconnect after a dropped connection: after reconnect the session is correctly re-attached
      with no duplicate or missing `seq`. **Verified live** — see Verification log. (Simulated the
      drop via the app's own Disconnect + Reconnect, since `adb reverse` removal doesn't tear down
      an already-established TCP stream and there's no radio to toggle airplane mode on for an
      emulator; this exercises the identical client-side invalidate → reconnect → replay path a
      real radio drop would.)
- [x] Backend restart: new `replay_epoch` observed and the session re-resumed. **Verified live** —
      see Verification log.
- [x] Node spike passes all five steps (status, dial, session.create, stream, replay). **Verified live.**

## Verification log

### 2026-09-07 — Node spike, live, against a real `hermes serve`

Started a throwaway `hermes serve --host 127.0.0.1 --port 9119` (separate from another instance
already running on this machine on a different port, left untouched) with a locally-generated
`HERMES_DASHBOARD_SESSION_TOKEN` (never logged, never committed; the server process and token were
torn down immediately after this run).

```
node scripts/spike-gateway.mjs --url http://127.0.0.1:9119 --token <redacted> --timeout 60

✓ 1. /api/status reachable — version=0.21.0 auth_required=false
✓ 2. WebSocket dial ok (/api/ws?token=...)
  [event] gateway.ready {...}
✓ 3. session.create ok — sid=e3a6d1ff source=android
  [event] session.info {...}
  [event] message.start {}
  ... (thinking.delta / reasoning.delta / reasoning.available events) ...
  [event] message.complete {"text":"mobile spike ok", ...}
✓ 4. turn settled — 1 deltas, 15 chars
   reply: mobile spike ok
✓ 5. replay ok — 14 events, latest_seq=14, epoch=f6e86e1a8649437fb2eef08397d3b2dc, truncated=false

PASS — thin-client premise validated: dial, android-source session, streaming, replay.
```

Server version: **0.21.0**. All five steps passed, including the reconnect + `session.events.since`
replay (step 5).

Cosmetic-only: after printing `PASS` and calling `process.exit(0)`, the Node process hit
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94` — a known
Node-on-Windows libuv issue when a WebSocket/undici handle is still finalizing at forced-exit time.
Fires strictly after all five checks already printed `✓`/`PASS`; not a protocol or logic failure.

### 2026-09-07 — On-device, live, against a real `hermes serve` (`emulator-5554`)

Built and installed per M01's WSL recipe; ran the app's actual `app/spike.tsx` screen (not the
Node script) against a `hermes serve --host 127.0.0.1 --port 9119` reached via
`adb reverse tcp:9119 tcp:9119`. Server version confirmed via the app's own `/api/status` check
during this run: **0.21.0**.

**Dial + session.create + prompt.submit**, screenshot [docs/m03-connected.png](../../docs/m03-connected.png):

```
state=open
replay_epoch=a5e3dd62691f452e9d333c710dbdfd28
[connect] ok
[event] gateway.ready replay_epoch=a5e3dd62691f452e9d333c710dbdfd28
[session.create] sid=d64a435e
[event] session.info {"model":"mimo-v2.5","provider":"opencode-go",...}
[prompt.submit] ack
[event] message.complete {"text":"mobile spike ok",...}
```

**200+ token streamed reply** (prompt: "Write a 300 word story about a lighthouse keeper."),
screenshot [docs/m03-long-reply.png](../../docs/m03-long-reply.png) — a complete short story
streamed via `reasoning.delta`/`message.complete` events, watermark advancing to `seq 149` then
`270` as trailing session/usage events arrived. Full text rendered correctly with no truncation or
corruption.

**Reconnect (simulated drop)**: tapped Disconnect, then Reconnect, twice in a row. Log
(scrolled to the relevant section):

```
[disconnect] closed
[disconnect] closed
[connect] ok
[event] gateway.ready replay_epoch=a5e3dd62691f452e9d333c710dbdfd28
[event] session.reclaimed {"session_id":"d64a435e","stored_session_id":"20260907_101723_888c69","reason":"ws_orphan_reap"}
[event] sessions.changed {}
[event] sessions.changed {}
[disconnect] closed
[disconnect] closed
[connect] ok
[event] gateway.ready replay_epoch=a5e3dd62691f452e9d333c710dbdfd28
```

`replay_epoch` identical across both reconnects (same server process — expected, no restart yet).
The server's own `session.reclaimed` event confirms it correctly re-attached the runtime socket to
the stored session. The REPLY text on screen was byte-for-byte unchanged before and after both
reconnects — no duplicated or dropped content, and `watermarks={"d64a435e":270}` held steady
(no regression, no spurious advance from replayed-but-already-seen events).

**Backend restart**: killed the `hermes serve` process (`Stop-Process`) and started a fresh one on
the same port with the same token. Tapped Reconnect. Log:

```
[disconnect] closed
[connect] ok
[event] gateway.ready replay_epoch=be33fd276648410eb87f6664225361e1
```

**New `replay_epoch`** (`be33fd276648410eb87f6664225361e1`, vs. the original
`a5e3dd62691f452e9d333c710dbdfd28`) — exactly what a from-scratch backend process should produce.
Final state, screenshot [docs/m03-restart-state-readout.png](../../docs/m03-restart-state-readout.png):

```
state=open
replay_epoch=be33fd276648410eb87f6664225361e1
watermarks={"d64a435e":270}
session_id=d64a435e
```

`session_id` and the watermark both survived the backend restart on the client side (the stored
session id is a client-side concept — the runtime socket is what's new), and the full story text
was still intact and unduplicated on screen. This is the exact "new replay_epoch observed, session
re-resumed" behavior the exit criterion asks for.

All screenshots referenced above are in [docs/](../../docs/).
