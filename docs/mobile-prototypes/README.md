# hermes-android mobile prototypes

The phone screens as static HTML, drawn at **412×915 dp** (the `hermes-test` emulator) from two
sources: the desktop prototypes in [`../desktop-prototypes/`](../desktop-prototypes/README.md), and
the [2026-09-12 field test](../FIELD-NOTES-hermes-mobile-app-2026-09-12.md).

They are the layout half of M14 and the screen half of M15: what an implementer builds, with the
values already resolved.

## Opening them

```bash
python -m http.server 8766 --directory docs/mobile-prototypes
```

Then <http://127.0.0.1:8766/>. (Serve them; opened as bare files the shared CSS will not load. This
server sends no cache headers, so hard-refresh after editing `assets/*`.)

| URL option | Effect |
|---|---|
| `?theme=light` / `?theme=dark` | Force a mode; otherwise the bottom-right bar cycles light → dark → system |
| `#<group>=<view>` | Open a state directly, e.g. `chat.html#chat=approval` |
| `?bare=1` | Hide the prototype chrome and pin the phone at 1:1 — use for screenshots |
| `?fit=0` | Don't scale the phone to the viewport |

## Layout

```
index.html        gallery
assets/
  tokens.css      the nous chain (same as the desktop) + the mobile type/radius/touch overrides
  components.css  mobile primitives: button, chip, badge, input, ListRow, switch, sheet, alert, card…
  shell.css       app chrome: ScreenHeader, tabs, drawer, list rows, thread, composer, prompt cards
  proto.js        prototype runtime only (theme, views, fit) — not part of the design
chat.html  bots.html  tasks.html  sessions.html  settings.html  connect.html  primitives.html
```

## Reading a page

Every page opens with a comment block:

- **Screen** and route.
- **Adapts:** the desktop prototype page(s) it comes from.
- **Rules:** which of M14's adaptation rules were applied (and how the desktop measurement converts).
- **Field:** one line per interaction adopted from the field test, so an implementer can see which
  parts are parity with the desktop and which are additions on top of it. Field items never replace
  a parity rule; they sit alongside it.
- **Views / Measurements / Behaviour / Mobile** — the states you can switch between, the dp numbers
  that matter, what a static page cannot show, and what `docs/PARITY.md` says about the screen.

## Rules the pages follow

- **Colour only from tokens.** `assets/tokens.css` is the only file with literals; it reproduces the
  desktop's skin → seeds → `color-mix` chain for `nous`, so light and dark are the same formulas with
  different seeds (D14: parity by vendoring, not imitation).
- **Type only from the six roles** (`body` 16/24, `bodySmall` 14/20, `label` 13/18, `caption` 12/16,
  `title` 20/28, `mono` 13/20) — M13 Appendix C.
- **Radius only from the family** control 3 · icon 4 · card 5 · sheet 8 · full — D15.1(b). The desktop
  is near-square and so is the phone; nothing here uses 12–16 dp mobile-style corners.
- **48 dp touch targets.** Where a control is visually smaller (chips, message actions), the class
  carries the `hitSlop` padding that brings the tappable box back to 48 dp.
- **Desktop dialogs, menus and popovers become bottom sheets**; confirms become native-style alerts
  with the destructive button last.

## Known approximations

- Bot avatars are token-coloured shapes; the app uses `blobatar` SVGs seeded by handle (M15 A).
- Icons are the Tabler webfont (the same set the desktop aliases); JetBrains Mono renders only if
  installed locally, otherwise the mono stack falls back.
- Motion, haptics and the keyboard's effect on layout are described in each page's Behaviour block
  rather than animated.
