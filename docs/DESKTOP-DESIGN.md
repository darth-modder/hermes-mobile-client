# hermes-desktop design system

The complete visual design of the hermes-desktop app: how its colours are built, the themes, type, spacing, radius,
elevation, components, icons, motion and glass effects. It is written for anyone rebuilding desktop screens elsewhere,
and it pairs with:

- [`DESKTOP-SCREENS.md`](DESKTOP-SCREENS.md): every screen, with its source files.
- [`desktop-prototypes/`](desktop-prototypes/README.md): HTML mockups of every screen, built from these tokens.
  `desktop-prototypes/assets/tokens.css` is this document as working CSS.

Checked on 2026-09-11 against `hermes-agent` at `b973068c60`. Every path below is relative to
`hermes-agent/apps/desktop/`. Where the desktop's own `DESIGN.md` and its code disagree, this document follows the code
and [lists the differences](#13-where-the-desktops-designmd-and-its-code-disagree).

---

## 1. How the tokens work

Colour is never written directly into components. It flows through four layers:

```
skin palette ──applyTheme()──▶ --theme-* seeds ──color-mix()──▶ --ui-* semantic tokens ──▶ --dt-* (shadcn) ──▶ --color-* (Tailwind)
themes/presets.ts            themes/context.tsx:233-245      src/styles.css l.206-386       l.388-441        @theme inline l.94-167
```

1. **Palette.** A skin (`DesktopTheme`, `themes/types.ts`) gives about 26 colours for light, and optionally for dark:
   background, foreground, card, muted, popover, primary, secondary, accent, border, input, ring, midground,
   composerRing, destructive, sidebarBackground, userBubble, and so on. Only `background`, `foreground` and `primary`
   are required.
2. **Seeds.** `applyTheme()` writes the palette onto `<html>` as `--theme-*` seeds. Watch these mappings: `--theme-warm`
   is set to `primary`, sidebar falls back to background, the bubble falls back to popover, and the elevated seed comes
   from popover. It also writes per-mode mix knobs, and it overwrites a few `--dt-*` slots directly from the palette.
   Those slots are border, input, ring, muted, the foregrounds, destructive, composerRing, sidebarBorder and
   userBubbleBorder.
3. **Semantic tokens.** `styles.css` derives every surface, text, stroke, row and control colour with `color-mix()`,
   using one pattern: **accent at N% over foreground at M%, over transparent**. This is why every skin's greys pick up a
   hint of its accent.
4. **shadcn / Tailwind.** `--dt-*` names the shadcn roles. Tailwind v4 maps them to utilities through
   `@theme inline`. There is no `tailwind.config`. Components mostly use arbitrary-variable utilities such as
   `bg-(--ui-bg-quaternary)`.

**Rule:** components use `--ui-*`, `--dt-*` or `--theme-*`, never raw hex. The only sanctioned literal in components
is the white tile behind `BrandMark`.

Light and dark run **the same formulas with different seeds and mix knobs.** To port the system, port the formulas,
not a list of hex values.

## 2. Principles

From `DESIGN.md` and `AGENTS.md`:

- **Flat, not boxed.** No card inside a card, and no divider lines inside a panel. Use spacing to separate. When a
  divider is truly needed, use one `--ui-stroke-tertiary` hairline.
- **Floating things have one elevation language.** Dialogs use `--shadow-nous` plus a `--stroke-nous` hairline. Menus
  and popovers use `--shadow-md` plus `--ui-stroke-secondary`.
- **One primitive per concern, and styling lives in the primitive.** Call sites pass `variant` and `size`, never
  `h-*`, `px-*` or `py-*` overrides.
- **Chat is home.** Pages (Chat, Capabilities, Messaging, Artifacts) stay inside the shell. Route overlays (Settings,
  Command Center, Cron, Profiles, Agents, Starmap, Webhooks) are cards that float over it. Panes (preview, files,
  review, terminal) hold working context. One action, one home.
- **Immediate feedback.** Paint first, reconcile later, and roll back visibly on failure. "If motion is masking
  latency, remove the motion, don't tune it."
- **Respect the person.** Never steal focus or navigate on a background event. Empty, loading, reconnecting, degraded
  and exhausted-recovery are distinct states. Surfaces stay alive while hidden.
- **Never** use the literal text "Loading…" (use a `Loader`), `window.confirm` (use `confirm()` from
  `store/confirm.ts`), or a native `title=` tooltip (a test enforces this).

## 3. Colour

### 3.1 Seeds and mix knobs (`styles.css` l.170-204, `context.tsx:200-206`)

| Knob | Light | Dark | Used by |
|---|---|---|---|
| `--theme-mix-chrome` | 92% | 74% | `--ui-bg-chrome` = bg-seed at N%, then neutral-chrome |
| `--theme-mix-sidebar` | 100% | 100% | `--ui-bg-sidebar` |
| `--theme-mix-card` | 22% | 38% | `--ui-bg-editor` = card-seed at N%, then neutral-card |
| `--theme-mix-elevated` | 28% | 46% | `--ui-bg-elevated` = popover at N%, then neutral-card |
| `--theme-mix-bubble` | 0% | 46% | `--ui-chat-bubble-background` = userBubble at N%, then neutral-card |
| `--theme-neutral-chrome` | `#f3f3f3` | `#0d0d0e` | |
| `--theme-neutral-sidebar` | `#f3f3f3` | `#0a0a0b` | |
| `--theme-neutral-card` | `#fcfcfc` | `#161618` | |

The accent-over-base percentages are the same in both modes:

| Family | Accent % | Base % |
|---|---|---|
| fill primary / secondary / tertiary / quaternary / quinary | 16 / 11 / 8 / 5 / 3 | 10 / 7 / 5 / 4 / 3 |
| stroke primary / secondary / tertiary / quaternary | 24 / 16 / 10 / 6 | 10 / 7 / 5 / 3 |
| row hover / active | 4 / 8 | 3 / 5 |
| control hover / active | 6 / 8 | 4 / 5 |

`--ui-row-open-background` (a row open in a pane that isn't focused) is the row-active colour at 28%.

### 3.2 Formulas

```css
--ui-bg-chrome:   color-mix(in srgb, var(--theme-background-seed) var(--theme-mix-chrome), var(--theme-neutral-chrome));
--ui-bg-tertiary: color-mix(in srgb, var(--ui-accent) 8%, color-mix(in srgb, var(--ui-base) 5%, transparent));
--ui-text-secondary: color-mix(in srgb, var(--ui-base) 74%, transparent);
/* --ui-base = --theme-foreground, --ui-accent = --theme-midground */
```

- **Text:** primary / secondary / tertiary / quaternary = base at **94 / 74 / 54 / 36%**. Transcript scaffolding
  (thinking headers, tool rows) uses `--conversation-scaffold-text` = base 64% and `-meta` = base 44%.
- **Surface aliases:**
  - chat surface = editor-surface = `--ui-bg-chrome`
  - sidebar = `--ui-bg-sidebar`
  - `--ui-surface-background` = `--ui-bg-editor`
  - terminal = the chat surface
  - widgets = editor (dark: editor 88% + black)
- **Popover:** `--dt-popover` = elevated at 96%.
- **Composer fill:** card at 72% (`styles.css` l.1842-1853). It drops to 48% while the thread is scrolled up.
- **Input chrome:** the border is `--dt-composer-ring` at `--dt-input-border` (7% light, 4% dark). Hover doubles it,
  and focus or open makes it solid. The inset is `inset 0 1px 1px` black at 10% (38% in dark), removed on focus. The
  input fill is card at `--dt-input-bg` (0%).

### 3.3 Semantic palette (`styles.css` l.206-241, 561-565)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--ui-red` | `#cf2d56` | `#e75e78` | |
| `--ui-orange` | `#db704b` | same | |
| `--ui-yellow` | `#c08532` | same | "needs you" state |
| `--ui-green` | `#1f8a65` | `#55a583` | |
| `--ui-cyan` | `#4c7f8c` | `#6f9ba6` | |
| `--ui-blue` | `#0053fd` | same | |
| `--ui-purple` | `#9e94d5` | same | |
| `--ui-success` | runtime | runtime | `harmonize('#10b981', midground, 0.25)`: emerald bent a quarter of the way toward the accent |
| `--ui-warm` | = primary | = primary | used by skill, git and diff reference colours |
| `--dt-destructive` | skin (nous `#cf222e`) | skin (nous `#f85149`) | |

- **Diff:** add and remove use green and red at 12% for the background, the full colour for the border, and the colour
  mixed 70% with black for the foreground (in dark, 62% with white).
- **Context-usage bar:** system = base 55%, tools = purple, rules = green, skills = yellow, mcp = red 72%/purple,
  subagents = blue 70%/cyan, memory = orange 80%/yellow, conversation = cyan.
- **Memory-write "legendary" tool row:** a gradient from gold to purple (`styles.css` l.226-231).
- **Selection:** `#ffd24a` at 55% (38% in dark).
- **Inline code:** `#141414` at 5% with text at 88% (dark: white at 7% with text at 88%).
- **Inline references** (`.ref`, l.825-901) are coloured text, never chips:
  - file / folder / line / terminal: text-secondary
  - url / image / session / theme: accent-secondary at 82%
  - command / tool: accent at 82%
  - skill / git / diff / staged: warm at 82%

### 3.4 Resolved values for the default `nous` skin

These come from running the formulas in the prototype. Alpha is the last byte of an 8-digit hex value. Translucent
tokens render over whatever surface sits behind them.

| Token | Light | Dark |
|---|---|---|
| `--ui-bg-chrome` (chat surface, titlebar) | `#fefefe` | `#0d1015` |
| `--ui-bg-sidebar` | `#f6f8fa` | `#010409` |
| `--ui-bg-editor` (card) | `#fbfbfc` | `#0e0f12` |
| `--ui-bg-elevated` | `#fdfdfd` | `#16181d` |
| `--dt-popover` | `#fdfdfdf5` | `#16181df5` |
| `--ui-chat-bubble-background` / `--dt-user-bubble` | `#fcfcfc` | `#0f1621` |
| `--ui-widget-surface-background` | `#fbfbfc` | `#0c0d10` |
| `--composer-fill` | `#fbfbfcb8` | `#0e0f12b8` |
| `--ui-bg-card` | `#0d409914` | `#99b3ff14` |
| `--ui-bg-primary` | `#0c42b53e` | `#80a9fb3e` |
| `--ui-bg-secondary` | `#0c40ae2c` | `#80a8f92c` |
| `--ui-bg-tertiary` | `#0840af20` | `#80a7f720` |
| `--ui-bg-quaternary` | `#0c3aa216` | `#8baef316` |
| `--ui-bg-quinary` | `#1133990f` | `#99bbff0f` |
| `--ui-row-hover-background` | `#0e39aa12` | `#8eaaff12` |
| `--ui-row-active-background` | `#0840af20` | `#80a7f720` |
| `--ui-control-hover-background` | `#0a3dad19` | `#85adff19` |
| `--ui-control-active-background` | `#0840af20` | `#80a7f720` |
| `--ui-text-primary` | `#1f2328f0` | `#e6edf3f0` |
| `--ui-text-secondary` | `#1f2328bd` | `#e5edf3bd` |
| `--ui-text-tertiary` | `#1f23298a` | `#e5edf48a` |
| `--ui-text-quaternary` | `#1e24275c` | `#e6eef45c` |
| `--ui-stroke-primary` | `#0648c951` | `#719dfc51` |
| `--ui-stroke-secondary` | `#0944c438` | `#729ffa38` |
| `--ui-stroke-tertiary` | `#0745ba25` | `#7ca5f825` |
| `--ui-stroke-quaternary` | `#0c46b916` | `#80a2ff16` |
| `--sidebar-edge-border` | `#1b282813` | `#e6eff71f` |
| `--dt-border` (palette) | `#d0d7de` | `#30363d` |
| `--dt-muted` (palette) | `#f6f6f6` | `#1a1e24` |
| `--dt-primary` | `#0053fd` | `#4a84fe` |
| `--dt-primary-solid` | `#0053fd` | ≈`#3f70d8` (runtime `ensureContrast`) |
| `--ui-success` | ≈`#00b0a3` | ≈`#00b6aa` |
| `--ui-diff-add-foreground` | `#166147` | `#96c7b2` |
| `--ui-diff-remove-foreground` | `#911f3c` | `#f09bab` |

The light chat bubble is near-white (`#fcfcfc`), not blue: `--theme-mix-bubble` is 0% in light. In dark the bubble
takes 46% of the skin's `userBubble` (`#07162c`).

## 4. Themes (`src/themes/`)

- **Eleven built-in skins** (`presets.ts:848-865`, in this order): **nous** (the default, `DEFAULT_SKIN_NAME`), github,
  catppuccin (Latte / Mocha), everforest, solarized, nous-alt, midnight, ember, mono, slate and cyberpunk.
  - The first five are forks of VS Code Marketplace themes.
  - nous-alt is first-party: "Glass neutrals, cream on mission-blue".
  - Midnight, ember, mono, slate and cyberpunk are dark-only.
  - Retired names: `nous-light`, `default`, `gold`.
- **Mode** is `light | dark | system`, defaulting to system. Shift+X toggles it (`appearance.toggleMode`).
- **Skin and mode are stored per profile**, in `hermes-desktop-profile-themes-v1` and `-modes-v1`. Each profile keeps
  its own look.
- **Which mode actually renders** is decided by the palette's background luminance, not by the user's preference
  (`renderedModeFor`, `context.tsx:172-182`). A dark-only skin in light mode gets a synthesised light variant
  (`synthLightColors`, l.108-142).
- **Accent retint** (`retint.ts`, used by the Accent plugin, which is off by default): re-seeds only the accent family.
  - accent-soft = `mix(accent, bg, .88 / .82)`
  - secondary = `.86 / .72`
  - userBubble = `.12 / .18`
  - The chrome is left alone.
- **Importing themes** (`vscode.ts`, `install.ts`, `skin.ts`): VS Code Marketplace themes and CLI YAML skins are
  converted into the same palette shape.
  - Accent priority starts from `button.background → textLink → activityBarBadge → …`.
  - The accent is then passed through `ensureContrast(sidebar, 4.5)`.
  - Installed themes are saved under `hermes-desktop-user-themes-v1`.
- **First paint:** `index.html` paints from `hermes-boot-background` before React loads, falling back to `#111111` or
  `#f7f7f7`.

### The nous palette (`presets.ts:174-233`)

| Key | Light | Dark |
|---|---|---|
| background | `#ffffff` | `#0d1117` |
| foreground (and every *Foreground on surfaces) | `#1f2328` | `#e6edf3` |
| card / sidebarBackground | `#f6f8fa` | `#010409` |
| muted / mutedForeground | `#f6f6f6` / `#656d76` | `#1a1e24` / `#7d8590` |
| popover | `#ffffff` | `#161b22` |
| primary = ring = midground = composerRing | `#0053fd` | `#4a84fe` |
| primaryForeground / midgroundForeground | `#ffffff` | `#161616` |
| secondary / accent | `#deeaff` / `#e3edff` | `#1d2e4f` / `#17243a` |
| border = sidebarBorder = userBubbleBorder | `#d0d7de` | `#30363d` |
| input | `#ffffff` | `#0d1117` |
| destructive / destructiveForeground | `#cf222e` / `#ffffff` | `#f85149` / `#ffffff` |
| userBubble | `#dae7fd` | `#07162c` |

The two blues are one hue (263°). `#0053fd` has 5.4:1 contrast on the light sidebar but only 3.6:1 on the dark one, so
dark lifts it to `#4a84fe` (5.9:1). The terminal uses GitHub's ANSI palette.

## 5. Typography

| Role | Family | Size / line height | Source |
|---|---|---|---|
| UI (sans) | `'Segoe WPC','Segoe UI',-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display',system-ui,sans-serif` + emoji | body **13px** (`0.8125rem`) / 1.5; root 16px | `presets.ts:29-31`, `styles.css` l.755-770 |
| Mono (code, diffs) | `Menlo, Monaco, 'SF Mono', 'Courier Prime', monospace` + emoji. Courier Prime loads from Google Fonts for nous, github and nous-alt. | usually 11-12px | `presets.ts:33` |
| Terminal | JetBrains Mono 400 / 700 / 400-italic (bundled woff2); midnight and slate also use it as their mono | 12px | `styles.css` l.72-92 |
| Key caps | native system UI font (`--dt-font-kbd`), never the theme's font | 11px (md), 10px (sm) | `kbd.tsx` |
| Tooltip | Arial, bold | 11px | `tooltip.tsx:125` |
| Wordmark | `'Collapse'` 700, uppercase, `letter-spacing .08em`, `line-height .9`, sized to its container, `text-midground` + `mix-blend-plus-lighter` (dark: foreground 90%) | ≥2.75rem | `styles.css` l.1684-1728, `components/chat/wordmark.tsx` |

| Text use | Size | Weight / notes |
|---|---|---|
| Conversation prose | 13px (`--conversation-text-font-size`) | line height 1.5; paragraph gap `.7rem` |
| Tool / scaffold rows | 11px (`--conversation-tool-font-size`) | line height 18px |
| Captions | 12px / 16px | tertiary text |
| Buttons, controls, menus | 12px / 16px (`text-xs leading-4`) | medium; the `xs` size is 11px |
| Large buttons and controls | 14px / 20px | |
| Sidebar rows | 13px, line height 1.35 | nav rows are medium; session rows are regular, text-secondary |
| Sidebar date dividers | 10.24px (`.64rem`), uppercase, tracking `.12em` | semibold, quaternary |
| Dialog title | 15px (`.9375rem`) | semibold, tight tracking |
| Panel header | 14px | semibold |
| Section labels | about 10px (`.6rem`), uppercase, wider tracking | |
| Status bar | 11px | tertiary text |
| Badge | 10.4px (`.65rem`); xs 9.6px | medium, `leading-none` |

Letter spacing is 0 by default. Text is `user-select: none` except in the transcript.

## 6. Spacing and layout

| Metric | Value | Source |
|---|---|---|
| Window (e2e default) | 1220 × 800 | `e2e/fixtures.ts` |
| Titlebar | **34px** high; controls 24×24, icons 13.9px; cluster edge inset 14px; macOS traffic-light offset 74px | `app/shell/titlebar.ts` |
| Status bar | **20px** (`h-5`), sidebar surface, items `px-1.5` at 11px | `statusbar-controls.tsx:102-104` |
| Window layout | the titlebar runs **across the whole window** (in flow); zones sit below it (sessions sidebar, workspace, right panes); the status bar spans the bottom | `components/pane-shell/*`, `overlays/overlay-view.tsx` |
| Sessions sidebar | **237px** (`14.8125rem`), max 360px; `px-2.5`. Its zone always shows a 28px **SESSIONS / BOTS** tab strip (9px uppercase labels, 2px primary underline on the active tab), then the nav rows (`pt` = titlebar + .375rem, where the titlebar height is zeroed inside panes) | `store/layout.ts:16-23`, `sidebar/index.tsx:1488`, `pane-shell/tree/strip-visibility.ts` |
| Sidebar nav row | 28px high, radius-md, `px-2`, gap 8px, 16px icon at 72% of the text colour | `sidebar/index.tsx:1516` |
| Session row | min 26px; `pl-2 pr-2` with gap 6px; 14px lead cell; 13px label at 1.35 line height. Card density: min 54px. | `sidebar/row-geometry.ts` |
| File browser (right) | 237px default, 10-20rem | `store/layout.ts` |
| Sidebar collapse | below 640px | `layout-constants.ts` |
| Page gutter | `clamp(1.25rem, 4vw, 4rem)`; page max width 75rem | `layout-constants.ts` |
| Chat column | `px-6 py-8`, `max-width: var(--composer-width)` (100%), turn gap `.375rem`, block gap `.75rem`, message indent `.75rem` | `thread/list.tsx:823`, `styles.css` l.472-497 |
| Composer | dock `calc(min(composer-width, 100% - 2rem) + 10px)`; surface padding `.5rem × .3125rem`; controls 24px, send 26px; input 26-150px; row gap 4px; popped-out width 24rem | `styles.css` l.500-513 |
| Route overlay | scrim `black/22` + 2px blur; inset `titlebar + .625rem` (sm and up: `+ .875rem`) on every side | `overlays/overlay-view.tsx` |
| Overlay split layout | `13rem │ 1fr`, one column below 47.5rem; nav item 28px, radius-md, 13px | `overlays/overlay-split-layout.tsx` |
| Panel (list/detail overlays) | content `px-4 pb-4 sm:px-5`; list 13rem; row 28px at `.78rem`; meta `.62rem` | `overlays/panel.tsx` |
| Settings ListRow | grid `1fr │ minmax(15rem,22rem)`, `py-3`, gap 12px; sections `mb-6` | `settings/primitives.tsx` |
| Pane shell | minimum pane 80px; a collapsed zone is a 28px rail | `pane-shell/tree/renderer/track-model.ts` |
| Tile minimums | preview/route 22rem, session 20rem; chat minimum 28rem | |
| File tree row | 22px (`--file-tree-row-height`) | |

## 7. Radius, elevation, stacking

### Radius: every value is multiplied by 0.2

Tailwind radii are `calc(var(--radius-scalar) * N)` with `--radius-scalar: 0.2` (`styles.css` l.123-130, 464), so they
render very small:

| Class | Effective |
|---|---|
| `rounded-xs` | ≈0.4px |
| `rounded-sm` | 1.6px |
| `rounded-md` | 2px |
| `rounded-lg` | 2.4px |
| `rounded-xl` | 3.2px |
| `rounded-2xl` | 4.8px |
| `rounded-3xl` | 6.4px |
| `rounded-4xl` | 8px |
| `rounded-full` | fully round |

Hard-coded radii: buttons and controls 2.5px, icon buttons 4px, badges 3px, the segmented track 5px and its options
3px. **The desktop look is nearly square.** Don't bring 8-16px mobile-style radii into a desktop replica.

### Shadows and strokes (`styles.css` l.141-166)

| Token | Value | Used for |
|---|---|---|
| `--shadow-xs` | `0 1px 2px` black 5% | checkbox, active tab |
| `--shadow-sm` | 1px ring of foreground 6% + `0 2px 8px` black 4% | active segmented option |
| `--shadow-md` | 1px ring of foreground 8% + `0 4px 16px` black 8% + `0 16px 32px -24px` black 18% | menus, popovers, sheets, **overlay cards** |
| `--shadow-nous` | four downward layers (7/6/6/0% black) with negative spread, so the shadow pools under the panel | **dialogs** |
| `--stroke-nous` | `currentColor` at 3% | the hairline paired with shadow-nous |
| `--shadow-lg` | inset white 28% top light + ring + `0 12px 32px` black 12% | raised special cases |
| `--shadow-composer` | `0 1px 2px` black 5% | composer |

Floating menus add `backdrop-filter: blur(.75rem) saturate(1.08)` over the elevated surface at 96%.

### Z-index ladder (`styles.css` l.249-263)

| Rung | Value |
|---|---|
| `--z-modal-backdrop` | 120 |
| `--z-modal` | 130 |
| `--z-modal-popover` | 140 |
| `--z-over-modal` (toasts, tooltips) | 200 |
| `--z-over-modal-content` | 210 |
| `--z-switcher-backdrop` | 219 |
| `--z-switcher` | 220 |
| `--z-connecting` | 1200 |
| `--z-onboarding` | 1300 |
| `--z-onboarding-popover` | 1310 |
| `--z-setup` | 1400 |
| `--z-crash` | 1500 |

Local stacking inside a component uses plain `z-10` / `z-20`.

## 8. Components (`src/components/ui/`)

**Button** (`button.tsx`):
- Base: `inline-flex gap-1.5 rounded-[2.5px] text-xs leading-4 font-medium transition-all duration-100`, disabled at
  50% opacity, icons 14px.

| Variant | Look |
|---|---|
| `default` | primary fill, primary-foreground text, 90% on hover |
| `destructive` | destructive fill, white text (dark: 60%) |
| `outline` | transparent, with an inset 1px ring of stroke-secondary at 50%; hover `--chrome-action-hover` |
| `secondary` | `--ui-bg-quaternary` fill, text-primary |
| `ghost` | text-secondary; hover chrome-action-hover plus text-primary |
| `link` | primary text, underline on hover |
| `text` | muted text; foreground plus underline on hover |
| `textStrong` | semibold, underlined, no padding |

| Size | Spec |
|---|---|
| `default` | `px-3 py-1.5` |
| `xs` | `px-2 py-0.5`, 11px, 12px icons |
| `sm` | `px-2.5 py-1` |
| `lg` | `px-5 py-2`, 14px |
| `inline` | no padding |
| `micro` | `px-1`, 12px regular |
| `icon` | 36px |
| `icon-xs` | 24px |
| `icon-sm` | 32px |
| `icon-lg` | 40px |
| `icon-titlebar` | 24px, 13.9px icon |

Icon sizes use a 4px radius. There are no fixed heights: height comes from padding plus the 16px line height.

**Badge:** 3px radius, `.65rem` medium, `leading-none`.
- Variants: `default` (primary at 10% with primary text), `muted`, `success` (emerald), `warn` (amber), `destructive`,
  `outline`, `solid`.
- Sizes: `default`, `xs`, `overlay` (an 8px dot or count).

**Controls** (Input, Textarea, SelectTrigger share `controlVariants`):
- `desktop-input-chrome rounded-[2.5px] border text-xs`.
- Sizes: xs `px-2 py-0.5` at 11px, sm `px-2 py-1`, default `px-2.5 py-1.5`, lg `px-3 py-2` at 14px.
- Textarea minimum height 64px. The select trigger adds a codicon `chevron-down` at 60% opacity.
- Autocapitalise, autocorrect and spellcheck are off.

**Switch:** fully round, 1px border of foreground 18%.
- Track: background 58% into input. Thumb: foreground (background when on). On: primary fill.
- Default is 20×36px with a 16px thumb; xs is 16×28px with a 12px thumb.

**SegmentedControl** (small exclusive choices):
- Track: `bg-tertiary p-0.5 rounded-[5px] gap-0.5`.
- Options: `rounded-[3px] px-2.5 py-0.5`, 11px medium; active is background fill, foreground text, shadow-sm.

**Tabs:**
- `Tabs`: list 36px, muted, `p-1`; trigger 28px at 14px; active background plus shadow-xs.
- `TextTab`: 28px, caption size, tertiary text; active is foreground plus underline.
- `PaneTab`: 11px medium, full zone height, max 12rem; active has a 2px inset underline in `--theme-primary`; idle
  hover darkens by `--ui-tab-hover-darken` (2.5%, dark 6%).

**Dialog:**
- Scrim: `black/22` + 2px blur at `--z-modal-backdrop`.
- Card: `max-w-lg` (fit-content variant: up to 92vw), `max-h-85vh`, `rounded-xl`, `border-(--stroke-nous)`,
  `bg-(--ui-chat-bubble-background)`, `shadow-nous`, body `grid gap-3 p-4`.
- Close: ghost icon-xs at the top right, `2.5` from each edge.
- Title 15px semibold, with an optional 16px primary icon. Description is caption size, tertiary.
- Banners: error destructive at 12%, warn primary at 12%, info from the bubble colour.
- Motion: fade plus zoom-95, 200ms.

**Sheet:**
- Side panel, 75% wide up to 24rem, on the sidebar surface, stroke-secondary edge, shadow-md.
- Header and footer `p-3`. Opens in 500ms, closes in 300ms.

**Popover:**
- `w-72 rounded-lg p-2`, stroke-secondary border, elevated surface at 92% with `backdrop-blur-md`, `sideOffset 6`,
  collision padding 8, 16×7 arrow.
- The `accent` variant uses the loud `--dt-primary-solid` fill.

**DropdownMenu / ContextMenu:**
- Content: `min-w-36 rounded-lg p-1`, stroke-secondary border, elevated surface at 96%, shadow-md, blur.
- Items: `rounded-md px-2 py-1 text-xs`; focused items get `--ui-control-active-background`; 14px icons in tertiary.
- Section label `.625rem` uppercase; separator is a stroke-tertiary hairline.

**Tooltip:**
- Opens after 200ms. Within a 300ms warm window it opens instantly, and it closes instantly. Overflow tips open after
  600ms and only when the text is actually clipped.
- The chip is foreground-on-background, `px-1.5 py-1`, Arial 11px bold, `box-decoration-clone` (a marker-pen fill per
  line), no fade.
- Keybind hints come from `<TipKeybindLabel actionId>`. Tips only open from keyboard focus, never mouse focus.
- **Don't tip** menu triggers, close X buttons, or controls whose label already says it.

**Other primitives:**
- `Checkbox`: 16px, radius-sm, codicon check or dash.
- `Kbd`: system font; md is 22px at 11px, sm is 18px at 10px.
- `SearchField`: borderless, underlined on focus, 30% opacity until focused or filled, 28px high.
- `EmptyState`: at least 12rem, title 14px medium, description 12px muted.
- `Loader`: 21 SVG curve animations, e.g. `lemniscate-bloom` for long operations.
- `GlyphSpinner`: a compositor-only `steps()` sprite strip.
- `WIDGET_SHELL_CLASS`: `rounded-3xl bg-(--ui-widget-surface-background) px-3.5 py-3` for inline chat widgets.
- User bubble: `rounded-xl border bg-(--dt-user-bubble) px-3 py-2`, sticky at the top of its turn.
- Composer controls (`app/chat/composer/control-classes.ts`):
  - Icon buttons are 24px, `rounded-md`, tertiary text, with chrome-action-hover on hover.
  - A toggle that is on (dictation, spoken replies, wake word) uses primary at 10% with primary text.
  - **Send / voice button:** a round 26px button in the text colour on the background colour (black on white in
    light, white on black in dark), not the accent colour. Disabled, it drops to text colour at 30%.

**Focus:** there are no focus rings anywhere (`styles.css` l.1232-1240). Inputs and the composer show focus through
their border colour. Pointer cursors are set on interactive roles at the base layer.

**Scrollbars:** 4px wide, with a neutral (chroma-free) thumb at 18%, 40% on hover. `.scrollbar-fade` shows the thumb
only on hover.

## 9. Icons

- **Tabler** (`@tabler/icons-react` 3.44.0) is the default set. It is only ever imported through `src/lib/icons.ts`,
  which re-exports about 120 icons under **lucide-style names** (`IconX as X`, `IconRefresh as RefreshCw`).
  - Size scale: xs 12px, sm 14px, md 16px, lg 20px, xl 24px.
  - The shadcn `components.json` declares `iconLibrary: "tabler"`. Lucide is **not** a dependency.
- **Codicons** (`@vscode/codicons` 0.0.45) cover editor, tool and status glyphs through `<Codicon name>`: titlebar
  buttons (13.9px), the close X, select chevrons, checkbox marks, panel rows and file types.
- **No third icon set.** `BrandMark` (a 56px white tile with the Nous artwork) replaces sparkle-style AI icons.

## 10. Motion and haptics

**Principles:**
- Motion follows state and never delays it.
- Controls animate in about 100ms.
- Only compositor-friendly properties (transform, opacity) are animated. No `transition-all` on hot interactions, and
  no backdrop-filter repaints during movement.
- `prefers-reduced-motion` sets every duration to 0.01ms (`styles.css` l.24-33).
- `:root[data-renderer-animations-paused]` stops decorative loops while the window is hidden.

| Element | Timing |
|---|---|
| Button / control hover | 100ms |
| Row hover | lands instantly, fades out over 100ms ease-out |
| Input border | 200ms ease-out |
| Scrollbar fade | 150ms |
| Unfocused pane (opacity .62 / dark .72, plus grayscale) | 75ms |
| Transcript scaffold dimming (.67 → 1 on hover) | 120ms |
| Dialog | fade + zoom 95%, 200ms |
| Sheet | open 500ms / close 300ms |
| Element enter (`use-enter-animation`) | `translateY(.375rem) → 0`, 180ms `cubic-bezier(.16,1,.3,1)`, once per key |
| Tool ticker | 240ms `cubic-bezier(.22,1,.36,1)` |
| Jump-to-bottom button | in 200ms (scale 1.1 → 1), out 180ms |
| Reaction pop / particle pop | 260ms `cubic-bezier(.34,1.56,.64,1)` |
| Pet reveal | 620ms `cubic-bezier(.22,1.4,.4,1)` |
| Working-row arc border | 2.23s linear loop, transform only |
| Setting deep-link flash | 1.6s |
| Glass peek | out 160ms `cubic-bezier(.32,.72,0,1)`, back 420ms `cubic-bezier(.22,1,.36,1)` |

**Haptics** (`lib/haptics.ts`, can be muted from the titlebar). Duration is in ms, intensity from 0 to 1:

| Intent | Pattern | Used for |
|---|---|---|
| `selection` | 16 @ .52 | toggles, picks (most common, throttled to one per 50ms) |
| `crisp` | 10 @ .92 | |
| `tap` | 14 @ .58, +30ms 12 @ .42 | |
| `open` / `close` | 18 @ .42 → 22 @ .66 / 22 @ .58 → 16 @ .34 | overlays |
| `submit` | 24 @ .58, +48ms 36 @ .82 | |
| `success`, `streamDone` | three rising pulses up to .86 | |
| `streamStart` | 10 @ .32 | |
| `cancel` | 34 @ .72 → 26 @ .38 | |
| `warning` | 34 @ .64, +84ms 42 @ .5 | |
| `error` | three pulses up to .86 | |

At most 5 haptics fire per second.

## 11. Translucency, glass, HUD, backdrop, particles

**Window translucency** (`apps/shared/src/translucency.ts`, `store/translucency.ts`, `styles.css` l.613-738):
- **Modes:**
  - **Clear** changes the native window opacity (floor .3, curve 2).
  - **Glass** thins the renderer's surfaces over a native material. The materials are under-window, popover, titlebar
    and header; on Windows these map to acrylic, tabbed or mica.
- **Scope** is the whole window or the sidebar only.
- **Defaults** (intensity / material):
  - macOS light: 66 / header
  - macOS dark: 22 / titlebar
  - Windows light: 20 / under-window
  - Windows dark: 5 / under-window
- **Under glass:**
  - `<body>` is the only surface that paints: the chrome colour at `(100 − intensity)%`.
  - Chat, sidebar and editor surfaces go transparent. The terminal stays opaque.
  - Overlay cards (`[data-glass-raised]`) keep at least 94%.
  - `[data-glass-opaque]` restores a solid fill, for example on dragged rows.

**Message bubble** transparency: `--user-bubble-keep` runs from 100% down to 0%. The border always stays.

**HUD** (`app/hud/*`, `styles.css` l.2642-3572):
- A chrome-free, always-on-top bar with a white-ink transcript band over a dark scrim, `rgb(12 14 18 / .62)` (.72-.82
  while engaged). User lines are gold (`#ffcf6b`) with a text shadow.
- Band radius `.75rem .75rem 0 0`. The composer bar is `.75rem` radius on the card colour, with an accent border on
  focus.
- Frost is on only while the composer has focus. Resize handles are .625rem on edges and 1.25rem on corners.
- Easing: enter `cubic-bezier(.16,1,.3,1)`, exit `cubic-bezier(.4,0,.7,.2)`.

**Backdrop** (off by default): a statue image at 2.5% opacity with `mix-blend-difference`, inverted in light mode.

**Particles:**
- 12 per burst, 6-13px, rising for 320-700ms with sway.
- "Vibe hearts" are `#ff9ec4` pixel hearts, shown when you say thanks.
- They respect reduced motion.

## 12. Accessibility notes

- **Contrast:** skins pick accents that clear AA (4.5:1) against their sidebar (nous is 5.4:1 light and 5.9:1 dark).
  - `--dt-primary-solid` is deepened at runtime until white text on it clears 4.5:1.
  - Imported themes run their accent through `ensureContrast(sidebar, 4.5)`.
- **Focus:** there are no visible focus rings. Keyboard focus is shown by the border (inputs), the row background (lists)
  or the tooltip (keyboard focus opens tips). A replica on a platform that needs visible focus has to add it.
- **Reduced motion:** honoured globally. Decorative loops also pause while the window is hidden.
- **Keyboard:** every action has a rebindable keybind (`Settings → Keyboard Shortcuts`). Esc cancels in a fixed layer
  order (`lib/escape-layers`). Keyboard ownership follows focus.
- **Touch targets:** titlebar buttons are 24px, half the 48dp touch minimum, and grow vertically only
  (`data-touch-target="y"`).

## 13. Where the desktop's DESIGN.md and its code disagree

1. **Button radius.** DESIGN.md (and a code comment) say text buttons are square, but the base class is
   `rounded-[2.5px]` (`button.tsx:14`).
2. **Outline ring.** The comment says 1.5px; the class is 1px at 50% stroke-secondary.
3. **Badge `success`.** The variant exists in code but isn't listed in DESIGN.md.
4. **Overlay elevation.** DESIGN.md says route overlays use `shadow-nous` + `--stroke-nous`. `OverlayView` actually
   uses `shadow-md` + `border-(--ui-stroke-secondary)`. Only `Dialog` uses the nous pair.
5. **Z-index.** DESIGN.md says to use the ladder, but OverlayView, Sheet, Popover and DropdownMenu use `z-50`. Dialog,
   Select and Tooltip use the ladder.
6. **Radius scalar.** `--radius: 0.75rem` suggests rounded UI, but every radius utility is multiplied by 0.2.
7. **Sidebar width.** `--sidebar-width` is 237px, while the shadcn `sidebar.tsx` default is 16rem.
8. **Border colour.** `styles.css` defaults `--dt-border` to `--ui-stroke-secondary`, but `applyTheme()` overwrites it
   with the skin's solid `border` (nous `#d0d7de` / `#30363d`). Everything using `border-border` gets the solid colour.
9. **Stale comment.** `src/sdk/index.ts:1645` calls the Tabler aliases "lucide".

## 14. Mapping to the Android client

The phone doesn't imitate this system; it copies the desktop's theme code (decision D14 in
`project-planning/DECISIONS.md`):

- **Colour formulas and mobile token table:** `project-planning/implementation-plan/M13-design-parity-and-usability.md`,
  Appendix A. This is on the `m13-design` branch until it merges.
- **Type roles:** Appendix C. Mobile body 16/24, bodySmall 14/20, label 13/18, caption 12/16, title 20/28, mono 13/20.
  These are scaled up from the desktop's 13px body for touch.
- **Code on `m13-design`:**
  - `src/upstream/themes/` holds the vendored desktop theme files.
  - `src/theme/resolve.ts` holds `MobileTokens`, a port of `context.tsx` and `styles.css`.
  - `src/lib/icons.ts` is generated from the desktop's icon aliases.

What a mobile port should change deliberately: larger type, 44-48dp touch targets, and visible focus. The seeds,
formulas, semantic palette and near-square radii carry over as they are.
