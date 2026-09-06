# M11 — Push plugin + voice

**Status:** todo
**Depends on:** M07
**Goal:** Backgrounded approvals and finished turns arrive as push notifications; voice input and output work.

## Push design (no upstream change)

Hermes loads plugins from `~/.hermes/plugins/<name>/`. A plugin can observe
`pre_approval_request` and `on_stream_end` (upstream `hermes_cli/plugins.py`, `VALID_HOOKS`)
and can mount REST routes at `/api/plugins/<name>/` via `dashboard/manifest.json` with an `api`
file (upstream `hermes_cli/web_server_dashboard.py`). Those routes sit behind the normal auth gate.

## Tasks

- [ ] `server-plugin/hermes-push/plugin.yaml` and `__init__.py`: `register_hook("pre_approval_request", ...)`, `register_hook("on_stream_end", ...)`; publisher POSTs to `https://exp.host/--/api/v2/push/send` with `{ kind, session_id, title }` only, never message content
- [ ] `server-plugin/hermes-push/dashboard/manifest.json` and `dashboard/api.py` router: `POST /devices { token, platform, label }`, `DELETE /devices/{id}`, `POST /devices/{id}/presence { foreground }`; registry at `~/.hermes/hermes-push/devices.json`; push only to devices whose last presence is background
- [ ] Install doc: copy the folder to `~/.hermes/plugins/hermes-push/`, restart `hermes serve`, verify `GET /api/plugins/hermes-push/devices`
- [ ] `src/push/register.ts`: Expo push token registered on login and on rotation (needs an EAS project id); `handlers.ts`: tap opens `hermes-android://session/<id>`; presence sent on AppState changes; settings toggle; graceful degradation when the route 404s (plugin absent)
- [ ] `src/voice/recorder.ts`: `expo-audio` records m4a; `POST /api/audio/transcribe { data_url, mime_type }` (upstream `hermes_cli/web_routers/audio.py`); result inserted into the composer
- [ ] `src/voice/tts.ts`: `POST /api/audio/speak { text }` returns a data URL; write to a temp file and play; `GET /api/audio/voice-config` for client-direct providers; PCM streaming from `/api/audio/speak-stream` is a stretch item

## Deliverables

- `server-plugin/hermes-push/**`, `src/push/**`, `src/voice/**`, `app/(main)/settings/{notifications,voice}.tsx`

## Exit criteria

- Screen off 30 minutes; an approval arrives as a push; tapping opens the card and responding succeeds.
- No push is sent while the app is foregrounded.
- Dictation inserts transcribed text into the composer.
- A reply is spoken via TTS.
