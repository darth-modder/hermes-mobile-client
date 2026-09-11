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
| Sessions sidebar (237px, nav rows 28px, then session rows) | The M10 drawer: same nav rows in the same order with the same Tabler icons and labels, 48 dp tall; the session list is its own screen | The SESSIONS / BOTS strip is not ported (Bots absent, PARITY) |
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

### C. Plugins

*Absent* by design (Bots, Kanban, routines).

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

(none yet)

## Verification log

(none yet)
