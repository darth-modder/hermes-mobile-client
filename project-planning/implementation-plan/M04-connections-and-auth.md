# M04 — Connections + token/password auth

**Status:** todo
**Depends on:** M03
**Goal:** Add a gated backend, sign in with a password provider, persist and reuse the session.

## Tasks

- [ ] `src/connections/types.ts`: `MobileConnection { id, kind: 'remote' | 'cloud', label, baseUrl, authMode: 'token' | 'password' | 'oauth', provider?, headerNames?, installId?, lastUsedAt?, needsLogin? }`
- [ ] `src/connections/registry.ts` (MMKV; one active connection in v1) and `secure.ts` (`expo-secure-store` keys `conn.<id>.token`, `conn.<id>.oauth`, `conn.<id>.header.<name>`)
- [ ] `src/net/auth/probe.ts`: `GET /api/health` (`auth_required`), `GET /api/auth/providers` (`[{name, display_name, supports_password}]`), then after auth `GET /api/status` (`install_id`) and `GET /api/auth/me`
- [ ] `src/net/auth/password-login.ts`: `POST /auth/password-login { provider, username, password }` (non-native path sets session cookies); all fetches use `credentials: 'include'`; WS ticket via `POST /api/auth/ws-ticket`
- [ ] `src/net/auth/ladder.ts` ported from upstream `apps/desktop/electron/native-auth-decisions.ts`: 401 → refresh/relogin once → retry → still 401 → `needsLogin`; 403 → stop; anything else → backoff, never reauth; WS close 4401/4403 follow the same ladder
- [ ] Screens: `app/connect/index.tsx` (URL, label, auto-detect auth mode), `app/connect/scan.tsx` (QR via `expo-camera`, payload `hermes-android://connect?url=...&token=...`), `app/connect/[id]/login.tsx`
- [ ] Per-connection extra proxy headers (e.g. Cloudflare Access) on fetch and on the WebSocket `{ headers }` third argument

## Deliverables

- `src/connections/*`, `src/net/auth/{probe,password-login,ladder}.ts`, `app/connect/*`

## Exit criteria

- Password login over LAN to `hermes serve --host 0.0.0.0` with the basic-auth provider succeeds.
- `[physical]` Cookies survive app kill and relaunch (`GET /api/auth/me` still 200). Emulator
  evidence is welcome but does not close this one (decision D1): cookie-jar persistence across
  process death differs across OEM WebView builds.
- WS dials with the ticket subprotocol and the server echoes `hermes-gateway-v1`.
- Wrong password produces one error and no retry storm.
- Token mode still works via `adb reverse`.
