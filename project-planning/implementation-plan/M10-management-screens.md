# M10 — Management screens

**Status:** todo
**Depends on:** M09
**Goal:** Projects, cron, webhooks, artifacts and messaging channels at desktop parity.

## Tasks

- [ ] Projects via `projects.*` RPCs (upstream `tui_gateway/methods_projects.py`), never local filesystem
- [ ] Cron via `/api/cron/*` (upstream `hermes_cli/web_routers/cron.py`) plus the `cron.changed` event; reuse vendored `cron-trigger-controller.ts`
- [ ] Webhooks via `/api/webhooks/*` and pairing via `/api/pairing/*` (upstream `hermes_cli/web_routers/ops.py`)
- [ ] Artifacts collected from tool events; open / share via the share sheet; `/api/files/download` for server files
- [ ] Channels via `/api/messaging/*` (upstream `hermes_cli/web_routers/messaging.py`) including Telegram / WhatsApp onboarding
- [ ] Drawer navigation in `app/(main)/_layout.tsx`: Sessions, Projects, Cron, Webhooks, Artifacts, Channels, Settings

## Deliverables

- `app/(main)/{projects,cron,webhooks,artifacts,channels}/**`, matching stores

## Exit criteria

- Create and trigger a cron job; `cron.changed` updates the list live.
- Webhook create / enable / delete round-trips.
- Pairing approve / revoke works.
- Artifact share opens the system share sheet with the file.
