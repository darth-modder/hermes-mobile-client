# M08 — Portal OAuth

**Status:** todo
**Depends on:** M04
**Goal:** Nous Portal (and any non-password provider) login works with no server change.

## Why a loopback listener

The upstream native-app flow (`hermes_cli/dashboard_auth/routes.py`, `_validate_loopback_redirect_uri`)
accepts only `http://127.0.0.1[:port]/...` or `http://[::1]` redirect URIs. Private-use schemes are
rejected. The desktop satisfies this with a loopback HTTP listener (`apps/desktop/electron/native-oauth.ts`);
the phone does the same with a tiny native module.

## Tasks

- [ ] `modules/loopback-listener/` Expo native module (Kotlin): `ServerSocket` bound to `127.0.0.1` on a random port; answers a single `GET /cb?code=...&state=...` with a small "return to the app" page; 2-minute lifetime; resolves `{ code, state }` to JS
- [ ] `src/net/auth/native-login.ts`: PKCE S256; open `${baseUrl}/auth/native/authorize?provider=&code_challenge=&code_challenge_method=S256&redirect_uri=http://127.0.0.1:<port>/cb&state=` with `expo-web-browser` (Custom Tabs); on callback `POST /auth/native/token { code, code_verifier }`; store the bearer payload `{ access_token, refresh_token, expires_at, provider, user_id }` in SecureStore
- [ ] `src/net/auth/token-refresh.ts`: single in-flight refresh; proactive at `expires_at - 60 s`; on 401; **persist the rotated refresh token before resolving** (Portal reuse detection revokes on replay); foreground-only; `session_expired` sets `needsLogin`
- [ ] Hermes Cloud discovery for kind `cloud`, ported from upstream `apps/desktop/electron/connection-config.ts` (`resolveRemote`)
- [ ] Logout: `POST /auth/logout` best effort, then clear SecureStore entries

## Deliverables

- `modules/loopback-listener/`, `src/net/auth/{native-login,loopback-listener,token-refresh}.ts`

## Exit criteria

- `[physical]` Portal login completes via Custom Tabs on a real device (decision D1: whether the
  device browser redirects to `http://127.0.0.1:<port>` is OEM-dependent).
- Access-token expiry triggers a silent refresh.
- Refresh-token expiry produces exactly one "sign in again" prompt.
- Logout clears every SecureStore entry for the connection.
