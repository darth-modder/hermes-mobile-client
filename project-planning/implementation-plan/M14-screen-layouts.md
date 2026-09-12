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

`confirm.html` → native `Alert`. `profile-dialogs.html`, `project.html`, `add-url.html`,
`mcp-install-link.html`, `plugin-install.html`, `memory-provider.html`, `send-diagnostics.html` →
sheets with the desktop's fields and labels. `worktree.html`, `real-browser-consent.html`,
`remote-folder-picker.html`, `archive-skill.html`, `profile-remote-override.html` → *absent*
(machine-bound) except `archive-skill`, which becomes a confirm `Alert` on the Skills screen.

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

## Verification log

(none yet — side-by-side pairs land as each screen's own commit reaches that exit criterion.)
