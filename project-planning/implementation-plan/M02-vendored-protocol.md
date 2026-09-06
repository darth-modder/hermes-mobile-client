# M02 — Vendored protocol

**Status:** todo
**Depends on:** M00
**Goal:** Upstream transport and chat-message code compiles under Metro/Hermes and is refreshed by one command.

## Tasks

- [ ] `scripts/sync-upstream.mjs`: reads `HERMES_AGENT_ROOT` (default `../hermes-agent`); explicit allow-list; fails loudly on a missing file; rewrites `@/` imports to relative paths; writes `src/upstream/UPSTREAM.json` `{repo, commit, syncedAt, files[]}`
- [ ] Allow-list (upstream paths):
  - `apps/shared/src/json-rpc-gateway.ts`, `websocket-url.ts`, `skin.ts`, `backend-scope.ts`, `cron-trigger-controller.ts`
  - `apps/shared/src/json-rpc-gateway-replay.test.ts`
  - `apps/desktop/src/types/hermes.ts`
  - `apps/desktop/src/lib/chat-messages/{types,parts,tool-parts,reconciliation,hydration}.ts`
  - `apps/desktop/src/lib/{gateway-events,reconnect-backoff,with-timeout,keyed-timeouts,text,todos,error-surface,embedded-images,generated-images}.ts`
- [ ] Programmatic patches applied by the script (each asserted to match, so upstream changes surface):
  - `json-rpc-gateway.ts` lines ~357 and ~407: `new DOMException('Aborted', 'AbortError')` becomes an `Error` with `name = 'AbortError'`
  - `chat-messages/types.ts` line 1: type-only import from `@assistant-ui/react` becomes a local structural type
  - `chat-messages/parts.ts` line 1: `mediaDisplayLabel` / `mediaMarkdownHref` come from `src/lib/media.ts`
  - `gateway-events.ts` line 1: inline the one type imported from `@/app/shell/statusbar-controls`
  - `json-rpc-gateway.ts` `fetchReplay`: emit a synthetic `replay.truncated {session_id, latest_seq}` event when `session.events.since` returns `truncated: true`
- [ ] ESLint `no-restricted-globals` (`window`, `document`, `localStorage`, `navigator`) on `src/upstream/**` and `src/gateway/**`
- [ ] `src/polyfills.ts`: runtime check for `URL`, `URLSearchParams`, `AbortSignal`, `WebSocket`; add `react-native-url-polyfill` only if the check fails
- [ ] `src/lib/media.ts`: pure port of the two media helpers the transcript reducer needs
- [ ] Vendored replay test runs under vitest

## Deliverables

- `scripts/sync-upstream.mjs`, `src/upstream/**`, `src/upstream/UPSTREAM.json`, `src/polyfills.ts`, `src/lib/media.ts`

## Exit criteria

- `node scripts/sync-upstream.mjs` twice in a row produces no diff.
- `npm run check` green, including the vendored replay test.
- A Hermes-engine runtime check screen logs `WebSocket`, `URL`, `URLSearchParams`, `AbortSignal` present.
