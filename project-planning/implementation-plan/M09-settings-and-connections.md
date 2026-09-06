# M09 — Settings + connections UI

**Status:** todo
**Depends on:** M06
**Goal:** Manage providers, models, MCP, skills, plugins, profiles and connections from the phone.

## Tasks

- [ ] `src/api/*.ts` ported from upstream `apps/desktop/src/api/{config,models,profiles,sessions,skills,toolsets,mcp,messaging,plugins,system}.ts` onto `src/net/http.ts` (same endpoint map, direct fetch instead of Electron IPC); `@tanstack/react-query` for REST-backed screens
- [ ] `app/(main)/settings/index.tsx` and sub-screens: `providers`, `models`, `mcp`, `skills`, `plugins`, `profiles`, `connections`, `notifications`, `voice`
- [ ] Connections management: add / edit / test / delete, primary and last-used; the test exercises the authenticated leg (WS ticket), not just `/api/status`
- [ ] Profile switching scopes REST (`?profile=`) and `session.create.profile`
- [ ] Machine-bound settings hidden (local models, terminal backend, pool limits, updates)

## Deliverables

- `src/api/**`, `app/(main)/settings/**`

## Exit criteria

- A model switch is reflected in the next `session.info`.
- MCP server add and test succeed; skill toggle persists.
- A profile switch changes the sessions list.
- A failing connection test shows the ladder's reason (unauthorized vs forbidden vs unreachable).
