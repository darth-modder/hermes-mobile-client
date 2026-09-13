# M14 — Screen layouts from the desktop prototypes

**Status:** todo
**Depends on:** M13
**Goal:** Every mobile screen is laid out from its desktop counterpart: same sections in the same order, the same labels, the same controls, adapted to a phone by the rules below rather than by taste.

Added by decision D15 (2026-09-12). M12 depends on this milestone.

## Sources of truth

- `docs/DESKTOP-SCREENS.md`: every desktop screen, its route and its source files.
- `docs/DESKTOP-DESIGN.md`: the design system, with the §13 list of places the desktop's own
  docs and code disagree (follow the code) and §14's note on what a mobile port changes.
- `docs/desktop-prototypes/`: static HTML of every screen at 1220×800 on the `nous` skin. Serve
  it (`python -m http.server 8765 --directory docs/desktop-prototypes`), open a page with
  `?bare=1&theme=light` or `dark`, and read the comment block at the top of each page: it names
  the desktop source files it replicates, the sub-views, the measurements, the behaviour a static
  page cannot show, and whether `docs/PARITY.md` lists the screen as absent on mobile.
- Tokens, icons and type roles: M13 (`src/theme/*`, `src/lib/icons.ts`, `src/components/Codicon.tsx`).
- Labels: `apps/desktop/src/i18n/en.ts`, vendored as `src/upstream/i18n/en.ts` (D15.4).

## Adaptation rules (apply these; do not invent per screen)

| Desktop | Mobile | Notes |
|---|---|---|
| Window 1220×800, landscape | 360–412 dp wide, portrait, `useWindowDimensions` | Nothing fixed-width; columns stack |
| Sessions sidebar (237px, nav rows 28px, then session rows) | The M10 drawer: same nav rows in the same order with the same Tabler icons and labels, 48 dp tall; the session list is its own screen | The SESSIONS / BOTS strip becomes the Bots · Sessions · Tasks tab row (D16; see group C) |
| Titlebar 34px with the title and a control cluster | `ScreenHeader` 56 dp: back, title, up to two actions; overflow into a bottom-sheet menu | Same action order as the desktop cluster |
| Status bar 20px with model, gateway and context-usage pop-ups | Chat header chips: model chip opens the model picker sheet; usage chip opens the context-usage sheet; gateway state is the connection banner | The status bar itself is not ported |
| Full pages (Chat, Capabilities, Messaging, Artifacts) | Stack routes under the drawer | One route file per page, as today |
| Overlay screens (Settings, Command Center, Cron, Profiles, Agents, Webhooks) | Full-screen stack routes; the 13rem side nav plus content becomes a list screen then a detail screen | Settings index → section, as today |
| Overlay split layout | Two-level navigation | Never a side-by-side split on a phone |
| Dialogs with a form (profile, project, add URL, plugin install, memory provider) | Bottom sheet: elevated surface at 96%, `shadow-md`, `radius.sheet`, drag handle, actions at the bottom in desktop order | `Sheet` primitive in `src/components/Sheet.tsx` |
| Confirm dialog | Native `Alert` with the desktop's title, body and button labels; destructive button last and red | |
| Popover, dropdown, context menu | Bottom-sheet action list, same items in the same order | Right-click → long-press |
| Tooltip | Not ported; the label moves into `accessibilityLabel` | |
| Hover states (row hover, control hover, 100 ms) | Pressed state using `rowActive` / `controlActive`, 100 ms | No hover on touch |
| Hover-revealed controls (disclosure carets, row actions) | Always visible, or behind long-press when they are destructive | Nothing may exist only on hover |
| Keyboard shortcuts, key caps | Not ported | |
| Focus rings (none on desktop) | Not needed; inputs show focus by border, as desktop | |
| Chat thread: 48rem column, `px-6 py-8`, turn gap `.375rem` | Full width, 16 dp gutters, same turn and block gaps in dp | The inverted `FlashList` from M06 stays; the sticky user message is not ported |
| Composer: docked, fill card 72%, 1px ring at 7%, controls 24px, send 26px | Docked above the keyboard (`react-native-keyboard-controller`), same fill and ring rules, controls 40 dp with `hitSlop`, send 44 dp | Same control order left to right |
| Radius scale (near-square) | `radius.control 3`, `radius.icon 4`, `radius.card 5`, `radius.sheet 8`, `radius.full` | D15.1(b) |
| Type (13px body) | M13 roles: `body` 16, `bodySmall` 14, `label` 13, `caption` 12, `title` 20, `mono` 13 | |
| Touch | 48 dp minimum, `hitSlop` counted | M13 criterion 6 |
| Motion | Same durations where a transition exists (100 ms controls, 200 ms sheets); `Reanimated`; reduced-motion honoured via `AccessibilityInfo.isReduceMotionEnabled` | |

## Screen mapping

Every row is one prototype page. "Mobile route" is where the layout lands. "Adaptation" names the
rules above that apply beyond the defaults. Rows marked *absent* are not built (PARITY).

### A. Main screens

| Prototype | Mobile route | Adaptation |
|---|---|---|
| `a-main/chat.html` (conversation, streaming, new) | `app/(main)/sessions/[id].tsx` | Thread and composer rules; header chips replace the status bar; the "new chat" view is the empty state of a new session |
| `a-main/settings.html` (all sections) | `app/(main)/settings/index.tsx` + one route per section | Two-level; sections in the desktop's order from `settings/constants.ts`; **add** Chat, Safety, Memory & Context, Billing, Archived chats, About; **skip** Workspace, Browser, Advanced, Keybinds, Local models (machine-bound or keyboard-only) |
| `a-main/capabilities.html` (Skills, Toolsets, MCP) | `settings/skills.tsx`, new `settings/toolsets.tsx`, `settings/mcp.tsx` | The three tabs become three settings rows; the Skills Hub iframe is not ported |
| `a-main/messaging.html` | `app/(main)/channels/index.tsx` | List then detail |
| `a-main/artifacts.html` | `app/(main)/artifacts/index.tsx` | Grid becomes a list with the same card content |
| `a-main/command-center.html` (Sessions, Usage, System, Maintenance) | New `app/(main)/command-center/index.tsx` with Usage; Sessions is the session list | System and Maintenance are machine-bound: absent |
| `a-main/cron.html` | `app/(main)/cron/index.tsx` | Jobs list then job detail; templates as a sheet |
| `a-main/profiles.html` | `settings/profiles.tsx` | Dialogs become sheets |
| `a-main/agents.html` (subagent tree) | New `app/(main)/agents/index.tsx` | Tree as an indented list |
| `a-main/starmap.html` | *absent* (PARITY: thinner; learned skills and memories are reachable from Skills) | |
| `a-main/webhooks.html` | `app/(main)/webhooks/index.tsx` | List then detail |

### B. Panels

`b-panels/sessions-sidebar.html` → the drawer and the session list (`app/(main)/session-list.tsx`):
same row anatomy (lead cell, label, meta), pinned first, date dividers with the desktop's
uppercase style at the `caption` role. All other panels (files, review, terminal, logs, preview,
layout edit, zone editor, workspace tabs) are *absent* by design.

### C. Plugins (Bot Mode is in scope since D16; Kanban stays absent)

| Prototype | Mobile route | Adaptation |
|---|---|---|
| `c-plugins/bots-tab.html` (roster, user sections) | `app/(main)/bots/index.tsx` (M15 A) | The SESSIONS / BOTS strip becomes the drawer's first entry and a tab row Bots · Sessions · Tasks; roster rows keep the desktop anatomy (avatar, name, handle, preview, time); user sections become list headers |
| `c-plugins/bot-chat.html` (canonical chat, empty-chat view) | `app/(main)/sessions/[id].tsx` with the bot identity in the header (M15 A) | Same chat screen; the bot's avatar and handle replace the session title; the empty-chat view is the bot's empty state |
| `c-plugins/bot-dialogs.html` (New Bot, Edit bot/profile, avatar picker, model picker, MCP setup) | Sheets from the Bots roster and the bot settings sheet (M15 A) | Each dialog becomes a sheet with the desktop's fields in the desktop's order; the avatar picker keeps `blobatar` seeds |
| `c-plugins/routines.html` (Routines panel) | `app/(main)/tasks/index.tsx` (M15 C) | The right-edge panel becomes the Tasks tab |
| `c-plugins/group-chat.html`, `c-plugins/kanban.html` | _absent_ | Group rooms wait on a gateway transport for non-desktop sources; Kanban is absent by design |

The prototypes for these screens are M15's, drawn by Opus in `docs/mobile-prototypes/` from the
desktop pages above plus the field notes; M14 owns the primitives they use.

### D. Windows

`d-windows/login-window.html` → the connect flow (`app/connect/*`): same fields, order and labels.
All other windows are *absent*.

### E. Overlays

| Prototype | Mobile | Adaptation |
|---|---|---|
| `onboarding.html` | `app/connect/index.tsx` first-run | Steps become screens in the same order; the provider picker and API-key form are the desktop's, minus local providers |
| `gateway-connecting.html` | Connection banner + full-screen connecting state on the session screen | Same copy |
| `boot-failure.html` | The existing "Could not connect" error state, restyled | Same copy and actions |
| `command-palette.html` | *Not ported as a palette*; its actions are reachable from the drawer and the slash palette | Record in Deviations if any action has no home |
| `model-picker.html`, `model-visibility.html` | Model picker sheet from the chat header chip; visibility as a section of Settings › Models | |
| `session-picker.html`, `session-switcher.html` | The session list | |
| `mid-turn-prompts.html` | The M06 cards, restyled to the prototype | Structure unchanged (device-verified behaviour) |
| `find-bar.html` | *Absent* in v1 (PARITY: thinner) | |
| `updates.html`, `desktop-install.html`, `pet-generate.html`, `chat-swap-drop.html` | *Absent* | |

### F. Dialogs

`confirm.html` → native `Alert`. `profile-dialogs.html`, `project.html` → sheets with the desktop's
fields and labels. `worktree.html`, `real-browser-consent.html`, `remote-folder-picker.html`,
`profile-remote-override.html` → *absent* (machine-bound).

**Correction (close-out round 2, task 3):** this row originally also listed `add-url.html`,
`mcp-install-link.html`, `plugin-install.html`, `memory-provider.html`, and `send-diagnostics.html` as
sheets, and `archive-skill.html` as a confirm `Alert` on the Skills screen — none of the six were
ever built that way, and the spec line was stale against the app's own code the whole time. All six
are absent, each confirmed and cited in the route/component file that would have hosted them, not
device-tested (there is no UI to reach):

- `archive-skill.html` — absent from `settings/skills.tsx` (`skills.tsx:45-58`): the endpoint that
  exists (`uninstallSkillFromHub`) targets a different, permanent action on hub skills; the
  prototype's own "restorable" archive is for curator-*learned* skills, which this app has no memory-
  graph screen for at all. Left unbuilt rather than mislabeled. See Deviation 13 (§404-415).
- `add-url.html` — absent from `Composer.tsx` (`Composer.tsx:63-73`): no URL-fetch-and-attach RPC
  exists in `src/gateway/session-connection.ts`, and the composer has no "Add context" menu yet to
  host it. See Deviation 13 (§421-426).
- `mcp-install-link.html` — absent from `settings/mcp.tsx` (`mcp.tsx:41-49`): this app registers no
  `hermes://mcp/install` deep link. See Deviation 13 (§421-426).
- `plugin-install.html` — absent from `settings/plugins.tsx` (`plugins.tsx:24-32`): `src/api/
  plugins.ts` has no install-from-a-git-identifier call, only `listInstalledPlugins`. See Deviation
  13 (§416-420).
- `memory-provider.html`'s fields — absent as an interactive dialog; present only as one of
  `settings/memory.tsx`'s inert read-only rows (`memory.tsx:13-29`), part of the same config.yaml-not-
  ported gap as the rest of that screen. See Deviation 8 (§249-264).
- `send-diagnostics.html` — absent from `settings/about.tsx` (`about.tsx:40-55`): `t.sendDiagnostics`
  is vendored but nothing in `src/api/` calls a diagnostics-upload endpoint.

### G. Elements

`g-elements/primitives.html` → `src/components/ui/*`: Button (variants and sizes from
`DESKTOP-DESIGN.md` §8), Badge, Input, Switch, SegmentedControl, Tabs, Sheet, Menu, ListRow.
`banners.html` → `NotificationBanner` restyled. `statusbar-popups.html` → the two header sheets.

## Tasks

- [ ] Vendor `apps/desktop/src/i18n/en.ts` via `scripts/sync-upstream.mjs`; `src/lib/t.ts` reads it.
- [ ] `src/components/ui/*` primitives from `g-elements/primitives.html` and `DESKTOP-DESIGN.md` §8,
      each with a story-like test screen under `app/dev/primitives.tsx` (dev-only route).
- [ ] `Sheet`, `Menu` (sheet action list), `ListRow`, `ScreenHeader` overflow.
- [ ] Screens, in this order, one commit each: chat; session list and drawer; settings index and
      the existing sections; the six new settings sections; toolsets; command center (Usage);
      cron; profiles; webhooks; channels; artifacts; projects; agents; connect and onboarding;
      overlays (connecting, boot failure, model picker, context usage); dialogs to sheets and
      alerts.
- [ ] Every ported screen file starts with a comment block naming the prototype page it
      replicates and the adaptation rules applied.
- [ ] `docs/PARITY.md` updated for the added settings sections and the new screens.

## Exit criteria (emulator; none are `[physical]`)

- [ ] Every route file under `app/` (excluding `app/dev/`) has a `Replicates:` comment naming a
      prototype page; a unit test enumerates the route files and fails on a missing one.
- [ ] Labels: a unit test renders each ported screen with mocked data and asserts every visible
      string is a value from the vendored `en.ts` or a formatted data value; a retyped label fails.
- [ ] Drawer order: a test asserts the drawer's rows equal the desktop's sidebar nav order from
      `DESKTOP-SCREENS.md` §A with the Bots and machine-bound rows removed.
- [ ] Side-by-side: for each of chat, session list, settings index, one settings section, cron,
      profiles, mid-turn prompt and one sheet, the Verification log holds the prototype screenshot
      (`?bare=1`, both modes) next to the emulator screenshot, and a checklist per pair: same
      sections, same order, same labels, same control order, adaptation rules named.
- [ ] No hover-only affordance: a grep for `onHoverIn`/`onMouseEnter` returns nothing, and every
      desktop hover-revealed control listed in the prototypes' Behaviour blocks is either visible
      or reachable by long-press on device.
- [ ] Sheets and alerts: every desktop dialog in the mapping is reachable on device and its
      buttons carry the desktop's labels in the desktop's order.
- [ ] The M13 criteria still hold after the layout pass: hex grep empty, touch targets, font scale
      1.3×, colour match on the chat screen.

## Deviations from the literal spec (and why)

1. **~~Chat thread: one gap value, not two.~~ Resolved 2026-09-12.** Retried per review: the
   turn/block boundary is derivable from `role` alone — a role change (user→assistant or back)
   opens a new turn (6 dp); consecutive same-role messages are blocks inside one turn (12 dp). It
   didn't fail for tool-call/reasoning parts (they live inside one message's `parts` array, not as
   separate list rows, so they never hit this boundary at all). Implemented as `messageGap` in the
   new `src/chat/message-gap.ts` (pure, tested; split out of `Transcript.tsx` for the same reason
   as `drawer-rows.ts` below), wired into `Transcript`'s `renderItem` by comparing each row to
   `data[index + 1]` (the reversed list's next entry is the chronologically-older neighbour).
2. **Session-list lead-cell status dot is the existing unread dot, not the prototype's
   busy/warn/ok/bad states.** `sessions.html`'s `.s-row__lead` carries a live per-session status
   (streaming, needs-approval, idle, errored). The REST `SessionInfo` list (`GET /api/sessions`)
   this screen already runs on has no such field — it would need either a second per-row gateway
   subscription or a backend change, both out of scope for a layout milestone. Kept the row's
   existing unread signal in that slot instead of fabricating states with no data behind them.
   **Accepted as written (2026-09-12 review).**
3. **~~Drawer-order exit criterion needs a decision~~ Resolved 2026-09-12**, decision recorded in
   `docs/mobile-prototypes/sessions.html`'s "Drawer order" note and in `src/components/
   drawer-rows.ts`: derived as the desktop's nav strip in its own order (Capabilities, Messaging,
   Artifacts, Scheduled jobs — `sidebar.nav` in the vendored en.ts) → the ported overlay screens in
   `DESKTOP-SCREENS.md` §A order (Profiles, Agents, Webhooks, Command center) → Projects
   (mobile-only: the desktop keeps projects inside its session tree, not the nav) → Settings last.
   Bots/Sessions/Tasks are the M14 tab row (inside the session list screen), prepended to the
   drawer by M15 A, so the drawer-order test (`src/components/drawer-rows.test.ts`) asserts only
   from Capabilities down. `Agents` and `Command center` got minimal placeholder screens
   (`app/(main)/agents/index.tsx`, `app/(main)/command-center/index.tsx`) so the new drawer rows
   aren't dead links before this milestone reaches their own commits — both are in
   `route-replicates.test.ts`'s PENDING list, not yet `Replicates:`-commented.
   **Flagged, per the review: the criterion's "from `DESKTOP-SCREENS.md` §A" wording is loose (§A
   is a screen inventory, not a nav order) — needs a D-entry, not a silent rewrite of the
   criterion's text.**
4. **`docs/mobile-prototypes/sessions.html`'s date-divider and pinned-group grouping is not
   `Field:`-tagged (unlike its tab row, header subtitle and per-row preview elaborations), so it
   was built now**: `src/lib/session-groups.ts` (pure, tested) buckets into Pinned / Earlier today /
   Yesterday / a weekday name / a short date, matching the desktop's own divider granularity.
5. **Settings index group order needs a decision.** `docs/mobile-prototypes/settings.html`'s own
   header comment flags this: the four group labels shown (Host, Models and tools, App, Account)
   and the row order under them are the prototype's own *draft* — this app's pre-existing flat
   index order (Connections, Profiles, Providers, Models, MCP, Skills, Appearance, Notifications,
   Voice, Plugins) with M14's additions folded in, not the desktop rail's literal order (Model,
   Chat, Appearance, Workspace, Safety, Browser, Memory & Context, Voice, Advanced, Notifications,
   Billing | Providers…, Gateways, Keybinds, Tools & Keys, Plugins, Archived Chats | About). This
   criterion (line 58, "sections in the desktop's order from `settings/constants.ts`") is loose the
   same way the drawer-order §A wording was: it names an order that doesn't obviously survive the
   flat-rail-to-two-level-list adaptation. Implemented the prototype's drawn draft order for now
   (`src/components/settings-rows.ts`, pure, tested) so the index has a real, working layout;
   **flagging for a D-entry, not deciding it or rewriting the criterion.** Six sections (Chat,
   Safety, Memory & Context, Billing, Archived chats, About) and Toolsets have no row yet — each
   lands in its own later M14 commit — so today's group contents are a subset of the prototype's
   full draft, not a placement disagreement with it.
6. **Labels exit criterion (line 141-142) says a unit test "renders each ported screen" — implemented
   as a static source-scan instead**, per direction in the 2026-09-12 review ("Write the label test
   now, ratcheted like the Replicates one"). Rendering a `.tsx` screen isn't possible in this
   project's vitest setup at all (no `.tsx` component tests exist anywhere — see `drawer-rows.ts`'s
   header for why), so `src/lib/settings-labels.test.ts` parses each `app/(main)/settings/**/*.tsx`
   file with the TypeScript compiler's own AST (`ts.createSourceFile`) and asserts every string
   literal / JSX text node either equals a value from the vendored `en.ts` or is absent because it's
   imported from the one whitelisted module, `src/lib/strings.mobile.ts`. Same substance as the
   criterion (no retyped label survives), different verification mechanism. The same review found
   and fixed ten pre-existing violations across the settings batch this test now guards (`Enable
   push` → `t.settings.notifications.enableAll`, `Connections` → `t.settings.connections.title`
   ["Registered gateways"], etc.) — see the commit that added this test for the full list.
7. **Notifications: "Send test notification" and "Completion Sound" stay unimplemented, not
   half-wired.** Per the 2026-09-12 review ("no dead controls... wire it or omit it"): both need new
   plumbing `src/push/*` doesn't have today (a test-dispatch call; a sound-preset picker with audio
   preview) — layout-only work for M14 can't add that without also inventing the behaviour behind it,
   which is exactly what M14 is not supposed to do. Omitted rather than shown disabled or wired to
   nothing, so the screen never presents a control that silently does nothing when pressed.
8. **Chat, Safety and Memory & Context ship read-only, with no D-entry yet to close the gap.**
   Every field on all three desktop panels is either a config.yaml-schema value (the desktop's
   generic config editor — `src/api/config.ts`'s header already decided that editor isn't ported to
   mobile) or, for Safety's Approval Mode specifically, a value `session-info.ts`'s header says was
   dropped reconciling the desktop's session-info handler ("approval_mode reconciliation
   (profile-scoped desktop settings sync)"). Both gaps predate this milestone (M09), not introduced
   by it. Each screen now lists its desktop's field names and one-line descriptions as inert rows
   (2026-09-12 review: "teach what lives there, not just apologise") instead of only a notice
   paragraph, and the settings-index row for each carries a `Host-managed` value so a visitor knows
   before tapping, not after — both `src/lib/strings.mobile.ts` additions, since the field text is
   copied from `docs/desktop-prototypes/a-main/settings.html`'s markup, not the vendored `en.ts`
   (checked: `t.settings.fieldLabels`/`fieldDescriptions` are typed for exactly this in
   `src/upstream/i18n/types.ts` but both are empty objects in `en.ts` — the desktop's config-schema
   field text was never vendored as translatable data). Porting `config.get`/`config.set` (and,
   separately, `approval_mode` read access) is real data-layer work, not a layout task — **flagging
   for a D-entry to decide whether that's M15's or its own milestone, not deciding it here.**
9. **Milestone-level fact, not a per-screen note: six shipped screens are inert.** `settings/chat.tsx`,
   `settings/safety.tsx`, `settings/memory.tsx`, `settings/billing.tsx`, `command-center/index.tsx`
   and `agents/index.tsx` all render for real but cannot act — about one shipped screen in five, and
   they cluster in the management surface (Settings, Command center, Agents) a tester is likely to
   open first. Causes split three ways: config.yaml never got a mobile read/write path (M09, Chat/
   Safety/Memory), no billing API exists on mobile at all (Billing), and two desktop analytics/
   aggregation stores were never ported (`getUsageAnalytics` for Command center, `store/subagents`
   for Agents) — none introduced by this milestone, all pre-existing gaps M14's layout-only pass
   surfaced by finally building the screens that expose them. **Flagging for a D-entry with two
   options, not choosing between them:** (a) accept this state and schedule the data-layer catch-up
   (`config.get`/`config.set`, a usage-analytics endpoint, a cross-session subagent feed) as its own
   milestone or M15 slice, or (b) gate all six inert screens behind a flag for the first public build,
   shipping them only once real. `docs/PARITY.md`'s "Thinner than desktop" table carries all six as
   of this entry.

10. **The Section E "confirmed absent, nothing to build" cluster — checked each, not assumed.**
    `command-palette.html`: not ported as a palette (its actions reachable from the drawer and the
    slash palette, per the mapping); went through the prototype's own root list (empty-query) group
    by group against `src/components/drawer-rows.ts` and `src/lib/mobile-slash-commands.ts` rather
    than taking that for granted. Nearly every row has a home: Go to → drawer rows or `/new`/`/model`/
    `/profile`/`/skills`; Command Center → the command-center screen; Appearance → the appearance
    screen; the Commands group's layout/status-bar/tabs/terminal/logs toggles are the absent panels
    from Section B (not gaps); `/yolo` is deliberately `no-mobile-ui` (documented, not silent);
    Starmap is already recorded absent. One row does not have a home: **"No project"** (clearing the
    active project back to none) — `setActiveProject` (`src/api/projects.ts`) already accepts `id:
    null` for exactly this, but `app/(main)/projects/index.tsx` never calls it with `null`; there is
    no UI path to clear an active project once one is set. Recording rather than fixing here — task
    7 is the audit, not another screen pass.

    `find-bar.html`: the M14 doc's own summary table asserted this was "already noted in
    `docs/PARITY.md` as 'thinner'" — checked, and it wasn't; no PARITY row existed for it at all.
    Added one (`docs/PARITY.md`'s "Thinner than desktop" table) rather than leaving the claim
    uncorrected, per this task's own "genuinely new gap" carve-out.

    `updates.html`, `desktop-install.html`, `pet-generate.html`, `chat-swap-drop.html`: grepped
    `app/` and `src/` for anything referencing them (deep link routes, screen names, API calls) —
    nothing does. Confirmed absent, no action needed.

    `worktree.html`, `real-browser-consent.html`, `remote-folder-picker.html`,
    `profile-remote-override.html`: same grep, plus `t.profiles.remoteOverride` (en.ts) — vendored
    and fully shaped (connect/disconnect/status copy) but unused anywhere under `app/`. Confirmed
    absent, machine-bound per `AGENTS.md`'s "machine features don't exist here."
11. **Model picker (commit `6dcf460`): the outcome stands, its premise was wrong — corrected here,
    not by rewriting that commit.** "No session-scoped switch API exists" checked one layer
    (`ModelAssignmentRequest.scope: 'main' | 'auxiliary'`, no session field, in this app's own REST
    types) and drew a conclusion about a different layer (the gateway). It does not: `hermes-agent`
    (read-only, checked directly) has `tui_gateway/model_switch.py`, "Model switching for a live
    session: persist, snapshot/restore runtime, /model apply with guards," exposed as the RPC
    `slash.model` — confirmed in `tui_gateway/host_supervisor.py`'s gating table as `"idle-gated"`
    (between turns only, not mid-stream). `_persist_model_switch` additionally calls
    `save_config_value` on `model.default`, `model.provider`, and `model.base_url` — confirmed by
    reading the function directly — so a per-session switch through this RPC moves the *host's*
    default model too, not just that one session's. This app's mobile-slash-commands.ts routes
    `/model` to Settings › Models and never calls `slash.model` (checked: no reference anywhere
    under `src/`) — the REST-only reading in `6dcf460` was accurate for *this app's current wiring*,
    just not for "no session-scoped switch API exists" as a general claim, which is what a future
    milestone would inherit from that commit message alone.

    The M14 decision itself doesn't change: no sheet was built, and none should have been — a sheet
    that looked like a per-session picker while actually calling nothing (since nothing here calls
    `slash.model`) would still misrepresent what the tap does. **Flagging for a D-entry, not
    deciding it:** M15 B's composer model chip is feasible via `slash.model`, but wiring it means
    someone must first choose whether a per-chat pick moving the host's default (a side effect this
    app's UI would need to disclose, or the gateway would need to stop doing) is acceptable — a
    product/gateway decision, not a layout one. `slash.model` is not wired anywhere in this app as
    of this entry.
12. **Profile detail/SOUL editor: not delivered in M14, and the premise is corrected here.**
    `settings/profiles.tsx`'s own comment said the SOUL.md field (Create) and the detail pane (SOUL
    editor, per-profile stats) were absent because `src/api/profiles.ts` has no `soul`/`description`/
    `model` field and no detail-read call — true, and checked (`ProfileCreatePayload` in
    `src/upstream/types/hermes.ts` has none of those fields). That checked the client REST wrapper
    only. The gateway (`hermes-agent`, read-only) has the full data layer already: `profiles.describe`
    (RPC 5063) returns `soul` (full `SOUL.md` text), `description`, `model` `{provider, default}`,
    `skills`, `toolsets`, `mcp_servers` in one call; `profiles.configure` (RPC 5064) writes `soul`,
    `description`, `model`+`provider`, `disabled_skills`, `enabled_toolsets`, `enabled_mcp_servers`
    (sections independent, `applied` reports each); `profiles.create`'s params already include `soul`,
    `model`+`provider`, `description`; `profiles.set_asset`/`get_asset` (RPC 5065/5066) handle avatar
    upload/read. All five read directly, not inferred. **Not wired — souls, description, model and
    avatars are M15 A's bot-settings data layer, and this is the whole of it.** Recording this so M15 A
    starts from "the gateway already does this," not from `profiles.tsx`'s own comment reading as
    "impossible."
13. **Gateway re-audit of Deviations 8–10's "no API" claims: every one of them checked the client only.**
    Per the standing rule this session now follows (name the layer searched; check the gateway before
    writing "no API"), each claim below was re-checked directly against `hermes-agent` (read-only). None
    of these are wired as a result of this entry — this corrects the *reason* six screens are inert (or
    one dialog is absent), not the *fact* that they still are, today.
    - **Chat — Personality, Show Reasoning.** Both have a real gateway RPC pair: `config.get`/
      `config.set` (`tui_gateway/methods_config.py` / `methods_config_set.py`) dispatch on keys
      `"personality"` and `"reasoning"`, both with a getter *and* a setter. Corrected: these two fields
      are not config.yaml-only:no-mobile-port; they're a wrapped-nowhere RPC pair.
    - **Chat — Timezone, Image Input Mode.** No dedicated `config.get`/`config.set` key for either
      (checked both dispatch tables in full). `Image Input Mode` in particular isn't a stored setting
      at all — `decide_image_input_mode` (`agent/image_routing.py`, referenced from
      `tui_gateway/prompt_turn.py`) computes it automatically. These two premises hold as originally
      stated.
    - **Safety — Approval Mode.** Same `config.get`/`config.set` pair, key `"approval_mode"` (also
      aliased `"approvals.mode"`). Corrected: `session-info.ts` dropping *reconciliation* (a live push
      of the current value) is real and unrelated — a read/write RPC exists regardless of whether this
      app's session-info handler mirrors it passively.
    - **Safety — Approval Timeout, Confirm MCP Reloads, Command Allowlist, Redact Secrets, Allow
      Private URLs, File Checkpoints; Chat — Timezone; all of Memory & Context's config.yaml-backed
      fields.** No per-field RPC key exists for any of these — but `GET/PUT /api/config/raw`
      (`hermes_cli/web_routers/analytics.py`) reads and writes the *entire* `config.yaml` as text in
      one call each way. This is, verified by reading the route handlers directly, the same endpoint
      this app's own `getHermesConfig`/`saveHermesConfig` wrapped before M09 dropped them (per your own
      check of `src/api/config.ts`). Corrected: "no read or write path" is wrong for every field that
      lives in `config.yaml` — the gap is entirely the dropped client wrapper, not any missing
      capability. A mobile UI over raw YAML is real product-scoping work (which fields, what widgets),
      not a data-layer gap — still not M14's to build, but the premise "the data isn't there" is wrong.
    - **Memory & Context — Memory, User Profile, Memory Provider, Context Engine, Auto-Compression,
      Compression Threshold.** Beyond the raw-config path above, there's a *dedicated* REST surface:
      `GET /api/memory`, `PUT /api/memory/provider`, `POST /api/memory/reset`,
      `GET/PUT /api/memory/providers/{name}/config`, `POST /api/memory/providers/{name}/setup`
      (`hermes_cli/web_routers/ops.py`, `memory_providers.py`), plus `GET /api/curator`,
      `PUT /api/curator/paused`, `POST /api/curator/run` (`hermes_cli/web_routers/status.py`) — a
      complete, purpose-built API, not just the generic raw-config fallback. `src/api/system.ts`'s
      header names these same operations (`getMemoryStatus`/`resetMemory`/`getCuratorStatus`/
      `setCuratorPaused`/`runCurator`/`getMemoryProviderConfig`/`saveMemoryProviderConfig`) and was
      right that this app's client never wraps them — but the endpoints it's describing are real REST
      routes, not a capability that stops at "no named M09 sub-screen."
    - **Billing.** `tui_gateway/billing_view.py` plus RPCs registered in `server.py`'s own comment
      ("billing/subscription/usage = blocking portal (+Stripe) round-trips; **complete**"):
      `billing.state`, `subscription.state`/`preview`/`change`/`resume`/`upgrade`, `usage.bars`,
      `session.usage`, `billing.step_up`. This is a finished feature server-side. Corrected: "no
      billing/credits API exists on mobile at all" is wrong — no billing/credits API is *wrapped by
      this app's client*, which is a different, much narrower claim.
    - **Command center (Usage).** `GET /api/analytics/usage` and `GET /api/analytics/models`
      (`hermes_cli/web_routers/analytics.py`) are real, registered REST routes. Corrected:
      `getUsageAnalytics` isn't unported because the desktop's capability doesn't exist for mobile to
      call — the REST endpoint is sitting there; `src/api/models.ts`'s header describes the client
      side accurately but the screen's Replicates comment overstated it into "no usage API."
    - **Agents.** `tui_gateway/methods_session.py` (header: "Session / delegation / spawn-tree /
      billing / pet JSON-RPC handlers") registers `delegation.status` — returns
      `dt.list_active_subagents()` with no session-scoping in the handler, i.e. host-wide, not
      per-connection — plus `delegation.pause`, `subagent.interrupt`, `subagent.steer`,
      `spawn_tree.save`/`list`/`load`. Corrected: "no cross-session subagent store exists anywhere
      under `src/gateway` or `src/store`" was true of this app's own code and false as a claim about
      the gateway — `delegation.status` is exactly the cross-session aggregation this screen said
      didn't exist.
    - **`archive-skill.html` (Deviation 10 / commit `db13ce7`).** `src/api/skills.ts` genuinely has no
      archive endpoint for *hub-installed* skills (toggle/install/uninstall only) — checked, still
      true. But the prototype itself isn't about those skills: its own header says
      "Screen: Archive skill confirm ... from Capabilities → Skills (**and the memory graph**)" and
      "Restorable via `hermes curator restore`" — this is the curator's auto-*learned* skills, and the
      gateway has exactly that action: `learning.delete` (`tui_gateway/methods_tools.py`, dispatched
      via `_learning_mutation`; own comment: "delete → skills archived (restorable)"). Corrected: the
      capability isn't absent — it's for a skill population (curator-learned, surfaced via a "memory
      graph" this app has no screen for at all) that `settings/skills.tsx` was never going to be the
      right home for, archive endpoint or not. Building this dialog on the hub-skills screen would
      misapply an action meant for a different data set, so the outcome (not built there) still
      stands, for a different reason than originally written.
    - **`plugin-install.html` (Deviation 10 cluster).** `src/api/plugins.ts` genuinely has no install
      call — checked, still true of the client. But `POST /api/dashboard/agent-plugins/install`
      (`hermes_cli/web_routers/dashboard_ui.py`, params: `identifier`, `force`, `enable`) exists and
      does exactly what the prototype describes (install a plugin from a git identifier). Corrected:
      "no mobile API surface to build a real sheet on top of" is wrong — the surface exists, unwrapped.
    - **`add-url.html`, `mcp-install-link.html`.** Re-checked against the gateway specifically (not
      re-checked before): no URL-fetch-and-attach-as-context RPC exists anywhere in `tui_gateway`
      (grepped for `fetch_url`/`url_context`/`attach_url`/any `url.*` method — none), and
      `mcp-install-link.html`'s claim was about this app registering no `hermes://mcp/install` deep
      link at all, a client-side routing fact untouched by what the gateway can do. Both premises hold
      as originally written; no correction.
    - **Not re-litigated:** the model-picker correction (Deviation 11) already covers `slash.model`
      and isn't repeated here.
14. **~~Chat pairing table correction: approval/clarify cards are expected-absent (a known defect), not
    expected-present.~~ Superseded 2026-09-13.** An earlier version of this milestone's pairing table
    (this document's own 2026-09-13 review round) read `chat.html`'s `Field (ours): approval and
    clarify cards in the thread` line as this app already having them working, on the assumption
    "theirs" meant the desktop. It doesn't: that line compares against the *competitor* mobile app
    fielded in `docs/FIELD-NOTES-hermes-mobile-app-2026-09-12.md` (§3, row 20 — "Approval,
    `approvals.mode: manual`"), not `apps/desktop`. Verified by reading that row directly: the
    competitor app executed the risky command with no prompt at all; this app's own build showed
    **no card either — the turn hung for over 50 seconds** — and the row's own verdict is
    "**NEW task**: neither is right; ours must show a card." The desktop (`mid-turn-prompts.html`,
    this pairing's actual M14 source) does have a working approval card; this app's `ApprovalCard.tsx`
    (`src/chat/parts/ApprovalCard.tsx`) exists and is fed by `approval.request`
    (`src/gateway/session-stream/input-requests.ts`, both confirmed present) but did not render on
    device during that field test. Cause undetermined — whether `approval.request` fails to reach the
    session socket or arrives and isn't rendered is exactly what the pairing session (mid-turn prompt
    row) is for. No speculative fix attempted here or anywhere in this milestone pending that
    diagnosis, per direction.

    **Superseded by a reviewer device session (2026-09-13, M14/M13 device pass):** on the reviewer's
    own device, a turn that called a risky tool produced a live approval card roughly 5 seconds
    after the tool call, in both light and dark. Leaving the session and returning to it restored
    the same card rather than losing it. Pressing Reject cleared the card and returned the composer
    to idle. Approval/clarify cards are expected-present after all; nothing here indicates a
    rendering defect in `ApprovalCard.tsx` or `input-requests.ts`.

    Separately, in that same device session, a *first* attempt — where the model refused in text
    instead of calling a tool — correctly showed no card; that's expected behavior, not a defect,
    since no `approval.request` is ever sent for a turn that never calls a tool. What this does
    **not** establish is why the original field test's turn hung: whether that turn also refused in
    text (and something else caused the 50-second hang) or called a tool that produced no card is
    still undetermined — the claim that it "never called a tool at all" in an earlier version of
    this note was not verified and has been removed. See the Verification log below for a further
    wrinkle: a *second* request in the same reviewer session did log a tool turn and still showed no
    card.

15. **Composer: Stop and Steer moved to their own row, off `chat.html`'s inline layout.**
    `docs/mobile-prototypes/chat.html:157-159` keeps `Steer`/`Stop` inline in `.composer__controls`,
    alongside the input and the model/effort chips, with a comment noting mobile keeps Steer
    alongside Stop as-is (desktop parity; "theirs" — the competitor app — has Stop only). This
    milestone's device pass found that with both buttons showing, the four 48dp utility icons plus
    Stop and Steer left the input too narrow for its own placeholder on one line ("Messag/e Herme/s…",
    device-observed, see Verification log). Reproducing the prototype's flat inline row would need
    either dropping icons or the input shrinking further — neither acceptable — so `Composer.tsx` now
    renders Stop/Steer on a second row beneath icons+input, only while `busy`; the normal (Send-only)
    row is unchanged and still matches the prototype. A restyle, not a rebuild, per this document's
    own adaptation rule — but a real layout departure from the prototype's row structure, named here
    since M14's mapping table otherwise treats the composer as struct-unchanged.
16. **SessionHeader's model/effort line: corrected back to the prototype's plain-text subtitle,
    after one round briefly made it its own 48dp control.** `docs/mobile-prototypes/chat.html:62-73`
    puts only back / title+subtitle / two actions in the header, with the subtitle a plain
    `.header__sub` text node (`@researcher · mimo-v2.5`) — never its own button. Model/effort as
    *tappable chips* live in the composer instead (`chat.html:124-127`, `.composer__controls`),
    which this app doesn't build (Deviation 11: no session-scoped model-switch API to wire a chip
    to without silently moving the host's default). The M13 closing-fixes round's first attempt at
    SessionHeader's touch-target fix (commit `5623bdc`) missed this and gave the subtitle its own
    `TouchableOpacity` routing to Settings > Models, growing the header from 56dp to 96dp to fit
    two stacked 48dp targets — device-verified afterward as a regression: the two-line 56dp header
    look broke (back chevron and Compress floating mid-header over a band of empty space).
    Reworked (commit `e5e9682`) to match the prototype: the whole title column (title line +
    plain-text subtitle line) is now ONE `TouchableOpacity`, 56dp tall, that starts the rename — the
    same action the title
    alone used to trigger, just with the touch target that clears 48dp now being the full column
    instead of two competing sub-targets. The model line is plain text, not a control. Changing the
    model is still reachable exactly as before this fix existed: `/model` (routes to Settings >
    Models per `mobile-slash-commands.ts`, unchanged) and Settings > Models directly — nothing that
    worked before is gone, only the header's own extra tap target on the subtitle line.

17. **Composer placeholder: one fixed string, not the desktop's rotating set.** `chat.html`'s own
    composer keeps a single static placeholder, but the vendored desktop client this app ports from
    rotates through `composer.newSessionPlaceholders`/`followUpPlaceholders` in `en.ts` depending on
    whether the session is new or has prior turns. Commit `ee55803` (see the Labels exit-criterion
    entry above) gave this app its own fixed `COMPOSER_PLACEHOLDER = 'Message Hermes…'`
    (`src/lib/strings.mobile.ts:482`) instead, deliberately not wiring up the new-vs-follow-up
    rotation: none of the desktop's rotating options name the gateway the way this one does, and
    picking one turn's worth of copy to rotate through per session is product behavior, not a layout
    decision this milestone's pass should make unasked. A simplification, not a defect — flagging it
    here as a Deviation rather than leaving it undocumented.

## Verification log

#### Reviewer device session (2026-09-13, M14/M13 device pass)

These results come from the reviewer's own device session, not a run performed by the assistant.

All eight required side-by-side pairs — chat, session list, settings index, one settings section,
cron, profiles, mid-turn prompt, and one sheet — were present and checked in both light and dark
mode. The approval card was present and live (see Deviation 14's supersession above: it rendered
~5s after a real tool call, in both modes, survived leaving and re-entering the session, and Reject
cleared it correctly).

The same session surfaced defects, since fixed one-per-commit on this branch:

- Dark inline code derived from the light (`#141414`) seed in both modes instead of the desktop
  dark block's `#ffffff`-based `color-mix`.
- Cron detail: `relativeTime` treated `run.last_active` (epoch seconds) as milliseconds, rendering
  "20688d ago"; `last_run_at`/`next_run_at` rendered as raw ISO strings; Trigger now/Pause/Delete
  measured ~18dp with no hitSlop or minHeight.
- M13 criterion 6, taken literally (native size, not hitSlop-padded area): session-list's Open
  menu/Settings/New session/Pin measured 28-32dp; SessionHeader's Model control measured 40dp even
  with hitSlop; "Refresh profiles" measured ~38dp.
- Chat header showed "Untitled" for sessions opened from the list, whose REST title was already
  known — `$sessionStates` only picked up a title from a `session.title` event.
- The create-profile sheet let the underlying screen's text show through its top, in both modes —
  `Sheet`'s translucent `popover` background with no blur behind it.
- With Stop and Steer both showing, the composer's input shrank to ~80dp and its placeholder
  wrapped mid-word ("Messag/e Herme/s…").
- The connect screen's URL field was pre-filled with real text (`http://127.0.0.1:9119`), so typing
  appended to it instead of replacing it, producing "Invalid base URL".

One open item from that session, not chased down further here:

- After one Reject in a session, a second request in the same session logged a tool turn but showed
  no approval card; the model's own reply said the action was "blocked." Unexplained — possibly a
  server-side auto-deny following a prior reject, but not confirmed. Flagging it rather than
  guessing at a cause.

The other open item from that session — the Reasoning toggle and the tool-call row header never
measured on device — is now resolved:

Measured on device (2026-09-13, throwaway gateway, `uiautomator` bounds ÷ 2.625 at 420dpi): both
native boxes measured ~20.2dp, and each one's coded `hitSlop` (`bottom: 14, top: 14` —
`ReasoningDisclosure.tsx:26`, `ToolCallCard.tsx:59`) did not reliably add up to 48dp effective in a
real transcript. With a Reasoning block directly above a tool-call row (the ordinary shape of a
tool-using turn), taps in the two controls' overlapping hitSlop region resolved to whichever
control's zone the tap landed in rather than reliably the intended one; tapped directly, the
tool-call row's own bottom-edge hitSlop measured only ~3dp effective, not 14dp. Both were fixed
with `minHeight: 48` on the header (matching the other M14 touch-target fixes) so the native box
alone clears 48dp regardless of hitSlop reach or neighboring controls; re-measured after the fix,
both are 126px = 48.0dp native, and tapping within that native area reliably toggles the intended
control. Fixed in commit `582c02d`.

#### M13 closing pass (2026-09-13, throwaway gateway, device)

M13 exit criterion 6 taken literally — no clickable `uiautomator` node under 48×48dp, hitSlop not
counted — still failed in three more places, found and fixed this round:

- **SessionHeader** (`src/chat/SessionHeader.tsx`): the title touchable measured 24.0dp and the
  Model control 16.0dp. The first attempt at a fix (commit `5623bdc`, since reworked — see below)
  gave both their own `minHeight: 48` and grew the header's `minHeight` from 56 to 96 to fit two
  stacked 48dp targets. Device-verified as a regression: the two-line 56dp header look broke (back
  chevron and Compress floating mid-header over a band of empty space). Reworked (commit `e5e9682`)
  to match `docs/mobile-prototypes/chat.html:62-73` (back/title-subtitle/two actions in a 56dp
  header, subtitle a plain text node — never its own control): the whole title column (title +
  subtitle) is now one `TouchableOpacity`, 56dp tall, that starts the rename; the subtitle is plain
  text. `/model` and Settings > Models remain the only ways to change the model, unchanged. See
  Deviation 16.
- **Registered gateways** (`app/(main)/settings/connections.tsx`): Test/Sign out/Remove/Switch
  to…/Make primary measured ~28dp tall, and the connection title row (label + primary/current pills)
  measured 24dp. Both given `minHeight: 48`. Commit `521f9c0`.
- **Add connection** (`app/connect/index.tsx`, `app/connect/[id]/login.tsx`): the Name/Gateway
  URL/Token fields and the Username/Password sign-in fields all measured ~36-38dp tall (no
  `minHeight` on the shared mono-text input style). All five given `minHeight: 48`. Commit
  `262840a`.

**Registered gateways' `Test` button width, found in this pass and fixed in the follow-up round:**
its *width* — not height, already fixed above — measured 43.8-44.2dp, under 48dp, on both
connection cards. Its siblings (Sign out 65.5dp, Remove 64.4dp, Switch to… 102.9dp, Make primary
95.2dp) all clear 48dp because their labels are longer; `Test`'s four characters don't fill the
button even with `paddingHorizontal: 10`. Fixed with `minWidth: 48` (plus `alignItems: 'center'` to
keep the label centered in the wider box). Commit `4c7443b`. Re-measured: both cards' `Test` buttons
now read 48.0×48.0dp.

**Tool-call spinner after resume, reproduced and fixed; the fix itself then moved out of vendored
code.** A finished tool call showed a running spinner immediately upon leaving and re-entering its
session — before any app reload. Root cause confirmed via the raw `session.resume` payload: this
gateway's resume projection drops the assistant's `tool_calls` message entirely and represents the
call as a standalone `role: "tool"` message with no `timestamp` field. `storedToolMessagePart`
(vendored `tool-parts.ts:754`) unconditionally set `completedAt: toolMessage.timestamp`, so
`completedAt` came out `undefined` — indistinguishable from `ToolCallCard.tsx:40`'s `running` check.
The first fix (commit `bb045b1`) hand-edited that vendored line directly, which
`scripts/sync-upstream.mjs` only ever regenerates from its own `PATCHES` table — a sync would have
silently reverted the hand-edit on the next run, since `src/upstream/` is only ever a byte-for-byte
reproduction of that generation. Moved (commit `1593c33`) to `session-connection.ts`'s
`seedSessionMessages`, the one call site that feeds a `session.create`/`session.resume` payload's
static `SessionMessage[]` through `toChatMessages` — always settled history (a genuinely in-flight
tool call is restored separately, as a pending request, by `resume-pending.ts`, never as a static
message row) — so any `tool-call` part still missing `completedAt` there is a hydration artifact,
never a real running call. `closeRestoredToolCallParts` backfills it without touching the vendored
conversion. Verified via `node scripts/sync-upstream.mjs` against `../hermes-agent`: `tool-parts.ts`
now reproduces byte-for-byte (`git status` shows no diff on that file after a sync). That same sync
run surfaced an unrelated, pre-existing drift — the current `../hermes-agent` checkout's
`apps/desktop/src/types/hermes.ts` no longer has `CronBlueprint`/`CronBlueprintField`, which
`src/api/cron.ts` still imports — reverted before committing, out of scope for this fix, flagged for
separate follow-up.

**The desktop shares the same latent data bug, but never surfaces it as a spinner (read-only check
against `../hermes-agent`, nothing changed there).** `storedToolMessagePart`
(`apps/desktop/src/lib/chat-messages/tool-parts.ts:754`) is the same function this project vendors —
`completedAt` can come out `undefined` there too, for the identical reason. But the desktop's
tool-call card (`ToolEntry`, `apps/desktop/src/components/assistant-ui/tool/fallback.tsx:371`) never
reads `completedAt` to decide "running": `isPending = messageRunning && result === undefined`, where
`messageRunning` (`fallback-model/index.ts:225-226`) comes from assistant-ui's own live thread/message
run status — `false` for anything hydrated from history, regardless of `completedAt`. The only place
desktop reads `completedAt` at all is `TimelineTimestamp.tsx`, purely to display a completion time,
never to derive status. So this project's mobile port introduced the bug itself, by choosing
`completedAt === undefined` as its own running signal (`ToolCallCard.tsx:40`) instead of anything
tied to a live stream state — not a bug inherited from the desktop.

**Full device verification, all five screens (`uiautomator` bounds ÷ 2.625 at 420dpi):**

*Chat* (a turn with reasoning + a tool call), re-measured after the SessionHeader rework: Back
48.0×48.0, the title column (title + model/effort subtitle, now one touchable) 275.4×56.0, Compress
72.0×48.0, tool-call row 276.2×48.0, Reasoning rows 298.3×48.0 each, the four composer icons
48.0×48.0 each, input 141.0×64.0, Send 58.3×48.0 (measured with the field non-empty — Send is
`disabled` and drops out of the accessibility tree when the composer is blank, which is expected,
not a defect). **Correction: the `input 141.0×64.0` figure above was measured in the empty-placeholder
state only** ("Message Hermes…" wraps to two lines at this width, which is what produced 64dp) — it
did not cover the input's single-line height, which was a real failure. See below.

**Composer input's real floor, found and fixed in the round-3 follow-up.** The single-line case
measured 44.6dp (`Composer.tsx:571`, `minHeight: 44`), under 48dp — masked in the sweep above because
only the empty (two-line) placeholder was measured. Fixed: `minHeight` raised from 44 to 48. Doesn't
touch the busy-row layout (Deviation 15) or placeholder wrapping, both independent of this floor.
Commit `e7a5eb1`. Device-verified across all four composer states (`uiautomator` bounds ÷ 2.625 at
420dpi; none of these are inside a scroll viewport — the composer is docked, so clipping doesn't
apply to any of them):

- **(a) empty (placeholder):** `bounds=[525,2153][895,2321]` → 141.0×64.0dp. Two-line wrap, unchanged
  by this fix (already well above 48dp).
- **(b) one short word ("hi"):** `bounds=[525,1375][895,1501]` → 141.0×48.0dp. This is the case that
  failed before the fix (44.6dp) and now clears 48dp exactly.
- **(c) text wrapping to two lines:** `bounds=[525,1333][895,1501]` → 141.0×64.0dp, matching (a).
- **(d) busy (Stop/Steer showing) with one short word ("hi") typed:** `bounds=[525,1228][1059,1354]`
  → 203.4×48.0dp. Wider than (a)-(c) because the busy row layout (Deviation 15) hides the four
  composer icons, freeing that width for the input — unchanged by this fix, as instructed.

Nothing under 48dp, nothing cut off, in any of the four states.

*Session list*: Open menu 48.0×48.0, Settings 48.0×48.0, New session 124.2×48.0, search field
379.4×48.0, the session row 411.4×82.7, Pin 48.0×48.0. Nothing under 48dp, nothing cut off.

*Settings index* (scrolled through in three passes): every row — Registered gateways, Profiles,
Providers, Model, MCP, Skills, Tools, Appearance, Chat, Safety, Memory & Context, Notifications,
Voice, Plugins, Billing, Archived Chats, About — measured 57.9-58.3dp tall each time it was fully
inside the scroll viewport; Navigate up 56.0×56.0, the header's Open menu 48.0×48.0. **Cut off at
the screen edge, not a real defect:** whichever row sits right at the scroll viewport's top or
bottom boundary at a given scroll position reports a squashed or negative height in the same dump
(seen on Memory & Context, Skills, Tools, Providers, Plugins, and Billing at different scroll
positions) — the row is clipped by the ScrollView's own viewport, not by the physical screen, and
every one of them measured a normal 57.9-58.3dp once scrolled to a position where it was fully
inside the viewport. Named here so a future pass doesn't mistake a scroll-clip artifact for a
touch-target failure.

*Registered gateways*, re-measured after the `Test` width fix: Navigate up 56.0×56.0, Open menu
48.0×48.0, each connection's title row 353.5×48.0, Switch to Hone 102.9×48.0, Make primary
95.6×48.0, Sign out 65.1×48.0, Remove 64.8×48.0, `Test` 48.0×48.0 (both cards), Add connection
379.4×48.0. Nothing under 48dp, nothing cut off.

*Add connection*: Name field 379.4×48.0, Gateway URL field 379.4×48.0, Detect auth mode 140.2×48.0,
Scan QR 81.5×48.0. This screen has no back arrow or hamburger in its own UI (the OS back
gesture/button is the only way out) — not a missing node, just nothing to measure there. Nothing
under 48dp, nothing cut off.

#### M14 close-out audit (2026-09-13, throwaway gateway, device)

Status is still recorded as **todo** with every task and exit-criterion box unticked, though most of
the work has landed. This entry gathers evidence per task/criterion and closes the real gaps found;
it does not tick any box or change the status — that's the reviewer's call from this evidence.

**Setup used the whole round**: throwaway gateway `M14Close` (`setup-gw.sh`/`seed-host.sh`, scratch
`HERMES_HOME`, basic auth), Metro under `CI=1`, both prototype sets served locally
(`python -m http.server 8765 --directory docs/mobile-prototypes`, `8766 --directory
docs/desktop-prototypes`). Screenshots and dumps are in `%LOCALAPPDATA%\hermes-android-field\m14-close\`.
Hone was never touched.

**Correction (2026-09-13, close-out round 2): the "no renderer available" note above was wrong.**
A headless-Chromium renderer was available the whole time via the system's own Edge/Chrome install
(`msedge.exe`/`chrome.exe --headless=new --screenshot=OUT.png --window-size=412,915`), it just wasn't
tried in the prior round — `playwright`/`selenium` were checked in the Python install, but the OS
browsers themselves were not. This round used it (via the user's own pre-existing
`proto-*-{light,dark}.png` captures at `%LOCALAPPDATA%\hermes-android-field\m14-device\`, confirmed
unchanged since `88dbd49` — `git log 88dbd49..HEAD -- docs/mobile-prototypes docs/desktop-prototypes`
in the main repo is empty, and the main repo's `HEAD` is itself `88dbd49`) to run the actual
`composite.py` script and produce real side-by-side PNGs for all eight required pairs. See the table
below for each composite's path.

**Side-by-side composites, round 2 (2026-09-13, throwaway gateway `M14Close2`, device, both modes):**
prototype side reused from the user's own `proto-*-{light,dark}.png` captures (unchanged since
`88dbd49`, confirmed above); device side is a fresh screenshot from this round. All 18 files
(9 screens × 2 themes — one more than the 8 required, since cron's list and detail states were both
captured) are in `%LOCALAPPDATA%\hermes-android-field\m14-close2\`.

| Pair | Light | Dark |
|---|---|---|
| Chat | `composite-chat-light.png` | `composite-chat-dark.png` |
| Session list | `composite-sessions-light.png` | `composite-sessions-dark.png` |
| Settings index | `composite-settings-index-light.png` | `composite-settings-index-dark.png` |
| Settings section (Appearance) | `composite-settings-appear-light.png` | `composite-settings-appear-dark.png` |
| Cron (list) | `composite-cron-list-light.png` | `composite-cron-list-dark.png` |
| Cron (detail) | `composite-cron-detail-light.png` | `composite-cron-detail-dark.png` |
| Profiles | `composite-profiles-light.png` | `composite-profiles-dark.png` |
| Mid-turn prompt (Stop/Steer busy row) | `composite-midturn-light.png` | `composite-midturn-dark.png` |
| Sheet (create profile) | `composite-sheet-create-light.png` | `composite-sheet-create-dark.png` |

No new visual mismatches found beyond what's already tracked (the create-profile sheet's translucent
top, Deviation-noted above, is visible again in both theme composites).

**Audit table — tasks (doc lines ~124-135):**

| Task | Evidence | Verdict | What's missing |
|---|---|---|---|
| Vendor `en.ts` via `sync-upstream.mjs`; `t.ts` reads it | `src/upstream/i18n/en.ts` exists, `UPSTREAM.json` present; `src/lib/t.ts` imports it (checked directly) | MET | — |
| `src/components/ui/*` primitives + dev story screen | Round 3 (task 2b): both exist — `app/dev/primitives.tsx` and 9 files in `src/components/ui/` (Badge, Button, Input, ListRow, Menu, SegmentedControl, Sheet, Switch, Tabs). Device-verified on `M14Close3`, both themes: `primitives-dark-1.png`/`-2.png`, `primitives-light-1.png`/`-2.png`, plus Sheet and Menu opened in each theme (`primitives-sheet-{dark,light}.png`, `primitives-menu-dark2.png`). See detail below. | MET | — |
| `Sheet`, `Menu`, `ListRow`, `ScreenHeader` overflow | Round 3 (task 2c): traced every primitive to its real call sites (not per-screen reimplementations) — `Sheet`: `cron/index.tsx`, `projects/index.tsx`, `settings/profiles.tsx`; `Menu`: `cron/index.tsx`, `settings/profiles.tsx`, `ScreenHeader.tsx`; `ListRow`: `agents/index.tsx`, `command-center/index.tsx`, `cron/index.tsx`, `cron/[id].tsx`, `settings/{chat,index,memory,safety}.tsx`; `ScreenHeader` itself: `agents/index.tsx`, `artifacts/index.tsx`, `channels/index.tsx`, `command-center/index.tsx`, `cron/index.tsx`, `cron/[id].tsx`, `projects/index.tsx`, `webhooks/index.tsx` — all confirmed as real `import { X } from '../../../src/components/ui/...'` lines, spot-checked directly, not assumed from a grep hit. `ScreenHeader.tsx`'s own overflow logic (`MAX_INLINE_ACTIONS = 2`, `ScreenHeader.tsx:31,43-51,87-97`) collapses the 3rd+ action into a `Menu` opened by the "More" button, matching the M14 spec's "first two inline, rest behind a single More button" exactly. | MET | — |
| Screens built, one commit each, in the stated order | `find app -name "*.tsx"` (this round) shows chat, session list+drawer, settings index + all listed sections, cron, profiles, webhooks, channels, artifacts, projects, agents, connect — all present as route files | MOSTLY MET | Command center exists but per `PARITY.md` is "real screen, inert" (client wraps no analytics endpoint) — built, not wired; toolsets exists (`settings/toolsets.tsx`) |
| Every screen has a `Replicates:` comment | See criterion below (route-replicates.test.ts) | MET | — |
| `PARITY.md` updated | See item 1f below | MET | — |

**Task 2b detail — primitives checked against the desktop reference and against DESKTOP-DESIGN.md
§8.** `docs/desktop-prototypes/g-elements/primitives.html` documents ~28 desktop primitives (Button,
Badge, Control/Input/Textarea/Select, Switch/SegmentedControl/Checkbox, Tabs/TextTab/PaneTab, Kbd/
SearchField/Tooltip, Popover/DropdownMenu, Dialog/Sheet, panel-row/list-row/nav-item, EmptyState/
ErrorState/Skeleton/Loader/StatusDot/LogView, Progress/Slider/ThemeCard/Card/Widget/Avatar) — mobile's
`src/components/ui/` only has 9. This is not a gap: the M14 mapping's own Section G line names exactly
these 9 ("Button ... Badge, Input, Switch, SegmentedControl, Tabs, Sheet, Menu, ListRow"), and the
mobile prototype's own `docs/mobile-prototypes/primitives.html` — the actual authority for "what M14
asks `src/components/ui/*` to provide" per its own header comment — explicitly lists the rest (Tooltip,
Popover, DropdownMenu, ContextMenu, Kbd, PaneTab) as "absent here on purpose: no hover, no keyboard."

Checked each of the 9 against the mobile prototype's own stated measurements (its Measurements block)
and DESKTOP-DESIGN.md §8 where the mapping calls it out by name (Button):

- **Button** (`Button.tsx`): 5 variants (primary/secondary/outline/ghost/danger) + block + icon —
  matches the mobile prototype's own Button section exactly (same 5, same block/icon treatment); the
  desktop's `link`/`text`/`textStrong` variants have no button in the mobile prototype either, so
  their absence isn't a mobile-only omission introduced here. `minHeight: 48`, icon 48×48
  (`Button.tsx:90,97-98`) — matches "Button min 48 ... icon button 48×48."
- **Badge** (`Badge.tsx`): 5 variants (default/muted/warn/danger/good), `paddingHorizontal: 8,
  paddingVertical: 2` (`Badge.tsx:49-50`) — matches "Badge 20 tall (2×8 pad, 16 line)."
- **Input** (`Input.tsx`): `minHeight: 48, paddingHorizontal: 14, paddingVertical: 12`
  (`Input.tsx:66-68`) — matches "Input min 48 dp, pad 12×14" exactly.
- **ListRow** (`ListRow.tsx`): `minHeight: 56` (`ListRow.tsx:70`) — matches "ListRow min 56 dp."
- **Switch** (`Switch.tsx`): track 44×26, thumb 20×20 (`Switch.tsx:54-62`) — matches "Switch 44×26 dp,
  thumb 20" exactly.
- **SegmentedControl** (`SegmentedControl.tsx`): option `minHeight: 40`, track `padding: 3`
  (`SegmentedControl.tsx:62,68`) → 40 + 2×3 = 46 total — matches "option 40 dp (track 46)" exactly.
- **Sheet** (`Sheet.tsx`): `radius.sheet` corners, handle 32×4 (`Sheet.tsx:142-147`), `maxHeight: '88%'`
  (`Sheet.tsx:127`) — matches "radius sheet(8), handle 32×4 ... max-height 88%" exactly.
- **Menu** (`Menu.tsx`): item `minHeight: 48` (`Menu.tsx:71`) — matches "item min 48."
- **Tabs** (`Tabs.tsx`): `minHeight: 40` (`Tabs.tsx:69`) — consistent with the segmented-control-
  adjacent sizing; not separately itemized in the prototype's own Measurements line.

**Device-verified**, `M14Close3`, deep-linked via `adb shell am start -a android.intent.action.VIEW -d
"hermes-android://dev/primitives"` (the scheme is `hermes-android`, `app.config.ts:6`): every section
(Button, Badge, Input, ListRow, SegmentedControl, Tabs, Sheet/Menu triggers) rendered correctly in both
dark (`primitives-dark-1.png`, `primitives-dark-2.png`) and light (`primitives-light-1.png`,
`primitives-light-2.png`) — switched via Settings > Appearance, not the dev screen's own
SegmentedControl demo (that control's `mode` state is local to the story screen only, per
`primitives.tsx`'s own `useState` — it doesn't drive `useTheme()`). Opened the Sheet
(`primitives-sheet-dark.png`, `primitives-sheet-light.png`) and the Menu
(`primitives-menu-dark2.png`) in both themes — handle, title, footer buttons, and the Low/Medium
(active)/Forget-this-host (danger) items all rendered correctly. **Verdict: MET.**

**Audit table — exit criteria (doc lines ~139-156):**

**a. Replicates comments.** `npx vitest run src/lib/route-replicates.test.ts`:
```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```
Route files added since `74c8ec5` (the commit that dropped the label/Replicates ratchets): checked
via `git diff --name-only --diff-filter=A 74c8ec5..HEAD -- app/` and independently via
`comm -13 <(git ls-tree 74c8ec5 app) <(git ls-tree HEAD app)` — both agree on exactly one file,
[`app/(main)/cron/[id].tsx`](app/(main)/cron/[id].tsx:53), which carries `// Replicates:
docs/desktop-prototypes/a-main/cron.html's PanelDetail half`. **Verdict: MET.**

**b. Labels.** `npx vitest run src/lib/labels.test.ts`:
```
 Test Files  1 passed (1)
      Tests  32 passed (32)
```
This test only scans route files under `app/` (its own header comment says so). `src/chat/Composer.tsx`
is not a route file, so its literals were never in scope — checked by hand against the five named
strings:
- `"Stop"`, `"Send"` — exact values already exist in `en.ts` (`composer.stop`, `composer.send`), but
  were hardcoded literals, not references. Not a value mismatch, but not traced either.
- `"Steer"` — no exact match anywhere in `en.ts` (`composer.steer` = 'Steer the running turn',
  `queueSteer` = a different full sentence) — a genuine gap, no documented exception.
- `"Message Hermes…"` — no match in `en.ts`'s placeholder set at all (desktop rotates through
  `newSessionPlaceholders`/`followUpPlaceholders`) — a genuine gap, no documented exception.
- The connect screen's `"http://127.0.0.1:9119"` placeholder — correctly exempt: it's an example
  value, not prose, matching the test's own `LOOKS_TECHNICAL` filter design.

**Fixed in commit [ee55803](src/chat/Composer.tsx):** `Stop`/`Send` now read `t.composer.stop`/
`t.composer.send` directly; `Steer` and the placeholder are genuinely mobile-only, so they became
new whitelisted exports (`COMPOSER_STEER_LABEL`, `COMPOSER_PLACEHOLDER`) in
[`src/lib/strings.mobile.ts`](src/lib/strings.mobile.ts), same pattern as its existing entries, each
with a comment naming the vendored value checked and why it doesn't fit. **Verdict: MET** (after the
fix — was NOT MET for `Steer`/the placeholder before it).

**Round 2 (close-out task 4c): the "only scans `app/`" gap itself, closed.** `labels.test.ts` now
also walks every `.tsx` file under `src/chat/` and `src/components/` (`npx vitest run
src/lib/labels.test.ts`: 63/63 passed after the fixes below, up from 32). The wider scan found 12
files with retyped or unwhitelisted literals:

- **Genuine content bugs, not just missing references** — a vendored string existed for the exact
  concept and the app had retyped it differently: `SecretCard.tsx`'s fallback title read "Secret
  requested" (should be, and now is, `t.prompts.secretTitle` = 'Secret required'); `SudoCard.tsx`'s
  title read "Sudo password requested" (now `t.prompts.sudoTitle` = 'Administrator password') and its
  field placeholder read "Password" (now `t.prompts.sudoPlaceholder` = 'sudo password');
  `SessionHeader.tsx`'s untitled-session fallback was a bare "Untitled" in two places, while
  `session-list.tsx` already correctly used `t.sidebar.row.untitledPlaceholder` ('Untitled session')
  for the same fallback — SessionHeader now matches it.
- **Genuinely mobile-only, whitelisted in `strings.mobile.ts`** with the vendored string checked and
  named in each comment: `ApprovalCard.tsx` (title, smart-denied notice), `ClarifyCard.tsx` (batch/
  single titles, answer placeholder), `UsageChip.tsx` ("% ctx"), `SessionHeader.tsx` ("Compress"/
  "Compress failed" — `session.compress` has no vendored word, distinct from `settings.model`'s
  unrelated "Compression" context-compaction description), `ScreenHeader.tsx` (the overflow button's
  "More"), and `Composer.tsx`'s voice/attachment row (4 accessibility labels + 8 toast titles/
  messages for dictation, TTS, and attach errors).
- **False positives in the scanner itself, not labels at all** — `AppDrawer.tsx` and `ui/Sheet.tsx`
  each had an `rgba(...)` style value, and `ToolIcon.tsx` had 13 SVG path `d` attributes (the phosphor
  icon set), none of which the existing `LOOKS_TECHNICAL` filter caught since both shapes can start
  with an uppercase character. Extended the filter with two more patterns
  (`LOOKS_LIKE_COLOR_VALUE`/`LOOKS_LIKE_SVG_PATH_DATA`) rather than whitelisting non-text data as if
  it were product copy.
- **Flagged for a design decision, not silently fixed or wrongly whitelisted:**
  `ReasoningDisclosure.tsx`'s "Reasoning" header. A closely related vendored string set exists
  (`assistant.thread.thinking`/`thought`/`thoughtBriefly`/`thoughtFor(duration)`), but it's a live
  state machine — "Thinking" while streaming, then "Thought"/"Thought briefly"/"Thought for {duration}"
  once settled, depending on how long reasoning ran — and this component always shows the same word
  regardless of state, only toggling the disclosure triangle on expand/collapse. Whitelisted the bare
  word (`REASONING_DISCLOSURE_LABEL`) so the test passes honestly, but the underlying gap — no
  thinking-duration state machine on mobile — is a real product decision (implement it, or keep the
  simpler static label deliberately) that this labels sweep shouldn't make unasked.

**Round 3 (close-out, task 1): implemented, matching the desktop exactly.** Decision: implement the
desktop's reasoning labels. Source read (read-only): the desktop's `ThinkingDisclosure`
(`apps/desktop/src/components/assistant-ui/thread/message-parts.tsx:159-174`) computes `pending`
from `s.thread.isRunning && s.message.status?.type === 'running' && ` the reasoning part's own
`status.type !== 'complete'` (`message-parts.tsx:267-274`), and derives `thoughtFor` from
`useMeasuredDuration` (`apps/desktop/src/components/chat/activity-timer.ts:92-110`) — `null` until a
component has watched `active` (its own `pending`) transition from `true` to `false` at least once;
a component that mounts already-settled (restored history, or reasoning that arrived complete) never
sees that transition, so `thoughtFor` stays `null` and the label reads "Thought", never a duration
computed after the fact from persisted timestamps. Ported nearly verbatim to
[`src/chat/reasoning-timer.ts`](src/chat/reasoning-timer.ts) (`formatElapsed`/`useElapsedSeconds`/
`useMeasuredDuration`, same module-level registry), omitting only `useViewedInterval`'s focus/
visibility gating (DOM APIs React Native doesn't have — unnecessary anyway, since a backgrounded RN
app's JS timers stop firing on their own and every value is re-derived from `Date.now()` rather than
accumulated).

Mobile's data: a reasoning part gets its `timestamp` from `reasoningPart(text, occurredAt)`
(`src/upstream/lib/chat-messages/parts.ts:9-11`) the moment its first delta arrives; `completedAt` is
stamped by whichever boundary closes it first — `completeOpenStreamParts`
(`src/upstream/lib/chat-messages/tool-parts.ts:281-287`, checked at `tool-parts.ts:283`) when a tool
call starts or completes next, or `completeOpenTimelineParts`
(`src/upstream/lib/chat-messages/parts.ts:232-238`) when the whole turn ends, whichever comes first.
[`ReasoningDisclosure.tsx`](src/chat/parts/ReasoningDisclosure.tsx) now takes the message's own
`pending` flag plus the part itself, computes `pending = messagePending && part.completedAt ===
undefined` (gating on the MESSAGE still running, not just this part missing `completedAt` — a part
left open by a dropped connection is stale, not live), and
[`Transcript.tsx`](src/chat/Transcript.tsx) builds the same `reasoning:${messageId}:${index}` timer
key shape the desktop uses. `REASONING_DISCLOSURE_LABEL` removed from `strings.mobile.ts` — no longer
whitelisting a static word now that the real state machine backs it.

Unit-tested (`src/chat/reasoning-timer.test.ts`): `thoughtLabel`'s four branches and `formatElapsed`,
as pure functions — NOT `useElapsedSeconds`/`useMeasuredDuration`'s hook mechanics, since this
project's vitest config only stubs `react-native` (`Platform`/`NativeModules`/`AppState`, no
`StyleSheet`/`Text`/etc.) and has no React test renderer, the same limitation `labels.test.ts`'s own
header already documents for `.tsx` component tests generally.

**Device-verified, all four states** (throwaway gateway `M14Close3`, `%LOCALAPPDATA%\
hermes-android-field\m14-close3\`, `uiautomator` bounds ÷ 2.625 at 420dpi):

| State | Label observed | Screenshot | Header bounds (native px → dp) |
|---|---|---|---|
| Still streaming | `▸ Thinking` | `catch-1s.png` | not re-measured live (dump failed mid-animation — "could not get idle state") |
| Finished, under 1s | `▸ Thought briefly` | `catch-3s.png`, `poll-check.png` | — |
| Finished, ≥1s | `▸ Thought for 6s` / `▸ Thought for 14s` | `riddle-settled.png` (6s), `balls-settled.png` (14s) | `[79,759][862,885]` → 126×48.0dp |
| Restored (cold relaunch, never watched) | `▸ Thought` (no duration) | `relaunch-thought-label.png` | `[79,759][862,885]` → 126×48.0dp |

Getting a live "Thinking" screenshot took five attempts — this test model (mimo-v2.5) usually reasons
for well under a second, occasionally several seconds on a harder prompt (the 12-balls weighing
puzzle finally produced a catchable ~1s window; the wolf/goat/cabbage riddle reasoned for 6s, the
switches puzzle briefly, the balls puzzle 14s — all genuinely device-measured, not fixed values).

**Leave-and-re-enter**, same session (12-balls puzzle, mid-14s-measurement): left via Back, re-opened
from the session list — label still read `▸ Thought for 14s` (`reenter-label.png`, bounds
`[79,759][862,885]` → 48.0dp again). The measured duration survives in-session navigation because
`durationByKey` is a module-level registry that outlives the unmounted component, exactly like the
desktop's own "component that mounts after the fact" case.

**Cold relaunch**, same session: `adb shell am force-stop` + relaunch, reconnected automatically,
reopened the session, scrolled up to the reasoning block — label read `▸ Thought` (no duration),
confirmed via `dump-relaunch4.xml` and `relaunch-thought-label.png`. This is the required case: a
fresh process has an empty `durationByKey` (it's in-memory JS state, not persisted), the component
mounts already-settled (`messagePending` false from the first render), so it never watches a
pending→settled transition and correctly reports no duration rather than reconstructing one from the
persisted `timestamp`/`completedAt`.

Commits: `c3386a1` (code — reasoning-timer.ts, ReasoningDisclosure.tsx, Transcript.tsx,
strings.mobile.ts), `c2ea86f` (test — reasoning-timer.test.ts).

Each genuine fix and each whitelist addition landed as its own reviewable change (commits
`fcbae15` test widening, `5dad3cf` the fixes and whitelist entries together — grouped rather than
one-commit-per-string given the count, ~25 individual literals across 10 files).

**c. Drawer order.** [`src/components/drawer-rows.test.ts`](src/components/drawer-rows.test.ts) —
`npx vitest run src/components/drawer-rows.test.ts`:
```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```
Device-cross-checked against the live drawer (`dump_drawer.xml`/`dump_drawer2.xml`/`dump_drawer3.xml`,
this round): `Sessions, Capabilities, Messaging, Artifacts, Scheduled jobs, Profiles, Agents,
Webhooks, Command Center, Projects, Settings` — matches `sessions.html`'s own documented order
exactly (`docs/mobile-prototypes/sessions.html:27-35`: nav strip, then overlay screens in
DESKTOP-SCREENS §A order, then Projects, then Settings last). **Verdict: MET.**

**d. Hover.** `grep -rnE "onHoverIn|onMouseEnter" src app` — empty (pasted below, the empty result is
the pass):
```
(no output)
```
React Native has no hover concept without an explicit `onHoverIn`/`onMouseEnter` handler (both
web-only APIs), so this empty grep is definitive: no control in this codebase is gated behind a
hover state at all — a stronger guarantee than "every hover control has a fallback," since none
exist as hover-only in the first place. The desktop hover-revealed controls named in the mobile
prototypes' own Behaviour blocks, and how each is reached on device (checked against the actual
route files, not assumed):
- `sessions.html:14`: "hover-revealed kebab and star → always visible" — the Pin/star button is an
  always-rendered `TouchableOpacity` ([`session-list.tsx:314-317`](app/(main)/session-list.tsx:314));
  the row's delete (the kebab's job on desktop) is `onLongPress` ([`session-list.tsx:290`](app/(main)/session-list.tsx:290)).
  Device-verified visible in this round's session-list screenshots.
- `settings.html:16`: "hover-revealed row actions" — Registered gateways' Test/Sign out/Remove are
  always-rendered buttons (fixed to 48dp across earlier rounds), device-verified this round
  (`24-cronlist-light.png` area screens, and prior rounds' connections.tsx work).
- Profiles (`profile-dialogs.html`'s hover-only rename/delete equivalent) — delete is `onLongPress`
  ([`profiles.tsx:239`](app/(main)/settings/profiles.tsx:239), with a comment citing this exact
  adaptation rule at line 63); Rename is a plain visible link, device-verified this round
  (`22-profiles-light.png`).
- `cron.html:17,75`: "hidden until row hover" (blueprint action icon), ".pn-kebab hover" (job row
  overflow) — Trigger/Pause/Delete on the job detail screen are always-rendered `TouchableOpacity`s
  ([`cron/[id].tsx:190,200,207`](app/(main)/cron/[id].tsx:190)), device-verified this round
  (`25-crondetail-light.png`).
- `bots.html`/`tasks.html` hover affordances — M15-owned; `app/(main)/bots` and `app/(main)/tasks`
  don't exist yet, correctly absent.

**Verdict: MET.**

**e. Sheets and alerts.** Every desktop dialog from the doc's mapping table (Section F) and its
on-device reachability:

| Desktop dialog | Reached via | Buttons on device | vs desktop `en.ts` | Verdict |
|---|---|---|---|---|
| `confirm.html` (generic confirm) — Registered gateways' Remove/Sign out | Tap Remove/Sign out on a connection card | CANCEL / REMOVE (destructive, red, last) | `t.settings.connections.removeConfirmTitle`/`removeConnection` — sourced, not retyped (checked `connections.tsx:164-174`) | MET |
| `confirm.html` — cron job delete | Tap Delete on a job's detail screen | Cancel / Delete (destructive, last) | `t.cron.deleteTitle`/`t.common.cancel`/`t.common.delete` (`cron/[id].tsx:102-108`) | MET |
| `confirm.html` — profile delete | Long-press a profile row | Cancel / Delete (destructive, last) | `t.common.delete` (`profiles.tsx:146`) | MET |
| `profile-dialogs.html` (New Profile) → sheet | Tap "New profile" on Profiles | Cancel / Create profile — device-verified round 1 (`06b-createprofile-dark2.png`, `23-createprofile-light.png`) and re-verified round 2, both themes (`composite-sheet-create-{light,dark}.png`) | Fields (Name, Clone from) and copy match the desktop's own fields in the same order | MET |
| `mid-turn-prompts.html` → the approval card | A `rm -rf` inside the throwaway `HERMES_HOME` (dangerous-command pattern, confirmed via `hermes-agent`'s `approval_detection.py:198` — plain `rm`/`touch`/`curl` do NOT trigger it, only flagged patterns do) | Run / Allow this session / Always allow / Reject — device-verified this round, both themes, Reject confirmed to actually deny the command (model acknowledged the denial) | Matches `ApprovalCard.tsx`'s `CHOICE_LABELS` | MET |
| `archive-skill.html` → confirm Alert | Not reachable — genuinely absent, not a testing gap (`skills.tsx:45-58`; Deviation 13 §404-415) | — (no UI exists) | — | MET-AS-ABSENT |
| `add-url.html` → sheet | Not reachable — genuinely absent (`Composer.tsx:63-73`; Deviation 13 §421-426) | — (no UI exists) | — | MET-AS-ABSENT |
| `mcp-install-link.html` → sheet | Not reachable — genuinely absent (`mcp.tsx:41-49`; Deviation 13 §421-426) | — (no UI exists) | — | MET-AS-ABSENT |
| `plugin-install.html` → sheet | Not reachable — genuinely absent (`plugins.tsx:24-32`; Deviation 13 §416-420) | — (no UI exists) | — | MET-AS-ABSENT |
| `memory-provider.html` → sheet | Not reachable as a dialog — its fields ship as one of `memory.tsx`'s inert read-only rows instead (`memory.tsx:13-29`; Deviation 8 §249-264), device-verified as such in a prior round | — (read-only row, not a sheet) | — | MET-AS-ABSENT |
| `send-diagnostics.html` → sheet | Not reachable — genuinely absent (`about.tsx:40-55`: `t.sendDiagnostics` vendored but no upload endpoint wired) | — (no UI exists) | — | MET-AS-ABSENT |

The doc's own Section F mapping table listed these six as present (sheets, or a confirm `Alert` for
`archive-skill`) — that line was stale against the app's own code the whole time and is corrected
above (§108-135 area) with the same citations.

**One real anomaly, not a confirmed defect:** the approval card's first render this round appeared
with only its coloured border visible — a thin sliver at the right screen edge, no visible title/
body/buttons — while `uiautomator`'s accessibility tree reported the card's full text and normal,
on-screen bounds at the same moment (confirmed by cropping the screenshot at the reported
coordinates: genuinely blank). It persisted across leaving/re-entering the session and a full app
relaunch, then did **not** reproduce on a clean, single fresh approval request afterward (screenshots
`14-approvalcard-dark.png` / `14b-zoom-approvalregion.png` show it broken; `18-newapproval.png`
immediately after shows the same card rendering correctly). The transcript uses an inverted
`FlashList` with `maintainVisibleContentPosition` and a `ListHeaderComponent` whose content
(secret/sudo/approval/clarify/todos) changes shape dynamically (`Transcript.tsx:150-167`) — a known
category of virtualization bug when a dynamically-sized header appears while that prop is active.
Given it didn't reproduce cleanly, no fix was attempted (a guess-patch to list-virtualization
behavior under time pressure risks a worse regression than the cosmetic glitch it might not even
fix) — flagging for a dedicated follow-up rather than improvising one here.

**Round 2 (2026-09-13, `M14Close2`): five reproduction attempts, none reproduced the glitch.** Per
the user's own zoomed capture from the round above (`14b-zoom-approvalregion.png`: the card's red
border starts around x=900 of 1080, the rest covered by a dark panel matching the assistant bubble's
`tokens.card` colour), the working hypothesis going in was a `@shopify/flash-list` v2
recycling/positioning interaction: `Transcript.tsx`'s inverted list combines
`maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 0.2 }}` with a `ListHeaderComponent`
(`Transcript.tsx:1-40`, the `secret`/`sudo`/`approval`/`clarify`/`todos` `<View>` block) whose size
jumps from 0 to real height the moment a card arrives — a possible recycled `MessageBubble` cell
(assistant role: `tokens.card` background, `maxWidth: '86%'` ≈ 929px of 1080px, `styles.bubble` in
`Transcript.tsx`, no explicit `zIndex`/`elevation`/`position` anywhere in the file) could paint at a
stale y-position overlapping the header slot. This remains a hypothesis, not a confirmed cause —
every attempt below rendered the card correctly, so no overlapping-sibling dump was ever captured to
verify it. Five attempts, deliberately varied:

1. Dark, minimal session history, `rm -rf` as the very first message, scrolled immediately after
   sending (`01-attempt1.png`) — rendered correctly.
2. Dark, longer built-up history, second `rm -rf`, erratic manual scrolling, navigated out of the
   session and back in (`03-attempt2.png`, `04-attempt2-reenter.png`) — rendered correctly.
3. Dark, the exact original 4-command sequence replicated (touch → rm → curl with a large HTML
   response → `rm -rf`) with no manual scrolling this time, to isolate the "large curl response"
   variable; an unrelated system emoji-keyboard toolbar briefly appeared and forced a navigate-out,
   re-entered (`05-attempt3.png`, `06-attempt3-reenter.png`) — rendered correctly.
4. Dark, force-stopped the app with Attempt 3's approval genuinely still pending, relaunched cold,
   reconnected to Metro, re-entered the session (`07-relaunch-pending.png`,
   `08-attempt4-cold-resume.png`) — the pending approval survived the cold relaunch and rendered
   correctly (this directly tests the round-1 observation of a pending approval seeming to vanish
   after a relaunch; it did not recur here).
5. Light mode (the one theme/interaction combination not yet tried), fresh session, `rm -rf` as the
   first message, three aggressive scroll swipes immediately after sending, waited 7s
   (`09-attempt5-light.png`) — rendered correctly, full and visible with all four buttons.

Variables deliberately varied across the five: session history length, scroll timing relative to the
card's arrival, cold-relaunch-with-pending-approval state, and theme. **The glitch did not reproduce
in any of the five attempts.** Per the round's own instruction, this is reported as not-reproduced,
not as fixed — no code was changed for this item. All screenshots and dumps are kept in
`%LOCALAPPDATA%\hermes-android-field\m14-close2\`. The FlashList/`maintainVisibleContentPosition`
hypothesis above is carried forward for whoever picks this up next, but it is unconfirmed by any
evidence gathered this round.

**f. PARITY.md.** Read in full this round. It already reflects the M14-added settings sections and
screens: "Settings: Chat, Safety, Memory & Context" and "Settings: Billing" are explicitly listed as
thinner/read-only with the gateway-endpoint evidence for each (`docs/PARITY.md:45-46`), "Command
center (Usage)" and "Agents" are listed as real-but-inert with their own RPC evidence (`:47-48`), all
attributed to "M14 Deviations 8 & 13." Archived Chats and About aren't listed as gaps because they
aren't gaps — both screens are substantial, fully-functional (checked: no `TODO`/inert markers in
either file). **Verdict: MET, no update needed.**

**Side-by-side pairs, against HEAD `ee55803` (checklist per pair; "P" = prototype source, "D" = device
screenshot this round):**

| Pair | P source | D screenshots | Same sections/order | Same labels | Same control order | Adaptation named |
|---|---|---|---|---|---|---|
| Chat | `chat.html:62-73` (header), `:124-127` (composer) | `01-chat-dark.png`, `27-chat-light.png` | Yes — back/title-subtitle/2 actions header, composer icons+input+send | Yes (post Composer fix) | Yes | Deviation 16 (header), 15 (busy row), 11 (no model chip) |
| Session list | `sessions.html` Views line 36 | `02-sessionlist-dark.png`, `26-sessionlist-light.png` | Yes — search, date dividers, row anatomy | Yes | Yes (search→New session→rows) | Field notes in `sessions.html:24-26` (search/pin/model, "+New session" are mobile-only additions, named there) |
| Settings index | `settings.html` (desktop) + M14 mapping table row | `03-settingsidx-dark.png`, `21-settingsidx-light.png` | Yes, desktop section order + the six added sections | Yes | Yes | Mapping table's own "add Chat, Safety, Memory & Context, Billing, Archived chats, About; skip Workspace, Browser, Advanced, Keybinds, Local models" |
| Settings › Appearance | `settings.html`'s appearance section | `04-appearance-dark.png`, `20-appearance-light.png` | Yes | Yes | Yes (mode row, then skin grid) | — |
| Cron (list + detail) | `desktop-prototypes/a-main/cron.html` | `07-cronlist-dark.png`/`24-cronlist-light.png`, `08-crondetail-dark.png`/`25-crondetail-light.png` | Yes — jobs list, "Ready-made automations" + "New cron" form; detail has Trigger/Pause/Delete | Yes | Yes | Mapping table: "Jobs list then job detail; templates as a sheet" |
| Profiles | `desktop-prototypes/a-main/profiles.html` | `05-profiles-dark.png`, `22-profiles-light.png` | Yes | Yes | Yes | Mapping table: "Dialogs become sheets" |
| Mid-turn approval card | `mid-turn-prompts.html` | `18-newapproval.png`, `29-approvalcard-light2.png`, plus post-Reject: `19-afterreject-dark.png`, `30-afterreject-light.png` | Yes | Yes (`CHOICE_LABELS`) | Yes | Mapping table: "Structure unchanged (device-verified behaviour)" — confirmed again this round |
| Create-profile sheet | `desktop-prototypes` profile-dialogs equivalent | `06b-createprofile-dark2.png`, `23-createprofile-light.png` | Yes | Yes | Yes | Mapping table Section F: dialogs become sheets |

No Bots/Tasks-tab absences apply to any of these eight pairs (those are M15's, not built yet — correctly
absent from the drawer per item 1c above).

**M13 still holds — re-verified this round:**

Hex grep (M13's first exit criterion), pasted in full:
```
$ grep -rnE "#[0-9a-fA-F]{6}" src app --include=*.tsx --include=*.ts | grep -v "^src/theme\|^src/upstream"
(no output, exit 1)
```

Touch targets — fresh dumps, scroll-edge rows named and re-measured in view, none omitted:
- *Chat*: Back 48.0×48.0, title column 275.4×56.0, Compress 72.0×48.0, three Reasoning rows
  298.3×48.0/298.3×67.4/298.3×48.0, four composer icons 48.0×48.0 each, input 141.0×64.0. One
  Reasoning row initially read 298.3×3.4dp (clipped at the scroll viewport's top edge) — re-measured
  at 298.3×67.4dp once scrolled fully into view. Nothing under 48dp once clear of the viewport edge.
- *Session list*: Open menu 48.0×48.0, Settings 48.0×48.0, New session 124.2×48.0, search field
  379.4×48.0, session row 411.4×82.7, Pin 48.0×48.0. Nothing under 48dp, nothing clipped.
- *Settings index*: all rows 57.9-58.3dp; "Memory & Context" initially read 411.4×11.8dp (clipped at
  the bottom edge) — re-measured at 411.4×57.9dp scrolled into view.
- *Appearance*: mode row 3×120-121×48.0, skin rows 379.4×66.7-67.0 each; "Select Ember skin"
  initially read 379.4×21.0dp (clipped at the bottom edge) — re-measured at 379.4×66.7dp scrolled
  into view.

Font scale 1.3× (`adb shell settings put system font_scale 1.3`), screenshots pasted:
`31-fontscale13-chat.png` (session list — this screenshot landed there first), `32-fontscale13-chat2.png`
(chat), `33-fontscale13-settings.png` (settings index). Text scales up cleanly in all three; no
overlap, no clipping beyond normal scroll truncation. Restored: `adb shell settings put system
font_scale 1.0`, confirmed via `adb shell settings get system font_scale` → `1.0`.

Colour match on the chat screen, sampled from the approval-card screenshots (`18-newapproval.png` dark,
`29-approvalcard-light2.png` light) at pixel coordinates derived from the same `uiautomator` dump's
bounds, against `resolve.test.ts`'s nous values:

| Token | Dark expected | Dark sampled | Light expected | Light sampled |
|---|---|---|---|---|
| background | `#0d1015` | `#0d1015` | `#fefefe` | `#fefefe` |
| card (assistant bubble) | `#0e0f12` | `#0e0f12` | `#fbfbfc` | `#fbfbfc` |
| primary (Run button) | `#4a84fe` | `#4a84fe` | `#0053fd` | `#0053fd` |
| border/destructive (approval card border) | `#cf2d56` | `#cf2d56` | `#cf2d56` | `#cf2d56` |
| user bubble | `#0f1621` | `#0f1621` | `#fcfcfc` | `#fcfcfc` |

All five sampled exactly (0 channels off, well inside ±1) in both modes. **M13 holds.**

**Round 2 (close-out, task 5): the six named surfaces, sampled and reported separately.** The table
above conflates "border" and "destructive" into one row — they're different tokens (`ApprovalCard`'s
outline uses `tokens.destructive`; the generic `tokens.border` shows up elsewhere, e.g. a tool-call
card's own outline, `ToolCallCard.tsx:51`) that happen to share a sample source. Re-sampled this round
from fresh `M14Close2` screenshots (`%LOCALAPPDATA%\hermes-android-field\m14-close2\`), each surface
independently, via exact-pixel search against `src/theme/resolve.test.ts`'s nous light/dark values
(a histogram of the sampled region confirmed the dominant color at each location, not a single
possibly-antialiased pixel):

| Surface | Expected (light) | Sampled (light) | Location | Expected (dark) | Sampled (dark) | Location |
|---|---|---|---|---|---|---|
| background | `#fefefe` | `#fefefe` | `dev-sessions-light.png` @ (450,1600), empty area below the session list | `#0d1015` | `#0d1015` | `dev-sessions-dark.png` @ (450,1600) |
| card (assistant bubble) | `#fbfbfc` | `#fbfbfc` | `dev-chat-light.png` @ (720,1296), inside the "terminal" tool-call card | `#0e0f12` | `#0e0f12` | `dev-approval-dark.png` @ (80,600), inside an assistant "Done2." bubble — confirmed by histogram (32,093 of ~35,000 sampled px in that region) |
| primary | `#0053fd` | `#0053fd` | `dev-chat-light.png` @ (969,2196), the Send button fill | `#4a84fe` | `#4a84fe` | `dev-approval-dark.png` @ (138,1728), the Run button fill |
| border | `#d0d7de` | `#d0d7de` | `dev-chat-light.png`, histogram of (74-86,1194-1416), the "terminal" tool-call card's own outline | `#30363d` | `#30363d` | `dev-chat-dark.png`, histogram of (74-86,1566-1734), same card's outline |
| user bubble | `#fcfcfc` | `#fcfcfc` | `dev-chat-light.png` @ (840,828) | `#0f1621` | `#0f1621` | `dev-chat-dark.png` @ (840,1344) |
| destructive | `#cf2d56` | `#cf2d56` | `dev-approval-light.png` @ (55,1348), the approval card's red outline | `#cf2d56` | `#cf2d56` | `dev-approval-dark.png` @ (42,1500), same outline |

All six sampled exactly, both themes, from this round's own screenshots — not just re-quoting the
round-1 table above. **M13 still holds**, and the border/destructive conflation in the round-1 table
is corrected here rather than silently repeated.

**f. `npm run check`, after the last commit of this round (task 6).** Two lint findings surfaced by
this round's own new test file were fixed first (commit `3e0e7c0`: an unnecessary `\-` escape inside
the SVG-path-data character class, and a missing blank line before a `const` per
`padding-line-between-statements`) — both caught by this same `npm run check` run, not found by a
separate lint pass. Full run (`npm run typecheck && npm run test && npm run test:plugin && npm run
lint && prettier --check .`), tail:

```
> hermes-android@1.0.0 test
> vitest run

 Test Files  56 passed (56)
      Tests  492 passed (492)

> hermes-android@1.0.0 test:plugin
> python -m unittest discover -s server-plugin/hermes-push/tests -t server-plugin/hermes-push -p "test_*.py"
----------------------------------------------------------------------
Ran 52 tests in 3.701s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

`typecheck` produced no output (clean). The two intentionally-mocked failures inside `test:plugin`'s
own output ("Expo push send failed", a `RuntimeError: boom` traceback) are the plugin's own tests
exercising its error-handling paths, not real failures — the suite still reports `OK`, 52/52. **Exit
0, all green**, after this round's fixes (492 vitest tests, up from the prior round's count, since
`labels.test.ts` alone grew from 32 to 63 assertions across the widened scan).
