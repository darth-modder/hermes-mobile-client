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
| In-chat find (`find-bar.html`) | Absent — no search-within-transcript UI exists on mobile. That prototype's own header already says "Absent in v1 (PARITY: thinner)," but no row backed the claim; added on the M14 task-7 audit that checked | M14 Deviation, this entry |
| Haptics and sound | Reducer effects accepted and ignored | M13 (usability) |
| PDF attachment | Client path exists; unverified pending poppler on the server host | Register (D8) |
| Settings: Chat, Safety, Memory & Context | Read-only: each screen names its desktop fields (labels copied from the prototype, not vendored — see `src/lib/strings.mobile.ts`) but none can be read or changed here. Not a missing capability: the gateway has `config.get`/`config.set` (Personality, Show Reasoning, Approval Mode), `GET/PUT /api/config/raw` (the rest of config.yaml — the same endpoint `getHermesConfig`/`saveHermesConfig` wrapped before M09 dropped them), and a full Memory/Curator REST API (`/api/memory*`, `/api/curator*`). This app's client wraps none of it | M14 Deviations 8 &amp; 13; porting a client wrapper over an already-real gateway API is its own data-layer task, flagged for a D-entry |
| Settings: Billing | Informational only. Not a missing capability: `billing.state`/`subscription.*`/`usage.bars`/`session.usage`/`billing.step_up` are a complete gateway RPC surface (the gateway's own comment calls it "complete") — this app's client wraps none of it | M14 Deviations 8 &amp; 13; same D-entry |
| Command center (Usage) | Real screen, inert. Not a missing capability: `GET /api/analytics/usage` and `GET /api/analytics/models` are real, registered REST routes — this app's client wraps neither | M14 Deviations 8 &amp; 13; same D-entry |
| Agents | Real screen, inert. Not a missing capability: `delegation.status` (host-wide, not per-connection) plus `delegation.pause`/`subagent.interrupt`/`subagent.steer`/`spawn_tree.*` are a real cross-session RPC surface — this app's client wraps none of it | M14 Deviations 8 &amp; 13; same D-entry |

## Mobile has that desktop does not

- Push notifications for approvals while backgrounded (M11, pending the user's `eas init` and a
  device).
- On-device voice capture and playback through the server's audio endpoints (M11).

## Physical-device criteria still open

Listed in the deferred criteria register in the plan README. None is a functional gap; each is a
behaviour that an emulator cannot exercise (radio, doze, OEM cookie jar, Custom Tabs, push
delivery, real speech).
