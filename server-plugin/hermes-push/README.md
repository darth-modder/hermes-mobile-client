# hermes-push

Expo push notifications for the Hermes Android/iOS client (M11). Backgrounded approvals and
finished turns reach the phone as a push; the client re-dials and hydrates as usual on tap. No
message, approval, or reply content ever leaves the server — every push body is
`{ kind, session_id, title }`.

## Install

1. Copy this folder into your Hermes plugins directory:

   ```bash
   cp -r server-plugin/hermes-push ~/.hermes/plugins/hermes-push
   ```

   On Windows, `~/.hermes` is `%LOCALAPPDATA%\hermes` (`hermes config get` or `HERMES_HOME`
   confirms the exact path on your machine).

2. Enable it — user plugins are opt-in (`plugins.enabled` in `config.yaml`):

   ```bash
   hermes plugins enable hermes-push
   ```

   You'll be asked whether to grant tool-override capability — say no; this plugin never
   registers a tool.

3. Restart `hermes serve` (or your gateway) so the plugin loads.

4. Verify the routes mounted, authenticated the same way any other `/api/*` call is (Bearer
   session token or cookie jar, depending on your auth mode):

   ```bash
   curl -H "Authorization: Bearer <your session token>" \
     http://127.0.0.1:<port>/api/plugins/hermes-push/devices
   # {"devices":[]}
   ```

   `hermes-agent`'s own log (`logs/agent.log`) will also show
   `Mounted plugin API routes: /api/plugins/hermes-push/` at startup.

## What it does

- **Registers devices.** `POST /devices { token, platform, label }` upserts an Expo push
  token (idempotent — the device id is derived from the token, so registering the same token
  again never creates a duplicate row). `DELETE /devices/{id}` unregisters one.
- **Tracks presence.** `POST /devices/{id}/presence { foreground: bool }` is the *only* thing
  that gates delivery — a device defaults to `"foreground"` on registration and is never
  pushed to until it explicitly reports `"background"`. This is deliberate: the client's
  socket can stay open for well past a minute after backgrounding (see the hermes-android
  decision log, D10), so socket/connection liveness is never used as a proxy for "the app is
  on screen."
- **Pushes on two triggers**, both explained in `watcher.py`'s module docstring:
  - a turn finishes or errors (`on_stream_end`, debounced so a multi-tool-call turn collapses
    into one push);
  - a gateway session gets a new pending approval — detected by polling
    `tools.approval.has_blocking_approval`, **not** the `pre_approval_request` hook. That hook
    is declared and registered (correct for CLI-interactive use) but never fires for a
    `source: "android"` gateway session; `watcher.py` documents the exact upstream code path
    that proves it.

## Storage

`~/.hermes/hermes-push/devices.json` — plain JSON, one row per device, token included (never
served back over the API — `GET`/`POST` responses redact it).

## Uninstall

```bash
hermes plugins disable hermes-push
rm -rf ~/.hermes/plugins/hermes-push
rm -rf ~/.hermes/hermes-push   # device registry
```
