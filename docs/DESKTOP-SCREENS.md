# hermes-desktop screens

Every screen in the hermes-desktop app, checked on 2026-09-11 against `hermes-agent` at
`b973068c60`. All paths are relative to `hermes-agent/apps/desktop/`.

Most screens are defined in three files:
- `src/app/routes.ts`: the route table
- `src/app/contrib/wiring.tsx`: the overlays mounted in the main window
- `src/main.tsx` and `electron/main.ts`: the separate windows

Plugin screens come from `src/plugins/`.

## A. Main screens

### Full pages (replace the chat area)

| Screen | Route | Source |
|---|---|---|
| Chat | `/` (new chat), `/:sessionId` | `src/app/chat/` |
| Capabilities: tabs Skills (with the Skills Hub), Toolsets, MCP | `/skills` | `src/app/skills/` |
| Messaging | `/messaging` | `src/app/messaging/` |
| Artifacts | `/artifacts` | `src/app/artifacts/` |

### Overlay screens (large cards over the app)

| Screen | Route | Source |
|---|---|---|
| Settings (sections listed below) | `/settings` | `src/app/settings/` |
| Command Center: Sessions, Usage, System, Maintenance | `/command-center` | `src/app/command-center/` |
| Cron (scheduled jobs and templates) | `/cron` | `src/app/cron/` |
| Profiles | `/profiles` | `src/app/profiles/` |
| Agents (live subagent tree) | `/agents` | `src/app/agents/` |
| Starmap (the docs call it Memory Graph or Learning Journey; also opens with `/journey`) | `/starmap` | `src/app/starmap/` |
| Webhooks | `/webhooks` | `src/app/webhooks/` |

### Settings sections

The Settings menu is built in `src/app/settings/index.tsx`, and the config sections are listed
in `src/app/settings/constants.ts`.

- **Config sections:** Model, Chat, Appearance, Workspace, Safety, Browser, Memory & Context, Voice, Advanced
- **Notifications**
- **Billing**, plus its Plans view (`settings/billing/`)
- **Providers:** Accounts, API keys, Custom endpoints, Local models (only with the `--local` launch flag)
- **Gateways:** includes the list of connections and the per-profile overrides. The old
  *Connections* page was merged into this one, and old `?tab=connections` links redirect here.
- **Keybinds**
- **API Keys:** Tools, Settings
- **Plugins**
- **Archived chats**
- **About**

## B. Panels inside the Chat screen

The built-in panels are registered in `src/app/contrib/controller.tsx`.

| Panel | Source |
|---|---|
| Sessions sidebar: sessions, projects and worktrees, cron jobs, profile rail, connection switcher | `src/app/chat/sidebar/` |
| Workspace (the chat itself, or a full page) | `src/app/contrib/controller.tsx` |
| Files | `src/app/right-sidebar/files/` |
| Review (git diff, commit, PR) | `src/app/right-sidebar/review/` |
| Terminal | `src/app/right-sidebar/terminal/` |
| Logs (off by default; opens from the command palette only) | `src/app/contrib/controller.tsx` |
| Preview: browser, file, artifact, console | `src/app/chat/right-rail/` |
| Layout edit mode: "Layouts" card and preset picker | `src/components/pane-shell/tree/renderer/edit-bar.tsx`, `layout-picker.tsx` |
| Zone editor (custom grid layout, modelled on PowerToys FancyZones) | `src/components/pane-shell/tree/zone-editor.tsx` |

## C. Screens added by built-in plugins

### Bot Mode (on by default; turn it off in Settings → Plugins → Bots)

Source: `src/plugins/hermes-bots/`

| Screen | Source |
|---|---|
| Bots tab (next to Sessions in the left sidebar): the list of bots, user sections, group chats | `roster-pane.tsx`, `roster-sections.tsx` |
| Bot Chat: each bot's permanent conversation, with its own empty-chat view | `canonical-chat.ts`, `chat-empty.tsx` |
| Group chat | `group-chat-view.tsx` |
| Routines panel (right edge; only shown while the Bots tab is active) | `cron.tsx` |
| New Bot dialog | `create-dialog.tsx` |
| Edit bot/profile dialog | `edit-profile-dialog.tsx` |
| Avatar picker | `avatar-picker.tsx` |
| Model picker | `model-picker.tsx` |
| Skills Hub | `skills-hub.tsx` |
| MCP setup | `mcp-setup.tsx` |
| Manage groups (right-click a bot) | `user-sections-ui.tsx`, `group-membership.ts` |

### Kanban (off by default)

| Screen | Route | Source |
|---|---|---|
| Kanban board, with a board switcher, task drawer and its own sidebar link | `/kanban` | `src/plugins/kanban/` |

The Accent plugin (`src/plugins/accent/`) only adds a colour picker, so it has no screen.

## D. Windows

| Window | How it opens | Source |
|---|---|---|
| Main window | `createWindow` | `electron/main.ts` |
| Extra instance (a second full-app window) | `createInstanceWindow` | `electron/main.ts` |
| Session pop-out | `createSessionWindow` | `electron/main.ts` |
| Browser pop-out | `createBrowserWindow` | `src/app/chat/browser-popout-shell.tsx` |
| HUD (always-on-top floating bar) | `?win=hud` | `src/app/hud/hud-shell.tsx` |
| Quick Entry (global-hotkey composer) | `?win=quick` | `src/app/quick-entry/` |
| Pet overlay | `?win=overlay` | `src/app/pet-overlay/` |
| Wake indicator | `?win=wake` | `src/app/wake-indicator/` |
| OAuth login and Portal login (external sign-in pages) | `openOauthLoginWindow`, `openPortalLoginWindow` | `electron/main.ts` |
| Load-error page | shown when the app fails to load | `electron/renderer-load-error-page.ts` |

## E. App-wide overlays

| Overlay | Source |
|---|---|
| Onboarding: Preparing → provider picker → API key form or device-code sign-in → confirm model, plus the connect-to-a-remote-backend form | `src/components/onboarding/`, `src/components/first-run-remote-form.tsx` |
| Gateway connecting | `src/components/gateway-connecting-overlay.tsx` |
| Boot failure (can ask you to sign in again) | `src/components/boot-failure-overlay.tsx` |
| Desktop install | `src/components/desktop-install-overlay.tsx` |
| Updates | `src/app/updates-overlay.tsx` |
| Command palette, with Marketplace-theme and Pet sub-pages | `src/app/command-palette/` |
| Model picker | `src/app/model-picker-overlay.tsx` |
| Model visibility | `src/app/model-visibility-overlay.tsx` |
| Session picker | `src/app/session-picker-overlay.tsx` |
| Session switcher | `src/app/session-switcher.tsx` |
| Pet generate ("hatching" view) | `src/app/pet-generate/` |
| Chat swap and file-drop overlays | `src/app/chat/chat-swap-overlay.tsx`, `chat-drop-overlay.tsx` |
| Mid-turn prompts (approvals and questions while the agent works) | `src/components/prompt-overlays.tsx` |
| Find bar (Ctrl/Cmd+F) | `src/components/find-bar.tsx` |

## F. Dialogs

| Dialog | Source |
|---|---|
| Create, Rename and Delete profile | `src/app/profiles/*-profile-dialog.tsx` |
| Project | `src/app/chat/sidebar/project-dialog.tsx` |
| Worktree (with a base-branch picker) | `src/app/chat/sidebar/projects/worktree-dialog.tsx` |
| Add URL | `src/app/chat/composer/url-dialog.tsx` |
| MCP install link | `src/app/contrib/mcp-install-deeplink-dialog.tsx` |
| Real browser profile consent | `src/app/chat/right-rail/real-profile-consent-dialog.tsx` |
| Profile remote override | `src/app/chat/sidebar/profile-remote-override-dialog.tsx` |
| Archive skill | `src/app/learning/archive-skill-confirm-dialog.tsx` |
| Plugin install | `src/app/settings/plugin-install-modal.tsx` |
| Memory provider setup | `src/app/settings/memory/provider-config-modal.tsx` |
| Send diagnostics | `src/components/send-diagnostics-dialog.tsx` |
| Remote folder picker | `src/app/right-sidebar/files/remote-picker.tsx` |
| Confirm (general-purpose) | `src/components/ui/confirm-dialog.tsx` |

## G. Small in-app elements

| Element | Source |
|---|---|
| Remote-display banner | `src/components/remote-display-banner.tsx` |
| Billing banner | `src/components/billing-banner.tsx` |
| Status-bar pop-ups: model menu, gateway menu (with a log view), context usage | `src/app/shell/model-menu-panel.tsx`, `gateway-menu-panel.tsx`, `context-usage-panel.tsx` |

## Notes

- **Connections.** The desktop user guide still says "Settings → Connections", but the code
  merged it into Gateways (`src/app/settings/index.tsx:95`).
- **Plugin pages.** Any installed plugin can add its own full page. Those pages render inside
  the Chat area in place of the chat, the same way Kanban does.
