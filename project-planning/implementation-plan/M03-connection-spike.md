# M03 — Connection spike

**Status:** todo
**Depends on:** M01, M02
**Goal:** Dial, `android`-source session, streaming turn, and reconnect replay proven from the device.

## Tasks

- [ ] `scripts/spike-gateway.mjs` adapted from upstream `apps/mobile/scripts/spike-gateway.mjs` (token mode; Node-only sanity check of the five steps)
- [ ] `src/gateway/mobile-gateway.ts`: `MobileGateway extends JsonRpcGatewayClient`; 30 s request timeout; 1 800 000 ms ack timeout for `prompt.submit` (matches `apps/desktop/src/api/client.ts`)
- [ ] `src/gateway/dial.ts`: URL from `buildHermesWebSocketUrl({ host, protocol, path: '/api/ws' })` with **explicit** host/protocol (RN defines a global `window` without `location`); `?token=` for token mode; `socketFactory` with subprotocols `['hermes-gateway-v1', 'hermes-gateway-ticket.<ticket>']` for ticket mode
- [ ] `src/net/http.ts`: fetch wrapper with `Authorization: Bearer`, optional extra headers, `?profile=` scoping, timeout, JSON error shape
- [ ] `app/spike.tsx`: URL + token inputs; connect; `session.create { source: 'android' }`; `prompt.submit`; raw delta log; `replay_epoch` and per-session watermark readout; disconnect / reconnect buttons
- [ ] `docs/CONNECTING.md`: dev recipe `hermes serve` on loopback + `adb reverse tcp:9119 tcp:9119` (the server rejects non-loopback peers on a loopback bind)

## Deliverables

- `scripts/spike-gateway.mjs`, `src/gateway/{mobile-gateway,dial}.ts`, `src/net/http.ts`, `app/spike.tsx`, `docs/CONNECTING.md`

## Exit criteria (on device)

- A 200+ token reply streams to the screen.
- Airplane-mode toggle mid-turn: after reconnect the assembled text equals `session.resume` history with no duplicate or missing `seq`.
- Backend restart: new `replay_epoch` observed and the session re-resumed.
- Node spike passes all five steps (status, dial, session.create, stream, replay).
