# hermes-desktop screen prototypes

These are static HTML mockups of every hermes-desktop screen, meant for an agent (or a person) who needs to rebuild those
screens somewhere else. The screen list is [`../DESKTOP-SCREENS.md`](../DESKTOP-SCREENS.md), and the design system
behind the mockups is [`../DESKTOP-DESIGN.md`](../DESKTOP-DESIGN.md).

They were built from `hermes-agent` at `b973068c60` (2026-09-11), in `apps/desktop`, using its default `nous` skin.

## Opening them

The pages load shared CSS by relative path, so serve the folder rather than double-clicking a file:

```bash
python -m http.server 8765 --directory docs/desktop-prototypes
```

Then open <http://127.0.0.1:8765/>. The gallery links to every screen.

Python's server sends no cache headers, so after editing `assets/*` the browser may keep serving the old copy. Hard
refresh (Ctrl+F5 / Cmd+Shift+R), or serve with caching off: `npx http-server docs/desktop-prototypes -p 8765 -c-1`.

| URL option | Effect |
|---|---|
| `?theme=light` / `?theme=dark` | Force a mode. Otherwise the bottom-right bar cycles light → dark → system, and your choice is remembered. |
| `#<group>=<view>` | Open a sub-view, e.g. `a-main/settings.html#settings=notifications` or `a-main/chat.html#chat=new` |
| `?bare=1` | Hide the prototype bar and pin the window at 0,0 at 1:1. Use this for screenshots at a 1220×800 viewport. |
| `?fit=0` | Don't scale the window to fit the viewport. |

## Layout

```
index.html        gallery (groups A–G, matching DESKTOP-SCREENS.md)
assets/
  tokens.css      every colour, radius, shadow, font, metric; the ONLY file with colour literals
  components.css  shared primitives (button, badge, control, switch, segmented, tabs, dialog, menu, overlay card, …)
  shell.css       app chrome: titlebar, sessions sidebar, status bar, workspace, chat thread, composer, file tree, terminal
  proto.js        prototype runtime only: theme switching, sub-views, fit-to-viewport, shared shell stamp
a-main/  b-panels/  c-plugins/  d-windows/  e-overlays/  f-dialogs/  g-elements/
```

## Reading a page

Every page starts with a comment block:

- **Screen** and route.
- **Replicates:** the desktop source files it mirrors. Read those for anything the mockup can't show.
- **Views:** the sub-views you can switch between (buttons under the window, or the `#group=view` hash).
- **Measurements:** the exact sizes that matter for that screen.
- **Behaviour:** hover, animation, keyboard and state rules that a static page can't show.
- **Mobile:** whether `docs/PARITY.md` lists the screen as absent on mobile by design.

The window is always 1220×800, the desktop e2e window size. Pages inside the main window use
`<div data-shell="app" …>`, which `proto.js` expands into the real sidebar, titlebar and status bar. Its options are
listed at the top of `proto.js`, and [`a-main/chat.html`](a-main/chat.html) shows the result.

## Rules the pages follow

- **Colours come only from tokens.** Pages use `var(--ui-*)` / `var(--dt-*)`. `tokens.css` reproduces the desktop's
  pipeline (skin palette → `--theme-*` seeds → `--ui-*` via `color-mix` → `--dt-*`), so light and dark are the same
  formulas with different seeds. That is how to port it, too.
- **Labels are real.** They are copied from `apps/desktop/src/i18n/en.ts`.
- **Icons use the real sets.** Tabler (`ti ti-*`, the desktop's default set via `src/lib/icons.ts`) and VS Code
  codicons (`codicon codicon-*`), from pinned CDN versions (Tabler 3.44.0, codicons 0.0.45, the same versions the app
  ships).

## Known approximations

- `--ui-success` and the dark `--dt-primary-solid` are computed at runtime in the app (`harmonize()` and
  `ensureContrast()` in `themes/color.ts`). Here they are close static values.
- **Fonts:** UI text uses the system stack, as the app does (Segoe UI on Windows, SF on macOS). The wordmark's Collapse
  face loads from the `@nous-research/ui` CDN build and falls back to bold sans. The terminal names JetBrains Mono,
  which only renders if it is installed.
- **Not reproduced:** glass/translucency, the backdrop image, particles and animations. The comment blocks and
  DESKTOP-DESIGN.md describe them.
- **Sample content** (sessions, messages, jobs) is made up, but its shape follows the real data.
