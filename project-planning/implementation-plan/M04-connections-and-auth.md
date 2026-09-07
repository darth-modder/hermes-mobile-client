# M04 — Connections + token/password auth

**Status:** in-progress
**Depends on:** M03
**Goal:** Add a gated backend, sign in with a password provider, persist and reuse the session.

## Tasks

- [x] `src/connections/types.ts`: `MobileConnection { id, kind: 'remote' | 'cloud', label, baseUrl, authMode: 'token' | 'password' | 'oauth', provider?, headerNames?, installId?, lastUsedAt?, needsLogin? }`
- [x] `src/connections/registry.ts` (MMKV; one active connection in v1) and `secure.ts` (`expo-secure-store` keys `conn.<id>.token`, `conn.<id>.oauth`, `conn.<id>.header.<name>`)
- [x] `src/net/auth/probe.ts`: `GET /api/health` (`auth_required`), `GET /api/auth/providers` (`[{name, display_name, supports_password}]`), then after auth `GET /api/status` (`install_id`) and `GET /api/auth/me`
- [x] `src/net/auth/password-login.ts`: `POST /auth/password-login { provider, username, password }` (non-native path sets session cookies); all fetches use `credentials: 'include'`; WS ticket via `POST /api/auth/ws-ticket`
- [x] `src/net/auth/ladder.ts` — see Deviations: a from-scratch, testable port of the *pattern* in
      `native-auth-decisions.ts` (OAuth-only, M08) rather than a literal port of that file — 401 →
      refresh/relogin once → retry → still 401 → `needsLogin`; 403 → stop; anything else → backoff,
      never reauth; WS close 4401/4403 follow the same ladder
- [x] Screens: `app/connect/index.tsx` (URL, label, auto-detect auth mode), `app/connect/scan.tsx` (QR via `expo-camera`, payload `hermes-android://connect?url=...&token=...`), `app/connect/[id]/login.tsx`
- [x] Per-connection extra proxy headers (e.g. Cloudflare Access) on fetch and on the WebSocket `{ headers }` third argument

## Deliverables

- `src/connections/*`, `src/net/auth/{probe,password-login,ladder}.ts`, `app/connect/*`

## Deviations from the literal spec (and why)

1. **`ladder.ts` is not a literal port of `native-auth-decisions.ts`.** That file is entirely
   OAuth-specific (bearer-vs-cookie routing, native session liveness, the oauth pre-flight guard) —
   M04 covers token and password auth only; OAuth is M08. What's carried over is the file's own
   stated reason for existing: small, pure, individually-testable decision functions instead of one
   branchy reauth method, because each of its six named functions there pins a contract that was
   once a real runtime bug. `classifyFailure` / `nextReauthAction` are that same style, built
   directly from AGENTS.md's "Credentials and reauth" rule (which is itself the literal ladder text)
   rather than from OAuth-specific code that doesn't apply yet.
2. **The ladder is built and unit-tested but not wired into a live reauth loop.** For token and
   password mode there is no silent refresh to attempt (no refresh-token endpoint exists for
   either — only OAuth's `/auth/native/refresh`, M08), so `refresh()` is currently a caller-supplied
   function; every 401 in this milestone's own screens goes straight to a login-again UI without
   calling the ladder, because a first-time login attempt failing is not a reauth (there is no prior
   session to refresh). Wiring `runWithReauthLadder` around the live gateway connection's request
   path is M06/M07's job, once there's a persistent session whose 401s need handling live; M04
   delivers the ladder itself, fully tested against the contract, ready for that wiring.
3. **`app/connect/index.tsx` does not complete an OAuth-gated backend.** Auto-detect correctly
   identifies one (a gated backend with no password-supporting provider advertised) and says so
   in-line; signing in against it is M08.
4. **`docs/CONNECTING.md` gained the WSL2 build recipe it was supposed to have from M01.** M01's own
   task list says this file documents "the WSL build path", but the committed file only ever had the
   Windows-PowerShell env-var recipe — the WSL section never actually made it into that commit.
   Filled in from M01's own milestone file (which has the full recipe) plus this milestone's own
   dev-loop needs (gated-mode `10.0.2.2` addressing from the emulator, the
   `HERMES_DASHBOARD_BASIC_AUTH_*` non-interactive provider setup used for on-device verification
   below). Not a change to M01's status or content — just completing a doc gap this milestone needed
   filled to build at all.

## Exit criteria

- [x] Password login over LAN to `hermes serve --host 0.0.0.0` with the basic-auth provider succeeds.
- [ ] `[physical]` Cookies survive app kill and relaunch (`GET /api/auth/me` still 200). Emulator
      evidence is welcome but does not close this one (decision D1): cookie-jar persistence across
      process death differs across OEM WebView builds. Not attempted this session — no screen
      currently re-checks an existing session on launch (that's M07's session-restore lifecycle);
      see Verifier findings.
- [x] WS dials with the ticket subprotocol and the server echoes `hermes-gateway-v1`.
- [x] Wrong password produces one error and no retry storm.
- [x] Token mode still works via `adb reverse`.

## Verifier findings

1. **The `[physical]` cookie-persistence criterion needs a real device, and additionally wasn't
   exercised at all this session (not even for emulator evidence).** None of this milestone's
   screens re-probe an existing session on launch — `app/connect/index.tsx` always starts from a
   blank "add a connection" form, and there's no "resume last connection" check yet (that's the
   session-restore lifecycle M07 owns). Kill-and-relaunch evidence would need a small ad hoc probe
   screen to be worth collecting; given the box can't close on emulator regardless (decision D1),
   that wasn't built this session. A physical device is required to close this criterion; M07's own
   session-restore screen is a natural place to make it directly observable without extra scaffolding.

## Verification log

### 2026-09-07 — `npm run check`

```
> hermes-android@1.0.0 check
> npm run typecheck && npm run test && npm run lint

> hermes-android@1.0.0 typecheck
> tsc -p . --noEmit

> hermes-android@1.0.0 test
> vitest run

 RUN  v4.1.10 D:/Stuff/Code/git/hermes-android

 Test Files  15 passed (15)
      Tests  104 passed (104)

> hermes-android@1.0.0 lint
> eslint .
```

All three steps exited 0. `ladder.test.ts` (17 cases) covers the full contract: 401→retry→success,
401→refresh-declines→NeedsLoginError, 401→retry-still-401→NeedsLoginError (refresh called exactly
once), 403→ForbiddenError (never retried, never refreshed), 5xx and a bare network error both
back off (rethrow as-is, never call refresh), and WS close 4401/4403 follow the identical ladder as
their HTTP equivalents. `password-login.test.ts` and `probe.test.ts` cover the REST contracts
against a mocked `fetch`; `registry.test.ts` covers the MMKV-backed connection store.

### 2026-09-07 — WSL2 build

`./gradlew assembleDebug --no-daemon` (WSL2 Ubuntu-26.04, JDK 21, Linux SDK — see `docs/CONNECTING.md`,
filled in this session): `BUILD SUCCESSFUL in 18m 55s`, 754 actionable tasks (722 executed, 32
up-to-date). `react-native-mmkv` and `expo-camera`'s native modules compiled cleanly (first time
either has been built in this project). `android/app/build/outputs/apk/debug/app-debug.apk` —
259,025,748 bytes.

### 2026-09-07 — on-device verification (live, `emulator-5554`)

`adb install -r app-debug.apk` → `Success`. Dev-client launched via
`am start -a android.intent.action.VIEW -d "hermes-android://expo-development-client/?url=..."`,
Metro bundled `1462 modules` in `5046ms`.

Two throwaway `hermes serve` instances, both torn down immediately after this verification:
- Loopback token mode: `hermes serve --host 127.0.0.1 --port 9119` with a locally-generated
  `HERMES_DASHBOARD_SESSION_TOKEN` (scratch file outside the repo, never logged/committed), reached
  from the device via `adb reverse tcp:9119 tcp:9119`.
- Gated password mode: `HERMES_DASHBOARD_BASIC_AUTH_USERNAME=tester
  HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=<scratch-generated> hermes serve --host 0.0.0.0 --port 9130`
  (the non-interactive env-var setup documented in `docs/CONNECTING.md` this session), reached from
  the device at `http://10.0.2.2:9130` — the Android emulator's host-loopback alias — with no
  `adb reverse` needed. Verified independently via `curl`/`fetch`/raw-`WebSocket` before the
  on-device pass: wrong password → 401, correct password → 200 + three `Set-Cookie` headers
  (`hermes_session_at`/`_rt`/`_provider`, all `HttpOnly`), `GET /api/auth/me` with the cookie → 200,
  `POST /api/auth/ws-ticket` → a ticket, and a raw ticket-mode `WebSocket` dial against
  `dial.ts`'s exact protocol array echoed `hermes-gateway-v1` back.

**Token mode** (deep-linked `hermes-android://connect`, per M02's established pattern): typed
`http://127.0.0.1:9119`, tapped **Detect auth mode** → `"Ungated backend (version 0.21.0) — token
mode."`, entered the scratch token, tapped **Connect** → `"Connected —
install_id=6108361491d941b3b7df5c317a8c3da3"` — the same `install_id` `/api/status` reports for
this install. Screenshot: [docs/m04-token-connected.png](../../docs/m04-token-connected.png).

**Password mode auto-detect**: changed the URL to `http://10.0.2.2:9130`, tapped **Detect auth
mode** → `Gated backend — password sign-in via "Username & Password".` and a **Sign in** button
appeared (no token field — the screen correctly branches on the detected mode). Screenshot:
[docs/m04-detect-gated.png](../../docs/m04-detect-gated.png).

**Wrong password**: username `tester`, a deliberately wrong password → `"Incorrect username or
password."`, read back via `uiautomator dump` (not judged by eye). Read exactly this text once, in
place — no repeated/duplicate error, no loop. This is a structural guarantee, not just an
observation: `passwordLogin()` makes exactly one `fetch` call per invocation (no retry loop
anywhere in the function), `submit()` in `app/connect/[id]/login.tsx` calls it exactly once per tap,
and `password-login.test.ts`'s "401 rejects with exactly one PasswordLoginError, no retry storm"
case pins `fetchMock` to `toHaveBeenCalledTimes(1)`. (A same-IP rate-limit probe from the host
turned out not to double as request-count evidence for the on-device attempt specifically — the
emulator's `10.0.2.2` NAT hop means the server sees it under a different apparent source IP than the
host's own `curl` calls, so the two share no rate-limit bucket. The structural + unit-test evidence
above is the real proof here, not the probe.)

**Correct password**: same field, replaced with the real scratch-generated password → `"Connected"`
/ `http://10.0.2.2:9130` (the screen's success state; `probeStatus()` — which needs the cookie jar
to succeed — is called before this state renders, so reaching it already proves the cookie round
trip worked). Tapped **Test WS ticket dial** (a small on-screen check added this session, exercising
`mintWsTicket()` + `dial.ts`'s exact ticket-mode `createGatewaySocketFactory()` — the same function
`MobileGateway.connect()` uses) → `"WS open — echoed subprotocol: hermes-gateway-v1"`. Screenshot:
[docs/m04-ws-ticket.png](../../docs/m04-ws-ticket.png).

All screenshots referenced above are in [docs/](../../docs/). Metro and the emulator were left
running after this session (no secrets held); both throwaway `hermes serve` processes and their
scratch token/password files were torn down/deleted immediately after the pass above.
