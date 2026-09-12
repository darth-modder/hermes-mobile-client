# Desktop parity

What the phone does that the desktop does, what it leaves out on purpose, and where it is
thinner. Assessed 2026-09-10 against `apps/desktop` at the commit in
`src/upstream/UPSTREAM.json`, with M00 to M10 done and M08, M11 in progress. The scope line
this is measured against is the plan's own: *near desktop parity for everything not
machine-bound* (`project-planning/implementation-plan/README.md`). Visual parity (fonts, icons,
colour) is M13's job and is not assessed here.

## At parity, verified on device

| Area | Mobile | Where verified |
|---|---|---|
| Chat | Streaming text and reasoning, markdown and code, tool cards with progress and diffs, approval / clarify / sudo / secret cards, image and file attachments, session header with model, usage and title | M06 |
| Sessions | List with search, pin, unread, new, delete, rename; background and foreground survival; reconnect and replay; backend restart; pending approvals restored on return | M07 |
| Settings | Providers and models, MCP servers, skills, plugins, profiles, connections with a test that names unauthorized vs forbidden vs unreachable | M09 |
| Management | Projects, cron, webhooks, artifacts with system share, messaging channels and pairing | M10 |
| Auth | Session token, password provider with cookies, Nous Portal OAuth via on-device loopback | M04, M08 |

## Absent by design

The phone dials; it never hosts (`AGENTS.md`). These desktop features drive the machine the
backend runs on and have no mobile equivalent:

- Terminal pane, embedded browser and preview, HUD, pet overlay, quick entry.
- Backend spawn, bootstrap and update; local filesystem and git; SSH connection kind; local
  models.
- `voice.*` and `wake.*` RPCs (they drive the server's microphone and speaker; mobile voice goes
  through `/api/audio/*` with on-device capture).
- Group chat rooms (Bot Mode groups), until the gateway offers a group transport to non-desktop
  sources. Bots themselves are **not** absent: profiles, canonical chats, souls, avatars and
  capabilities are ordinary gateway data and are M15's Bots tab (D16, 2026-09-12). Kanban is
  absent.

## Thinner than desktop

| Gap | State | Owner |
|---|---|---|
| Slash commands | Only `/stop`, `/compress`, `/title`, `/btw` have a mobile surface. About two dozen desktop commands answer "not available on mobile yet". Session, model, profile and skills commands have had screens since M07 and M09 but are still classified as unavailable | M13 (usability) |
| Markdown | No KaTeX or mermaid rendering; math and diagrams render as code blocks. No shiki: `lowlight` highlighting instead (Hermes JS has no WebAssembly) | Accepted for v1 (README risks) |
| `@` file completion | Completes only at the end of the text, not at the cursor | M06 Deviation #7, open |
| Haptics and sound | Reducer effects accepted and ignored | M13 (usability) |
| PDF attachment | Client path exists; unverified pending poppler on the server host | Register (D8) |
| Settings: Chat, Safety, Memory & Context | Read-only: each screen names its desktop fields (labels copied from the prototype, not vendored — see `src/lib/strings.mobile.ts`) but none can be read or changed here. Cause is M09, not M14: `getHermesConfig`/`saveHermesConfig` (the desktop's schema-driven config editor) were never ported, and `session-info.ts` drops `approval_mode` reconciliation on top for Safety specifically | M14 Deviation 8; porting `config.get`/`config.set` is its own data-layer task, flagged for a D-entry |
| Settings: Billing | Informational only — no billing/credits API exists on mobile at all (checked: nothing beyond the ephemeral mid-turn `BillingBlock` "out of credits" event, never queryable). Nothing to read or act on, so nothing is interactive | M14 Deviation 8; same D-entry |
| Command center (Usage) | Real screen, inert — `getUsageAnalytics` (the desktop's multi-gateway usage analytics) is confirmed unported (`src/api/models.ts`'s own header) | M14 Deviation 8; same D-entry |
| Agents | Real screen, inert — no cross-session subagent feed exists on mobile (a session's own delegations already reach this app as chat tool cards, per-session; nothing aggregates across sessions the way the desktop's own `store/subagents` does) | M14 Deviation 8; same D-entry |

## Mobile has that desktop does not

- Push notifications for approvals while backgrounded (M11, pending the user's `eas init` and a
  device).
- On-device voice capture and playback through the server's audio endpoints (M11).

## Physical-device criteria still open

Listed in the deferred criteria register in the plan README. None is a functional gap; each is a
behaviour that an emulator cannot exercise (radio, doze, OEM cookie jar, Custom Tabs, push
delivery, real speech).
