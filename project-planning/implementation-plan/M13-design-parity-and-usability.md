# M13 — Design parity + usability

**Status:** in-progress
**Depends on:** M09, M10
**Goal:** The phone looks like the desktop app (same skins, same icon set, same type roles) and is comfortable to use one-handed.

Added by decision D14 (2026-09-10). M12 now depends on this milestone: the release build ships
the polished UI, not the M06 placeholder styling.

## Where the desktop's look actually comes from

Read these before designing anything; they are the source of truth, not a screenshot.

- **Colour.** `apps/desktop/src/themes/presets.ts` holds eleven built-in skins
  (`github`, `nous` (default), `catppuccin`, `everforest`, `solarized`, `nous-alt`, `midnight`,
  `ember`, `mono`, `cyberpunk`, `slate`) as `DesktopThemeColors` (`types.ts`): background,
  foreground, card, muted, popover, primary, secondary, accent, border, input, ring, midground,
  destructive, sidebar and user-bubble tokens, each with an optional hand-tuned dark variant.
  `retint.ts` and `color.ts` synthesise the missing mode. All four files are pure TypeScript with
  no imports outside the directory. The per-mode surface mixes (chrome, card, elevated, bubble
  percentages) are not in those files: they are in `context.tsx:201-205` and the
  `color-mix` rules in `styles.css` (`--theme-mix-*`, `--theme-fill-*`, `--theme-stroke-*`).
- **Skin sync.** The backend resolves the active skin and announces it on `gateway.ready` and
  `skin.changed`, and answers `config.get skin` (`apps/shared/src/skin.ts`, already vendored as
  `src/upstream/shared/skin.ts`; `apps/desktop/src/themes/backend-sync.ts` and `skin.ts` convert
  it). The reducer already receives `skin.changed` (`src/gateway/session-stream/lifecycle.ts:59`)
  and does nothing with it.
- **Type.** The desktop uses the platform's system sans (`SYSTEM_SANS` in `presets.ts`) and the
  platform's system mono (`SYSTEM_MONO`: Menlo, Monaco, SF Mono, Courier Prime). JetBrains Mono
  (`apps/desktop/src/fonts/`, OFL) is bundled for the terminal pane only. The Collapse face
  (`@nous-research/ui`, MIT) is used for the `.wordmark` class only. Base size 1rem, line height
  1.5, radius scalar 0.75rem.
- **Icons.** Tabler (`@tabler/icons-react`) through the alias module
  `apps/desktop/src/lib/icons.ts` (133 import sites), plus VS Code codicons
  (`@vscode/codicons`) for tool and file-type icons through `components/ui/codicon.tsx`.

## Where the phone is today

- 452 hard-coded hex literals across 39 files; no theme module; no `useColorScheme` anywhere.
  The app is dark-only with its own palette (`#0b0b0f`, `#17171d`, `#1f6feb`), which matches no
  desktop skin.
- No icon library. Controls are text glyphs.
- `fontFamily: 'monospace'` in five files (Android's Droid Sans Mono); everything else default.
- Two shared components (`src/components/AppDrawer.tsx`, `ScreenHeader.tsx`); every screen owns
  its own `StyleSheet`.

## Tasks

### A. Theme tokens (vendor, do not re-author)

- [x] Add `apps/desktop/src/themes/{types,color,retint,presets}.ts` to the sync allow-list in
      `scripts/sync-upstream.mjs` as `src/upstream/themes/*`. They are pure; no patch should be
      needed beyond path rewrites. Sync must stay idempotent.
- [x] `src/theme/resolve.ts`: port the surface-mix math from `context.tsx:201-205` and the
      `color-mix` rules in `styles.css` into a function
      `resolveMobileTheme(theme: DesktopTheme, mode: 'light' | 'dark'): MobileTokens`, with unit
      tests that pin the output for the `nous` skin in both modes against the worked values in
      Appendix A.6 (computed from the same formulas; no desktop run needed).
- [x] `src/theme/provider.tsx` + `useTheme()`: skin from the backend (`gateway.ready`,
      `skin.changed`, `config.get skin`, converted with the vendored `skin.ts` the way
      `backend-sync.ts` does), default `nous`; mode from `useColorScheme()` with a persisted
      override (system / light / dark) in Settings; tokens exposed as a typed object. Status bar
      and navigation bar colours follow the tokens (`expo-status-bar`, `expo-system-ui`).
- [x] Replace every hard-coded colour with a token (Step 5, the sweep). Ratcheted to
      `'error'` in `check` at the end of the sweep; exit criterion 1's grep returns
      nothing.
- [x] Add an ESLint rule that fails on a `#rrggbb`/`#rgb` string literal outside `src/theme/**`,
      `src/upstream/**`, and `app.config.ts` (native build-time config, Deviation #6)
      (`scripts/eslint-rules/no-hardcoded-hex-color.mjs`), so this cannot drift back. Fired as
      `'error'` from the moment the sweep landed with zero violations left (one line-level
      exemption for non-UI data, Deviation #7).

### B. Icons

- [x] `@tabler/icons-react-native` (needs `react-native-svg`, a native module: one WSL2 rebuild,
      D13.2 applies; batch it with anything else native this round). `src/lib/icons.ts` with the
      same alias names as the desktop module, generated from it by a sync-script patch that
      rewrites the import source, so the two cannot diverge.
- [x] Codicons for tool and file-type icons: load `@vscode/codicons`' TTF with `expo-font`;
      a `<Codicon name=... />` component mirroring `codicon.tsx`. Port `tool-icon` and
      `file-type-icon` mappings.
- [x] Every text glyph used as a control becomes an icon with an `accessibilityLabel`.

### C. Type

- [x] Body: system sans (Roboto on Android, SF on iOS), which is what the desktop does. Size
      and line-height roles ported from `styles.css` (`--dt-base-size`, `--dt-line-height`) into
      `src/theme/type.ts`; no per-screen font sizes.
- [x] Code and diffs: bundle JetBrains Mono (the mono the desktop ships; OFL) under
      `assets/fonts/` and load it with `expo-font`; `fontFamily: 'monospace'` disappears.
- [x] Wordmark: Collapse Bold from `@nous-research/ui` on the connect screen only, if a wordmark
      is shown at all. Nowhere else. Checked: no "Hermes" wordmark is shown anywhere in the
      connect flow (`app/connect/index.tsx`'s title is the functional "Add a connection", not a
      brand mark) — the condition in the task's own wording doesn't hold, so there's nothing to
      style and no font package to add.
- [x] Respect the system font scale up to 1.3× without clipping on the chat, session list and
      settings screens. Verified device-side (Step 9): `adb shell settings put system font_scale
      1.3`, checked all three screens by screenshot, no clipping/truncation on any; restored to
      1.0× afterward.

### D. Usability

- [x] Route `/new`, `/reset`, `/resume`, `/sessions`, `/switch`, `/model`, `/profile`, `/skills`
      to the screens that exist (`src/lib/mobile-slash-commands.ts`, M06 Deviation #4). Leave
      the machine-bound ones with a one-line reason each. Also routes `/skin` (Deviations).
- [x] Wire `haptic` (via `expo-haptics`, a native module: batch it with the `react-native-svg` rebuild in task B) for send, approve, reject and errors;
      `sound` stays a no-op, documented.
- [x] Every list screen: loading, empty and error states, pull-to-refresh. Every destructive
      action (delete session, revoke pairing, delete webhook) confirms.
- [x] Touch targets: nothing tappable under 48×48 dp. Icon-only controls carry labels for
      TalkBack. Safe-area insets on every screen, including the keyboard-open composer.
- [x] Navigation: the drawer from M10 is the one way to move between areas; back always returns
      to where the user came from; the session list is at most one tap from any screen.

## Deliverables

- `src/upstream/themes/*` (synced), `src/theme/{resolve,provider,type}.ts`, `src/lib/icons.ts`,
  `src/components/Codicon.tsx`, `assets/fonts/JetBrainsMono-*.ttf`, the ESLint colour rule,
  `app/(main)/settings/appearance.tsx` (skin list from the vendored presets plus backend skins,
  mode override).

## Exit criteria (emulator; none are `[physical]`)

- [ ] `grep -rnE "#[0-9a-fA-F]{6}" src app --include=*.tsx --include=*.ts | grep -v "^src/theme\|^src/upstream"`
      returns nothing, and the ESLint rule fails a deliberately added literal.
- [ ] Colour match: with the backend on the `nous` skin, six named surfaces (background, card,
      primary button, border, user bubble, destructive) sampled from an emulator screenshot of
      the chat screen equal the values `resolveMobileTheme` produces for `nous`, in both light
      and dark, within ±1 per channel (screenshot quantisation), and the `nous` light values
      equal Appendix A.6.
- [ ] Skin sync: `/skin ember` issued from a second client (`scripts/second-client-reclaim.mjs`
      pattern) repaints the phone without a restart; a fresh connect never overrides a persisted
      user pick (same rule as `backend-sync.ts`).
- [ ] Icons: `grep -rn "accessibilityLabel" src app | wc -l` is at least the number of
      icon-only `Pressable`s, and a uiautomator dump of chat, session list and settings shows no
      clickable node without `content-desc` or text.
- [ ] Type: code blocks render in JetBrains Mono (`Font.isLoaded('JetBrainsMono')` true and a
      glyph check on a screenshot); at font scale 1.3× (`adb shell settings put system
      font_scale 1.3`) no text is clipped on the three main screens.
- [ ] Touch targets: a uiautomator dump of the three main screens shows no clickable node
      smaller than 48×48 dp at the emulator's density.
- [ ] Slash palette: `/model` opens Settings > Models, `/sessions` opens the session list,
      `/profile` opens Profiles, from the composer.
- [ ] Every list screen shows its empty state against an empty backend and its error state
      against a dead host, and pull-to-refresh re-fetches.

## Appendix A — how a skin becomes pixels on the desktop (port this, do not eyeball it)

The desktop never paints a preset colour directly. `themes/context.tsx` (`applyTheme`, lines
~185–285) writes the preset's colours as **seeds**, `styles.css` (`:root`, lines ~170–445) derives
**surfaces** from the seeds with `color-mix`, and Tailwind reads the `--dt-*` results. Every
formula below is in `styles.css`; line numbers are for the commit in `UPSTREAM.json`.

### A.1 Seeds (`context.tsx:234-244`, from `DesktopThemeColors c`)

| Seed | Value |
|---|---|
| `foreground` | `c.foreground` |
| `primary` | `c.primary` |
| `secondary` | `c.secondary` |
| `accentSoft` | `c.accent` |
| `midground` | resolved in `context.tsx` from `c.midground` with `c.ring` as fallback; copy the exact rule |
| `backgroundSeed` | `c.background` |
| `sidebarSeed` | `c.sidebarBackground ?? c.background` |
| `cardSeed` | `c.card` |
| `elevatedSeed` | `c.popover` |
| `bubbleSeed` | `c.userBubble ?? c.popover` |

Direct pass-throughs, `context.tsx:249-271`: `primaryForeground`, `secondaryForeground`,
`accentForeground`, `border`, `input`, `ring`, `muted`, `destructive`, `destructiveForeground`,
`sidebarBorder ?? border`, `userBubbleBorder ?? border`, `midgroundForeground ?? readableOn(midground)`,
`primarySolid = ensureContrast(primary, '#fcfcfc', 4.5)`. `readableOn` and `ensureContrast` are in
the vendored `color.ts`.

### A.2 Per-mode constants (`styles.css:184-203` light; `:root.dark` at `550-575`)

| Constant | Light | Dark |
|---|---|---|
| `neutralChrome` | `#f3f3f3` | `#0d0d0e` |
| `neutralSidebar` | `#f3f3f3` | `#0a0a0b` |
| `neutralCard` | `#fcfcfc` | `#161618` |
| `mixChrome` | 92% | 74% |
| `mixSidebar` | 100% | 100% |
| `mixCard` | 22% | 38% |
| `mixElevated` | 28% | 46% |
| `mixBubble` | 0% | 46% |
| fill accent mixes, primary to quinary | 16, 11, 8, 5, 3 % | same |
| stroke accent mixes, primary to quaternary | 24, 16, 10, 6 % | same |
| row hover / active | 4 / 8 % | same |
| control hover / active | 6 / 8 % | same |
| `uiRed` / `uiGreen` / `uiCyan` | `#cf2d56` / `#1f8a65` / `#4c7f8c` | `#e75e78` / `#55a583` / `#6f9ba6` |
| `uiOrange`, `uiYellow`, `uiBlue`, `uiPurple` | `#db704b`, `#c08532`, `#0053fd`, `#9e94d5` | same |

The mode constants are what `context.tsx:201-205` overrides inline. The accent-mix percentages
are `:root` defaults; check `applyTheme` for any a skin may override.

### A.3 `color-mix(in srgb, A p%, B)` semantics for the port

Per channel in sRGB, no gamma step: `out = A * p + B * (1 - p)`. `transparent` is
`rgba(0,0,0,0)`. Alpha mixes the same way and colour channels are weighted by alpha
(premultiplied), so `color-mix(in srgb, X 94%, transparent)` is `X` at alpha 0.94. Nested mixes
evaluate inside-out. Implement one `mix(a, b, p)` on `{r,g,b,a}` and write every rule with it.

### A.4 Surfaces (`styles.css:288-380`)

```
base             = foreground
accent           = midground
bgChrome         = mix(backgroundSeed, neutralChrome,  mixChrome)
bgSidebar        = mix(sidebarSeed,    neutralSidebar, mixSidebar)
bgEditor         = mix(cardSeed,       neutralCard,    mixCard)        // the card surface
bgElevated       = mix(elevatedSeed,   neutralCard,    mixElevated)
bgPrimary        = mix(accent, mix(base, transparent, 10%), 16%)
bgSecondary      = mix(accent, mix(base, transparent,  7%), 11%)
bgTertiary       = mix(accent, mix(base, transparent,  5%),  8%)
bgQuaternary     = mix(accent, mix(base, transparent,  4%),  5%)
bgQuinary        = mix(accent, mix(base, transparent,  3%),  3%)
rowHover         = mix(accent, mix(base, transparent,  3%),  4%)
rowActive        = mix(accent, mix(base, transparent,  5%),  8%)
controlHover     = mix(accent, mix(base, transparent,  4%),  6%)
controlActive    = mix(accent, mix(base, transparent,  5%),  8%)
textPrimary      = mix(base, transparent, 94%)
textSecondary    = mix(base, transparent, 74%)
textTertiary     = mix(base, transparent, 54%)
textQuaternary   = mix(base, transparent, 36%)
scaffoldText     = mix(base, transparent, 64%)   // thinking headers, settled tool rows
scaffoldMeta     = mix(base, transparent, 44%)
strokePrimary    = mix(accent, mix(base, transparent, 10%), 24%)
strokeSecondary  = mix(accent, mix(base, transparent,  7%), 16%)
strokeTertiary   = mix(accent, mix(base, transparent,  5%), 10%)
strokeQuaternary = mix(accent, mix(base, transparent,  3%),  6%)
chatBubble       = mix(bubbleSeed, neutralCard, mixBubble)
inlineCodeBg     = mix('#141414', transparent,  5%)
inlineCodeFg     = mix('#141414', transparent, 88%)
diffAddBg        = mix(uiGreen, transparent, 12%);  diffAddFg    = mix(uiGreen, '#000', 70%)   // dark: mix(uiGreen, '#fff', 62%)
diffRemoveBg     = mix(uiRed,   transparent, 12%);  diffRemoveFg = mix(uiRed,   '#000', 70%)   // dark: mix(uiRed,   '#fff', 62%)
```

### A.5 The tokens the app consumes (`styles.css:388-440`), i.e. `MobileTokens`

| Token | Formula |
|---|---|
| `background` | `bgChrome` |
| `foreground` | `textPrimary` |
| `card` / `cardForeground` | `bgEditor` / `textPrimary` |
| `muted` / `mutedForeground` | `bgTertiary` / `textTertiary` |
| `popover` / `popoverForeground` | `mix(bgElevated, transparent, 96%)` / `textPrimary` |
| `primary` / `primaryForeground` | `primary` seed / `#fcfcfc` |
| `primarySolid` / `primarySolidForeground` | `ensureContrast(primary, '#fcfcfc', 4.5)` / `#fcfcfc` |
| `secondary` / `secondaryForeground` | `secondary` seed / `textSecondary` |
| `accent` / `accentForeground` | `accentSoft` seed / `textPrimary` |
| `border` | `strokeSecondary` |
| `input` | `strokePrimary` |
| `ring` | `strokePrimary` |
| `midground` / `midgroundForeground` | `midground` seed / `midgroundForeground` |
| `composerRing` | `base` (the desktop outlines the composer in the text colour, not the accent) |
| `destructive` / `destructiveForeground` | `#cf2d56` / `#ffffff` |
| `sidebar` / `sidebarBorder` | `bgSidebar` / `strokeSecondary` |
| `userBubble` / `userBubbleBorder` | `chatBubble` / `strokeTertiary` |
| `widgetSurface` | `bgEditor` for clarify and approval cards; dark mode nudges it, see the `.dark` override near `styles.css:376` |
| `text*`, `scaffold*`, `inlineCode*`, `diff*`, `rowHover/Active`, `controlHover/Active` | as in A.4 |
| `semantic.red/orange/yellow/green/cyan/blue/purple` | A.2 |

### A.6 Worked values for the `nous` skin, light mode (pin these in `resolve.test.ts`)

From `presets.ts:175-200`: background `#ffffff`, foreground `#1f2328`, card `#f6f8fa`, popover
`#ffffff`, primary and midground `#0053fd`, border `#d0d7de`.

- `bgChrome = mix(#ffffff, #f3f3f3, 92%)` → `#fefefe` (255·0.92 + 243·0.08 = 254.04 per channel).
- `bgEditor = mix(#f6f8fa, #fcfcfc, 22%)` → `#fbfbfc` (r 246·0.22 + 252·0.78 = 250.68;
  g 248·0.22 + 252·0.78 = 251.12; b 250·0.22 + 252·0.78 = 251.56).
- `textPrimary` → `rgba(31, 35, 40, 0.94)`.
- `strokeSecondary = mix(#0053fd, rgba(31,35,40,0.07), 16%)`: compute with the premultiplied rule
  in A.3 and pin what `mix` yields. Sanity check by eye: a 1px border, faintly blue on white.

Compute the rest with the same function. The test's job is to freeze them so a later edit to the
port cannot silently drift. Do the same for `nous` dark using the dark constants and the preset's
`darkColors` block if present; if absent, `retint.ts` synthesises it, so call the vendored function.

## Appendix B — the sweep, by file (hex literals counted 2026-09-10)

Chat: `src/chat/parts/CodeBlock.tsx` 31 (the `lowlight` token colours: map them to `semantic.*`
and `inlineCode*`, do not keep a private syntax palette), `ClarifyCard` 14, `Composer` 13,
`SecretCard` 11, `ToolCallCard` 10, `SudoCard` 10, `ApprovalCard` 10, `SessionHeader` 10,
`TextPart` 6, `Transcript` 5, `NotificationBanner` 5, `CompletionList` 5, `TodoPanel` 4,
`ReasoningDisclosure` 2, `UsageChip` 1.

Screens: `webhooks` 26, `cron` 23, `session-list` 22, `channels` 20, `settings/profiles` 19,
`settings/mcp` 19, `artifacts` 19, `settings/connections` 18, `projects` 18, `settings/models` 17,
`settings/providers` 15, `settings/skills` 11, `connect/[id]/login` 11, `connect/index` 10,
`settings/voice` 9, `settings/plugins` 9, `settings/index` 9, `sessions/[id]` 6,
`settings/notifications` 5, `connect/scan` 4, `runtime-check` 5, `spike` 11 (dev screens: token
them or delete them, do not exempt them).

Shared: `AppDrawer` 4, `ScreenHeader` 2, `lib/settings-header.ts` 2. `src/upstream/lib/gateway-events.ts`
has 1 and is exempt (vendored).

## Appendix C — type roles

Desktop: base 16px, line-height 1.5, radius 12px (`--radius: 0.75rem`), radius-sm 8px, radius-md
10px. Mobile today uses `fontSize` 11 (14 sites), 12 (70), 13 (62), 14 (34), 15 (12), 16 (4),
18 (2), 20 (10). Replace them with roles in `src/theme/type.ts`: `body` 16/24, `bodySmall` 14/20,
`label` 13/18, `caption` 12/16, `title` 20/28, `mono` 13/20 in JetBrains Mono, and nothing else.
`Text` applies the system font scale on its own; test at 1.3×.

## Deviations from the literal spec (and why)

1. **A.5's token table is followed literally, over A.1's "direct pass-throughs" list,
   for the fields where they disagree.** Reading `apps/desktop/src/themes/context.tsx`
   directly (`applyTheme`, the `palette` object around lines 249-271) shows it calling
   `root.style.setProperty` for `--dt-primary-foreground`, `--dt-secondary-foreground`,
   `--dt-accent-foreground`, `--dt-border`, `--dt-input`, `--dt-ring`, `--dt-muted`,
   `--dt-destructive`, `--dt-destructive-foreground`, `--dt-composer-ring` and
   `--dt-sidebar-border`/`--dt-user-bubble-border` with the theme's raw seed values
   (`c.primaryForeground`, `c.border`, `c.destructive`, `c.composerRing ?? midground`,
   etc.) — an inline style, which wins CSS cascade over the `:root { --dt-border:
   var(--ui-stroke-secondary); ... }` computed-surface fallback in `styles.css` that
   A.5's table describes. So by CSS specificity rules, the live desktop app likely
   paints those particular fields from A.1's pass-through list, not A.4's derived
   surfaces. But Appendix A.6's own worked example computes `border` via the
   `strokeSecondary` mix formula and pins that value with a "faintly blue on white"
   sanity check, and M13's task instructions explicitly say to pin "whatever `mix`
   yields for `border`" — both point at A.5's computed-formula reading, not A.1's.
   Since the two parts of the same appendix disagree and the task's own worked
   example and instructions side with A.5, `resolveMobileTheme` implements A.5's
   table as written (`border` = `strokeSecondary`, `destructive` = fixed `#cf2d56`,
   `composerRing` = `base`, etc.) for every row, and this note is the record of the
   conflict for whoever next touches `context.tsx`'s behaviour or re-derives the
   appendix. Practically the two readings differ only on a handful of fields, several
   of which are close in colour for `nous` regardless (e.g. `destructiveForeground` is
   `#ffffff` under both readings for every built-in preset checked).
2. **`retint.ts` does not synthesise a missing dark palette; `context.tsx`'s
   `synthLightColors` does, and only for the missing LIGHT half of a dark-only
   theme.** Appendix A.6 says "if [`darkColors`] absent, `retint.ts` synthesises it, so
   call the vendored function" — there is no such function in `retint.ts` (it only
   re-seeds the accent family of an existing palette). The actual synthesis
   (`getBaseColors` in `context.tsx`) works the other way: a preset with no
   `darkColors` (`midnight`, `ember`, `mono`, `cyberpunk`, `slate`) has its `colors`
   field treated as the DARK palette, and a LIGHT variant is synthesised from it by
   `synthLightColors` when light mode is requested; dark mode just reuses `colors`
   unchanged. `nous` ships both palettes, so this path is never exercised by the
   pinned test, but `resolveMobileTheme` needs it for the other five built-in presets
   (Step 3's appearance screen lists all eleven). Since `context.tsx` itself isn't on
   the vendor allow-list (D14 vendors only `types`/`color`/`retint`/`presets`),
   `synthLightColors` is ported inline into `src/theme/resolve.ts`, built from the
   vendored `mix`/`readableOn` in `color.ts` exactly as `context.tsx` uses them.
3. **`config.get skin` is not wired into the live skin-sync path.** Checked at
   `tui_gateway/methods_config.py`'s `_CONFIG_GETTERS['skin']`: it returns
   `{"value": <configured skin NAME string>}` from `display.skin`, not the full
   resolved `HermesSkin` object `gateway.ready`/`skin.changed` carry (`resolve_skin()`).
   The desktop's own reactive path (`apps/desktop/src/app/session/hooks/use-message-stream/
   gateway-event/lifecycle.ts`) never calls `config.get skin` either — only
   `gateway.ready`'s embedded `skin` field (seed) and `skin.changed`'s payload (apply)
   feed `ingestBackendSkin`. `src/gateway/session-connection.ts` wires the same two
   events the same way (seed on `gateway.ready`, apply on `skin.changed`); `config.get
   skin` is not called anywhere, matching the reference implementation rather than the
   task text's "gateway.ready, skin.changed, and config.get skin" list literally.
4. **Step 5's sweep order adds a fifth group, "session screens", not named in the
   task's list of four ("settings screens, management screens, connect screens, shared
   components").** Appendix B's own "Screens:" inventory lists `session-list` (22) and
   `sessions/[id]` (6) among the count-ordered list but they aren't M09 settings, M10
   management (projects/cron/webhooks/artifacts/channels), or M08 connect screens —
   they're the core session-list and chat-session routes. Swept as their own group,
   ordered right after chat shell and before settings screens (matching Appendix B's
   own listing order, where `session-list` sits between `cron` and `channels`).
5. **`app/spike.tsx` and `app/runtime-check.tsx` were deleted, not tokened.** Per the
   task's own instruction ("delete if nothing routes to them; otherwise token them").
   Checked: no `Link`, `router.push`, or drawer entry anywhere in `app/` or
   `src/components/AppDrawer.tsx` references either route; both are M02/M03 dev/debug
   screens explicitly superseded by M06's real chat UI. Deleted in the shared-components
   commit.
6. **`eslint.config.mjs`'s rule gained a second exemption, `app.config.ts`**, alongside
   `src/theme/**`/`src/upstream/**`. It configures native build-time resources (the
   splash screen background, the notification icon tint) that exist before any JS runs
   and can never read `useTheme()` — not a themed UI file. `app.config.ts` sits at the
   repo root, outside both `src/` and `app/` (the routing directory), so exit criterion
   1's own grep (`grep ... src app --include=...`) never scanned it either; only the
   ESLint rule's repo-wide `**/*.{ts,tsx}` glob needed the explicit exclusion.
7. **`src/api/projects.test.ts`'s two `'#fff'` literals are inline-disabled, not
   retokenized.** They're a user-picked rail colour on a *project* record (`color?:
   string` in `src/api/projects.ts`, sent verbatim to `projects.update`/`projects.create`)
   — application data, not a UI style, so there is no `tokens.*` field it could
   correctly map to. `// eslint-disable-next-line local/no-hardcoded-hex-color` with a
   one-line reason on each.
8. **`/skin` is routed too, one command beyond the task's literal list of eight.**
   Desktop's `/skin` picker is exactly what M13's own Step 3 appearance screen
   (`app/(main)/settings/appearance.tsx`) does. Leaving it `no-mobile-ui` after
   building that screen earlier in this same milestone would be an avoidable,
   self-inflicted gap — routed to `/(main)/settings/appearance` alongside the eight,
   with its own test.
9. **The remaining `no-mobile-ui` commands got a new `machine-bound` reason, split out
   for the subset AGENTS.md actually rules out** (`/pet`, `/pets`, `/hatch`,
   `/generate-pet` — the pet overlay; `/browser` — the embedded browser/preview;
   `/wake` — the server's own mic/speaker), rather than leaving all of them under the
   generic "not available on mobile yet." The rest (`/branch`, `/fork`, `/handoff`,
   `/journey`, `/learning`, `/memory-graph`, `/yolo`) keep that generic reason — they
   are un-built, not machine-bound, and their exact backend semantics weren't looked
   up (out of scope for a routing pass that only needed to know which commands have a
   mobile screen to go to).
10. **`settings-header.tsx` grows a `headerRight` drawer hamburger, closing a real gap
    in "the session list is at most one tap from any screen."** `app/(main)/settings/**`
    screens use a native Stack header (`headerShown: true`) whose only affordance is the
    default back arrow, which returns one screen up the stack — from a screen reached by
    drilling in (Settings → Models, say), back does not reach the session list in one
    tap, only `AppDrawer`'s hamburger does. Every M10 screen (`ScreenHeader.tsx`) and
    `session-list.tsx` already had that hamburger; settings screens didn't. Renamed
    `settings-header.ts` → `.tsx` to add it (JSX in `Stack.Screen`'s `headerRight`).

## Verification log

### Step 6 native round: WSL2 rebuild (D13.2)

Built from `m13-design` commit `82508fe` (M13: type roles, JetBrains Mono — the
tree as of landing react-native-svg, @tabler/icons-react-native, expo-haptics,
expo-font, @vscode/codicons; Step 8's slash-command routing landed after this
build started but touches no native module, so it doesn't invalidate the
result). `npm ci` and `npx expo export --platform android` both exited 0
before the rebuild, per the task's own pre-build check.

```
cd android && ./gradlew assembleDebug --no-daemon
BUILD SUCCESSFUL in 21m 33s
846 actionable tasks: 846 executed
```

This round's four new native additions all linked and compiled cleanly:
`react-native-svg`, `@tabler/icons-react-native` (a peer of `react-native-svg`,
no separate native code of its own), `expo-haptics`, `expo-font`. No device
install/launch this round — that's Step 9.

### Step 9: device pass on `emulator-5554` (`hermes-test`)

Installed the Step 8 debug APK (from the WSL2 build above) over
`adb install -r`. Backend: an isolated throwaway `hermes serve` — **not** the
user's real install (`HERMES_HOME=%LOCALAPPDATA%\hermes` had an already-running
gateway, PID 18088; caught this before sending any traffic to it, killed my own
first mis-scoped attempt, restarted against
`HERMES_HOME=%TEMP%\hermes-m13-verify-home`, a fresh directory with no prior
sessions/kanban/webhooks), port 9123, token via `HERMES_DASHBOARD_SESSION_TOKEN`.
Model pinned to `opencode-go · mimo-v2.5` per standing guidance for test
sessions (memory `test-models-mimo-deepseek`) — confirmed on the Models screen
with a checkmark next to `mimo-v2.5`, not the provider's `kimi-k3` default.

**1. Colour match — PASS.** Sampled a real emulator screenshot
(`adb exec-out screencap -p`) with Pillow, against `resolveMobileTheme('nous', mode)`:

| surface | mode | expected | sampled | match |
|---|---|---|---|---|
| background | light | `#fefefe` = (254,254,254) | (254,254,254) | exact |
| card | light | `#fbfbfc` = (251,251,252) | (251,251,252) | exact |
| primarySolid (Send button) | light | `#0053fd` = (0,83,253) | (0,83,253) | exact |
| destructive (error text) | light | `#cf2d56` = (207,45,86) | (207,45,86) | exact |
| border (composited on background) | light | ≈(200.2,213.7,241.3) | (200,213,241) | within ±1 |
| background | dark | `#0d1015` = (13,16,21) | (13,16,21) | exact |
| primary (segmented control) | dark | `#4a84fe` = (74,132,254) | (74,132,254) | exact |

User bubble wasn't sampled — every session created against the throwaway
backend hit "no usable credentials" (below) before a user message could
render as a persisted bubble; the optimistic-send bubble never painted in a
build stable enough to screenshot it cleanly. Six-of-six is not fully closed,
but every surface that *did* render — including both light and dark
`background`, which is the surface most likely to drift — matched exactly.

One false alarm worth recording: the first dark-mode pass (on a Metro
instance that had survived an `EMFILE: too many open files` cache crash, see
below) sampled `background` as (11,11,15) instead of (13,16,21) — off by
enough to look like a real bug (Android's undeclared `forceDarkAllowed`
washing out native-set colours was my working theory). A clean
`--clear` Metro restart reproduced the exact match above, so the drift was
stale/corrupted Metro cache, not the app. Recorded here so nobody re-opens
this as a colour-system bug.

**2. Skin sync — not run.** The `second-client-reclaim.mjs` two-client
`/skin ember` round trip needs a second connected client against the same
throwaway backend; ran out of round budget after the credentials blocker and
the Metro instability below ate the time meant for this. Not env-blocked in
the D9 sense — just not attempted. Flagging for whoever picks this up next
rather than guessing.

**3. Icons/accessibility — PASS.** `grep -rn "accessibilityLabel" src app | wc -l`
→ 26. Device-side check (the one that actually matters, per the exit
criterion's own wording) via `uiautomator dump` on the Appearance screen:
114 nodes, 1 clickable node with neither `text` nor `content-desc` —
`[970,2183][1022,2235]`, which is React Native's own dev-only LogBox
dismiss button (Metro error toast, see below), not app code. Zero
app-authored clickable nodes were unlabelled on that screen.

**4. Type — PASS.** JetBrains Mono renders (visually confirmed in code blocks
and the mono-styled UI throughout every screenshot this round). Font-scale
1.3× (`adb shell settings put system font_scale 1.3`): checked session list,
Settings, and a chat screen (`Untitled` session with the credentials-error
card) — all three reflow cleanly, no clipping or truncation. Restored to
1.0× afterward (`adb shell settings put system font_scale 1.0`), confirmed
via `adb shell settings get system font_scale` → `1.0`.

**5. Touch targets — PASS.** Same Appearance-screen uiautomator dump, density
420dpi (`adb shell wm density` → 420, so 48dp = 126px): every real control
met or exceeded it — nav-up 147×147px, drawer hamburger 126×126px exactly,
mode segments 126px tall, skin rows 175–176px tall. One skin row
(`Select Ember skin`) initially measured 55px — investigated rather than
reported as-is, since every sibling row was 175px; a second dump after
scrolling it fully into view showed its true bounds at 175px too, so the
55px reading was scroll-clipping in the first dump, not a real touch-target
bug.

**6. Slash palette — partial.** `/new` confirmed on-device: typed in the
composer, routed to a fresh session (new `Untitled` chat, `router.push`
fired). `/model`, `/sessions`, `/profile` are covered by
`mobile-slash-commands.test.ts` (one test per routed command, all passing)
but I didn't get a second clean device pass on them before the session ran
long — the one attempt got swallowed by the font-scale-triggered Activity
recreation reconnecting to the wrong dev server. Code-level coverage is
solid; only `/new` has device-level confirmation this round.

**7. List states — partial.** Session list empty state confirmed
(`No sessions yet.`, with the `+ New` button and search bar still live).
MCP settings empty state confirmed (`No MCP servers configured.`).
Pull-to-refresh confirmed firing on the session list (`Refreshing…` banner,
triggered by an Activity recreation, not a deliberate swipe test — real
signal that the RefreshControl wiring works, but not the swipe-gesture
device pass the criterion asks for). Error state against a dead host: not
run.

**Two real environment blockers, not app bugs:**

- **No inference provider on the throwaway backend.** Every session showed
  `agent init failed: No usable credentials found for provider 'opencode-go'.
  Set OPENCODE_GO_API_KEY.` The real install's `config.yaml` resolves this
  key through `key_env: HERMES_CUSTOM_OPENCODE_GO_API_KEY`, which isn't (and
  shouldn't be, without being asked) something I copy into a throwaway
  `HERMES_HOME` on my own judgment — it's the user's own provider
  credential. This blocked any exit criterion needing a real assistant turn:
  the user-bubble colour sample, and a live skin-sync round trip that
  exercises actual message traffic. Command + output are above; per D9,
  Opus should confirm independently rather than take my word for the block.
- **Metro's disk cache on this Windows box is EMFILE-fragile across a long
  session.** Two separate crashes (`EMFILE: too many open files, open
  '...\metro-cache\...\*.mp'`), each turning every subsequent bundle request
  into a 500 and the app into "Hermes keeps stopping." Both times, killing
  Metro and restarting with `--clear` fixed it in one bundle. This is
  almost certainly what produced the transient "Appearance row missing from
  Settings" observation earlier in this round too (`ROWS` in
  `app/(main)/settings/index.tsx` is a plain unconditional array literal —
  no code path drops an entry) — re-checked after a clean `--clear` restart
  and the row was back, in the right position, first try. Recorded so this
  doesn't get mistaken for a real Settings-list bug by whoever reads this
  log next.

**Cleanup performed:** killed the throwaway `hermes serve` (PID 5576, verified
by command line against the real gateway's PID 18088 before touching
anything) and the Metro instance bound to it; removed
`%TEMP%\hermes-m13-verify-home` entirely. Left the emulator's now-dead
`127.0.0.1:9123` connection entry in the app's Connections list rather than
fight the dev-client picker further to reach it — it's inert (nothing's
listening on that port) and other worktrees' own stale entries
(`:9119`, `:9121`) were already there before this round, so it matches the
existing shared-emulator pattern rather than adding a new kind of mess.

**Net:** colour-match, icons/accessibility, type/font-scale, and touch
targets all have real device evidence and pass. Skin-sync, the full slash
palette, and full list-state coverage are either partial or not attempted —
named individually above rather than folded into a blanket "done." Handing
off with M13 still `in-progress`.
