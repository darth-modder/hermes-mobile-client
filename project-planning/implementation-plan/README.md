# Hermes Android — implementation plan

Expo / React Native **thin client** for Hermes Agent. The phone dials a remote `hermes serve`
over WebSocket JSON-RPC (`/api/ws`) and REST (`/api/*`). No agent logic runs on the device.

## Fixed decisions

| Decision | Choice |
|---|---|
| Agent location | Thin client only; dials a remote `hermes serve` (LAN / Tailscale / cloud). |
| Shell | React Native + Expo, new UI. Not a WebView of the desktop renderer. |
| Platform order | Android first; iOS from the same project (M12). |
| Scope | Near desktop parity for everything not machine-bound, delivered as milestones. |
| Push | Expo Push (FCM), published by a user-installed Hermes plugin that lives in this repo. |
| Upstream | `hermes-agent` is **read-only**. Protocol code is vendored by `scripts/sync-upstream.mjs`. |
| Session source | `"android"` (iOS: `"ios"`). The server passes it through and grants project-only toolsets. |

## Milestone tracker

Status: `todo` · `in-progress` · `blocked` · `done`. Update this table and tick the task boxes
in the milestone file as work lands. Every exit criterion is something that can be run or
observed. Criteria tagged `[physical]` must be run on a physical device before `done`; everything
else may be proven on the emulator (decision D1). Rule changes are logged in
[../DECISIONS.md](../DECISIONS.md); never rewrite an exit criterion in place without a D-entry.

| ID | Milestone | Goal | Depends on | Status |
|---|---|---|---|---|
| [M00](M00-repo-and-planning.md) | Repo + planning docs | The repo exists with this tracker committed | – | done |
| [M01](M01-toolchain.md) | Toolchain | A dev build installs on a phone from this machine | M00 | done |
| [M02](M02-vendored-protocol.md) | Vendored protocol | Upstream code compiles under Expo; sync is idempotent | M00 | done |
| [M03](M03-connection-spike.md) | Connection spike | Stream + reconnect replay proven on device | M01, M02 | done |
| [M04](M04-connections-and-auth.md) | Connections + token/password auth | A gated backend can be added and signed into | M03 | in-progress |
| [M05](M05-session-stream-reducer.md) | Session stream reducer | Gateway events reduce to state; desktop fixtures pass | M02 | done |
| [M06](M06-chat-screen.md) | Chat screen | Streaming chat with tool cards, approvals, attachments | M04, M05 | todo |
| [M07](M07-sessions-and-lifecycle.md) | Session management + lifecycle | Session list; survives background, doze, network switch | M06 | todo |
| [M08](M08-portal-oauth.md) | Portal OAuth | Nous Portal login via on-device loopback listener | M04 | todo |
| [M09](M09-settings-and-connections.md) | Settings + connections UI | Providers, models, MCP, skills, plugins, profiles, connections | M06 | todo |
| [M10](M10-management-screens.md) | Management screens | Projects, cron, webhooks, artifacts, channels | M09 | todo |
| [M11](M11-push-and-voice.md) | Push plugin + voice | Backgrounded approvals arrive as push; voice in/out | M07 | todo |
| [M12](M12-release-and-ios.md) | Release hardening + iOS | Signed release on Play internal track; iOS build | M08–M11 | todo |

Critical path: M00 → M01/M02 → M03 → M04 → M06 → M07 → M11 → M12. M05 runs in parallel with
M03/M04; M08, M09, M10 can run in parallel after M06.

## Architecture

```
Phone (Expo app)                              hermes serve (unchanged upstream)
  vendored JsonRpcGatewayClient  -- wss /api/ws -->  tui_gateway JSON-RPC 2.0 (+ per-session seq replay)
  fetch + Bearer / cookie jar    -- https /api/* --> FastAPI REST
  expo-notifications             <-- Expo Push --   hermes-push plugin (this repo -> ~/.hermes/plugins/)
```

## Target repo layout

```
project-planning/implementation-plan/   this tracker + M00...M12
package.json  app.config.ts  metro.config.js  babel.config.js  tsconfig.json  eslint.config.mjs  vitest.config.ts  index.ts
app/                       expo-router routes
src/upstream/              VENDORED from hermes-agent (sync script owns it) + UPSTREAM.json
src/gateway/               dial, MobileGateway, lifecycle, session-stream-reducer
src/net/                   http.ts, auth/{probe,password-login,native-login,loopback-listener,token-refresh,ladder}.ts
src/connections/           registry (MMKV), secure (expo-secure-store), types
src/store/                 nanostores atoms
src/api/                   REST helpers ported from apps/desktop/src/api
src/chat/                  Transcript, parts, cards, Composer, SlashPalette
src/lib/  src/push/  src/voice/
modules/loopback-listener/ Expo native module (Kotlin) for the RFC 8252 loopback redirect
scripts/sync-upstream.mjs  scripts/spike-gateway.mjs
server-plugin/hermes-push/ Hermes plugin: plugin.yaml, __init__.py, dashboard/manifest.json, dashboard/api.py
docs/CONNECTING.md  docs/ARCHITECTURE.md  AGENTS.md
```

## Auth matrix (zero server changes)

| Backend | Flow | Auth after login | Notes |
|---|---|---|---|
| Loopback bind (ungated) | Paste/QR session token | `Authorization: Bearer <token>`; WS `?token=` | Dev only via `adb reverse` / `ssh -L`: the server rejects non-loopback peers on a loopback bind, and any non-loopback Host forces gated mode. |
| Gated, password provider | In-app form, `POST /auth/password-login`, session cookies | Cookie jar (`credentials: 'include'`); the gate middleware refreshes | WS ticket via `POST /api/auth/ws-ticket`. |
| Gated, Nous Portal OAuth | RFC 8252: Custom Tabs to `/auth/native/authorize`, on-device `http://127.0.0.1:<port>` listener, then `POST /auth/native/token` | `Bearer <access_token>`; rotate via `POST /auth/native/refresh` | The server accepts only loopback redirect URIs, hence the listener (M08). |

## Upstream reference points (hermes-agent, read-only)

| Topic | Where |
|---|---|
| Transport client | `apps/shared/src/json-rpc-gateway.ts`, `websocket-url.ts` |
| Desktop gateway wrapper + timeouts | `apps/desktop/src/api/client.ts` |
| Gateway event handlers (to port) | `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event/*.ts` |
| Transcript reducer (to vendor) | `apps/desktop/src/lib/chat-messages/*.ts` |
| Slash command curation | `apps/desktop/src/lib/desktop-slash-commands.ts` (`NO_DESKTOP_SURFACE`) |
| Native notification policy | `apps/desktop/src/store/native-notifications.ts` |
| Reauth ladder | `apps/desktop/electron/native-auth-decisions.ts` |
| Desktop native OAuth (loopback) | `apps/desktop/electron/native-oauth.ts` |
| Cloud discovery | `apps/desktop/electron/connection-config.ts` (`resolveRemote`) |
| WS auth contract | `hermes_cli/web_server_chat.py` (`_ws_auth_reason`, subprotocol echo, peer/Host rules) |
| Auth routes | `hermes_cli/dashboard_auth/routes.py` (`/auth/native/*`, `/auth/password-login`, `/api/auth/ws-ticket`) |
| Session source / toolsets | `tui_gateway/server.py` (`_resolve_session_source`, `_gui_surface_toolsets`) |
| Attachment RPCs | `tui_gateway/methods_prompt.py` (`image.attach_bytes`, `file.attach`, `pdf.attach`) |
| Audio REST | `hermes_cli/web_routers/audio.py` |
| Plugin hooks | `hermes_cli/plugins.py` (`VALID_HOOKS`: `pre_approval_request`, `on_stream_end`) |
| Dashboard plugin API mount | `hermes_cli/web_server_dashboard.py` (`<plugin>/dashboard/manifest.json` mounts at `/api/plugins/<name>`) |
| Prior Capacitor spike (reference) | `apps/mobile/scripts/spike-gateway.mjs` |

## Risks

- Hermes JS engine gaps: no WebAssembly (no shiki), `DOMException` may be absent, URL polyfill may be needed. Checked in M02.
- Vendored code drifts from upstream. `UPSTREAM.json` plus an idempotent sync surfaces it.
- Some OEM browsers may not redirect Custom Tabs to `http://127.0.0.1`. Fallback is the password provider; a private-use scheme would need an upstream PR (out of scope).
- RN cookie persistence for password auth. Verified in M04; fallback is the loopback flow.
- Refresh-token rotation over flaky radios can force a re-login. Serialized, foreground-only refresh limits it.
- Markdown fidelity: no KaTeX/mermaid in v1.
