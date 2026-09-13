# M15 — Bots tab, Tasks tab, chat affordances, pairing onboarding

**Status:** todo
**Depends on:** M14 (screens); the data-layer tasks marked (†) may start on their own branch during M14.
**Goal:** The phone has the mobile-native affordances a user now expects from a Hermes phone client: bots as first-class chats with the desktop's avatars and souls, scheduled tasks as a tab, a composer with per-chat model and effort, hold-to-dictate, jump-to-latest, and a pairing flow that gets a phone onto a Tailscale-reached gateway without a wrong `127.0.0.1` step.

Added by decision D16 (2026-09-12) after reviewing `CodeUpdaterBot/Hermes-Mobile-App` v0.1.1
(AGPL-3.0). **Nothing is copied from that repository**: its licence is incompatible with this
project's MIT licence, and every feature below is specified against the Hermes desktop source
and the gateway contract, not against their code. What we take is the product idea, the
interaction, and in three cases a numeric tuning that is a design choice, not code.

## What the desktop already has that we mark absent

`docs/PARITY.md` listed Bot Mode as "absent by design: plugins have no UI surface on mobile".
That was the wrong line. Bot Mode is a built-in desktop plugin (`apps/desktop/src/plugins/hermes-bots/`)
whose data is ordinary gateway data: a bot is a profile (`profiles.list`), a bot chat is a
profile's canonical session resolved by exact title (`canonical-chat.ts`), a soul is the profile's
`SOUL.md`, the avatar is `blobatar` 2.0.0 seeded from the profile (`avatar-picker.tsx`, the same
package in the desktop's `package.json:113`), and capabilities are the profile's toolsets and
skills. None of that is machine-bound. D16 reverses the PARITY line; group rooms stay absent
until the gateway exposes a group transport to non-desktop sources.

## Tasks

### A. Bots tab (†data layer)

- [ ] † `src/api/bots.ts`: roster from `profiles.list`; canonical chat per profile using the
      desktop's exact-title rule from `canonical-chat.ts` (read it; vendor the title constant and
      the resolution rule through the sync script if they are pure, otherwise port with a cited
      line range); soul read and write through the profile's `SOUL.md` RPCs; description; model
      pin (`null` = inherit); toolsets and skills per profile. Unit tests against recorded RPC
      fixtures, as `src/api/sessions.ts` did.
- [ ] Avatars: `blobatar` 2.0.0 rendered through `react-native-svg` (`SvgXml`), seeded exactly as
      the desktop's `avatar.tsx` seeds it, so the same bot shows the same face on both surfaces.
      Test: the SVG string for a fixed seed equals the desktop's for the same seed.
- [ ] `app/(main)/bots/index.tsx`: the roster, one row per bot (avatar, name, handle, model, last
      message preview, relative time), "New bot" (create profile sheet: name, description, model,
      avatar seed), pull-to-refresh. Opening a bot opens its canonical chat in the existing chat
      screen with the bot's identity in the header.
- [ ] Bot settings sheet from the chat header: description, soul editor (mono role, save on
      blur with a confirm if the soul changed on the host since it was loaded), model pin, and a
      "Capabilities" screen listing installed skills and toolsets with per-bot toggles and a
      search over installed skills.
- [ ] Drawer order becomes Bots, Sessions, Tasks, then the rest, matching the desktop's Bot Mode
      sidebar strip order (Sessions / Bots) inverted for the phone, recorded as a Deviation.

### B. Chat affordances

- [ ] † `src/api/models.ts`: model options for the picker (the same source Settings › Models
      uses) and per-session `config.set` for `model` and `reasoning_effort` scoped with
      `--session`, never profile-wide.
- [ ] Composer trailing controls: a model chip and an effort chip. Model chip opens a searchable
      sheet of available models; effort chip opens a five-option sheet (none, low, medium, high,
      xhigh, labelled Off … XHigh). Both change the current session only and reflect in the next
      `session.info`.
- [ ] Response stats line under a settled assistant message: model, total tokens, tokens per
      second, shown only when the server provided `usage` for that message; older rows stay bare.
- [ ] Jump-to-latest: while the reader is scrolled away from the tail, a pill shows "Latest" with
      the count of assistant messages that arrived since; streaming auto-follow only when within
      one viewport of the tail. Tapping the pill scrolls to the tail and clears the count.
- [ ] Hold-to-dictate: tap the mic to dictate into the composer (M11's path, unchanged); hold
      the mic for 2.5 s to dictate and auto-send on release, with a visible "Auto-send" state and
      an "Edit before sending" escape while the transcript is still editable. Haptic on the
      threshold.
- [ ] Refresh conversation action in the header overflow (re-runs `session.resume` hydration),
      for the case the user does not trust the live view.
- [ ] Edit-and-resend on a user message (long-press → Edit → composer prefilled; sending
      creates a new turn, the old one is not rewritten), and Copy on any message.

### C. Tasks tab (†data layer)

- [ ] † `src/api/cron.ts` gains templates (from the desktop's cron templates source) and the
      delivery target field.
- [ ] `app/(main)/tasks/index.tsx` replaces the cron screen's framing: rows show name, schedule
      in words, next run, last run, a "Running now" state; detail screen with the prompt, model,
      deliver-to, schedule; "New task" sheet with name, prompt, schedule (cron expression or the
      template's preset, with the placeholder `0 9 * * *` and a plain-language echo of what it
      means), deliver-to, and a template picker. Edit prompt in place.

### D. Pairing and connection health

- [ ] Connect flow gains a "Pair over Tailscale (recommended)" path: three steps (join the same
      tailnet; run a reachable, authenticated gateway; enter the host's tailnet URL), a hard
      rejection of `127.0.0.1`, `localhost` and `10.0.2.2` with the reason ("that address is this
      phone, not your computer"), then the existing detection and login. A "This computer"
      section links the host-side docs.
- [ ] `docs/CONNECTING.md` gains the host-side recipe: keep `hermes serve` running after login
      on Windows (Task Scheduler), macOS (LaunchAgent) and Linux (systemd user unit), bound so
      the gate engages (D13.3), with the tailnet hostname. Scripts under `scripts/host/` are
      optional; the doc is the deliverable.
- [ ] "Connection needs attention" banner: one persistent banner state when the gateway is
      unreachable or needs login, with the reason from the M04 ladder and a "Sync now" action
      that redials and re-resumes. Replaces ad-hoc toasts for that case.

### E. Gestures and navigation

- [ ] Edge-swipe back on every stack screen, and on sheets (swipe down to dismiss), through
      `react-native-screens`' native gesture; confirm Android predictive back is enabled in the
      manifest and that sheets consume the back button before the stack does.
- [ ] Swipe between Bots, Sessions and Tasks tabs.

## Deliverables

`src/api/{bots,models,cron}.ts`, `app/(main)/{bots,tasks}/`, `src/chat/{ModelChip,EffortChip,JumpToLatest,ResponseStats}.tsx`,
the Bot settings and Capabilities screens, the pairing steps in `app/connect/`, the connection
banner, `docs/CONNECTING.md` host section, `docs/PARITY.md` updated.

## Exit criteria (emulator; none are `[physical]`)

- [ ] Bots: with two profiles on the host, the roster shows two bots whose avatar SVGs equal the
      desktop's for the same seeds (test), opening one lands in its canonical chat (the session
      id equals the one the desktop's rule resolves, checked with a Node script against the same
      host), and editing the soul changes `SOUL.md` on the host (read back over RPC).
- [ ] Model and effort: changing both from the composer chips is reflected in the next
      `session.info` for that session only; another session's `session.info` is unchanged.
- [ ] Jump-to-latest: scroll up during a streaming reply; the pill appears with a count that
      increments per completed assistant message; tapping it lands on the tail; no auto-scroll
      happened while scrolled away.
- [ ] Hold-to-dictate: a 2.5 s hold auto-sends the transcript on release (a prompt lands on the
      wire with that text); a tap only fills the composer.
- [ ] Response stats appear only on messages that carry server `usage`; a transcript row from
      before the feature shows none.
- [ ] Tasks: creating a task from a template posts the expected cron payload; the list shows
      next and last run; triggering it shows "Running now" and then updates last run.
- [ ] Pairing: entering `127.0.0.1` or `10.0.2.2` in the Tailscale step is rejected with the
      reason; a tailnet-shaped URL proceeds to detection.
- [ ] Banner: killing the host produces the banner with "unreachable"; a 401 produces it with
      "sign in again"; "Sync now" after the host returns clears it without an app restart.
- [ ] Gestures: an edge swipe from the left pops every stack screen; a swipe down dismisses every
      sheet; a swipe between the three tabs works.

## Licensing note

`blobatar` is MIT. The Hermes desktop source is read under D5's rules. `Hermes-Mobile-App` is
AGPL-3.0 and is **not** read for implementation; if anyone needs to look at it to understand a
behaviour, they record what they looked at in a Deviation and implement from the desktop source
and the gateway contract only.

## Deviations from the literal spec (and why)

1. **Task 1's premise was wrong, not just its symptom.** The task described
   this as `../hermes-agent` having renamed/dropped `CronBlueprint`/
   `CronBlueprintField` out from under `src/api/cron.ts`. Checked directly:
   `../hermes-agent`'s checkout is at `b973068c60ae92c1928041cb6a8e53a80bcf9c4c`,
   the exact commit `src/upstream/UPSTREAM.json` already records — not a
   different branch, not a newer commit. `apps/desktop/src/types/hermes.ts`
   has never declared `CronBlueprint`/`CronBlueprintField` at any commit in
   its history (only `AutomationBlueprint`/`AutomationBlueprintField` ever
   existed there). The actual defect: M14 commit `e8156bf` hand-added those
   two interfaces directly into the vendored `src/upstream/types/hermes.ts`
   — a rule violation (upstream files are synced by
   `scripts/sync-upstream.mjs`, never hand-edited) that would have been
   silently reverted by the next sync, breaking `cron.ts`'s imports with no
   warning. Fixed by moving both interfaces into `src/api/cron.ts` itself
   (they describe a REST route's JSON, not a desktop type, so they don't
   belong in the vendored file either way) and re-running the sync clean.
2. **Task 3's "gains templates" was already built.** M14 (`e8156bf`, the same
   commit as #1) had already wired `listCronBlueprints`/
   `instantiateCronBlueprint` against `/api/cron/blueprints` — the desktop's
   own UI calls this same `AutomationBlueprint` feature "templates" in its
   copy (`apps/desktop/src/app/cron/index.tsx:1216`, the blueprint picker
   labelled "Start from..."), and `createCronJob`/`updateCronJob`'s `deliver`
   field pre-existed too. The only genuinely missing piece was the delivery-
   target list (`getCronDeliveryTargets` / `GET /api/cron/delivery-targets`),
   which task 3 added.
3. **`profiles.configure` cannot clear an existing model pin.** Checked
   directly: `_configure_model` (`methods_profiles.py:482-501`) only ever
   writes a pin — `if not (model and provider): return None` no-ops whenever
   either is missing, with no sentinel value that clears one back to
   "inherit the host default". `src/api/bots.ts`'s `ConfigureBotPatch.model:
   null` therefore can only mean "leave the current pin alone," never
   "unpin" — documented in that file's header and exercised by a test
   (`configureBot` sends neither `model` nor `provider` for `model: null`).
   Not fixed here: an unpin action needs either a gateway change or writing
   the profile's `config.yaml` some other way neither `profiles.describe`
   nor `profiles.configure` exposes. Flagging for a product/gateway decision
   before a bot-settings screen ships a "reset to default" control, rather
   than inventing a workaround.

## Verification log

### Round 1 — data-layer tasks 1-5, throwaway gateway (2026-09-13/14)

**Scope.** The three †-marked data-layer tasks (`src/api/{cron,models,bots}.ts`)
plus avatars, from `18c37f3` (M14 close-out) on branch `m15-bots-mobile-ux`,
worktree `D:\Stuff\Code\git\hermes-android-m15`. No screens this round.

**Throwaway gateway.** Fresh scratch `HERMES_HOME` under `%TEMP%\hermes-m15-home`
(never the user's own `HERMES_HOME`), `config.yaml` pinning
`model.default: mimo-v2.5` / `provider: opencode-go`, two seeded profiles
(`researcher`, `coder`), `hermes serve --port 9130 --skip-build` on loopback
(`auth_required: false`), the auto-generated dashboard session token used for
both REST and the `/api/ws` query-string token-mode dial — never Tailscale,
never `--host 0.0.0.0`, never the real `gateway.example.org` (Hone).

**Task 1 (cron types drift).** `node scripts/sync-upstream.mjs` after the fix:
`types/hermes.ts` reported `(unchanged)`. `git status --short` after the sync
showed only the three files this task edited (`src/api/cron.ts`,
`app/(main)/cron/index.tsx`, `src/upstream/types/hermes.ts`'s two-interface
removal) — no unintended diff from the sync itself. `npm run check`: green
(typecheck, 498/498 vitest at the time, 52 Python, lint/format).

**Task 2 (`src/api/models.ts`, per-session model/effort).** Live against the
throwaway gateway: created two sessions (profiles `researcher` and `coder`,
`source: 'android'`), ran one trivial turn on each to build their agents
(`config.set` only pushes a live `session.info` once a session has an agent —
`_set_reasoning`'s own `if session and session.get("agent") is not None`
gate), then:

```
model.default before anything: mimo-v2.5
session A model before switch: mimo-v2.5
session B model before switch: mimo-v2.5

config.set(model) RAW RESPONSE:
{ "key": "model", "value": "deepseek-v4-flash", "warning": "",
  "confirm_required": false, "confirm_message": "", "scope": "session" }

session A model AFTER switch (session.info): deepseek-v4-flash
session A provider AFTER switch: opencode-go
session B model AFTER switch (should be unchanged): mimo-v2.5
model.default AFTER switch (should be unchanged): mimo-v2.5

config.set(reasoning) RAW RESPONSE:
{ "key": "reasoning", "value": "high" }

session A reasoning_effort AFTER switch: high
session B reasoning_effort AFTER switch (should be unchanged): (empty)
model.default AFTER both switches (should be unchanged): mimo-v2.5
```

A separate run captured the mid-turn "stashed" response live (a turn in
flight, switched mid-stream): `{"key":"model","value":"deepseek-v4-flash",
"warning":"","confirm_required":false,"confirm_message":"","scope":"session",
"deferred":true}` — matches the fixture used in `src/api/models.test.ts`
exactly. `npm run check`: green (504/504 vitest, rest unchanged).

**Task 3 (`getCronDeliveryTargets`).** Recorded live:
`GET /api/cron/delivery-targets` → `{"targets":[{"id":"local","name":"Local
(save only)","home_target_set":true,"home_env_var":null},{"id":"bot-chat:
default",...},{"id":"bot-chat:coder",...},{"id":"bot-chat:researcher",...}]}`
— `local` first, then each seeded profile's own bot-chat target. `npm run
check`: green (505/505 vitest).

**Task 4 (`src/api/bots.ts`).** Two live checks, both against the same
throwaway gateway:

*Soul/description round-trip.* `profiles.configure(researcher, {description:
"Deep research bot v2", soul: "You are a meticulous researcher who cites
sources."})` → `{"ok":true,"applied":{"soul":true,"description":true}}`, then
`profiles.describe(researcher)` read back: `soul matches what we wrote: true`,
`description matches: true`. Also round-tripped `profiles.set_asset`/
`get_asset` with a tiny PNG (byte-for-byte `data` match) and `clear: true`
(`removed: 1`).

*Canonical chat resolution*, a Node script running `bots.ts`'s exact RPC
sequence (`session.list` → `session.create` → `session.title`, same method
names and params) against both seeded profiles:

```
=== first resolve (should CREATE) ===
researcher canonical chat id: 20260913_230725_89d257
coder canonical chat id: 20260913_230725_da6451
distinct ids for distinct profiles: true

=== second resolve (should ADOPT the same id, not mint a new one) ===
researcher second call: 20260913_230725_89d257 same as first: true
coder second call: 20260913_230725_da6451 same as first: true

=== profiles.list roster now reports canonical_session for both ===
coder -> canonical_session.id: 20260913_230725_da6451 resolved_id: 20260913_230725_da6451
researcher -> canonical_session.id: 20260913_230725_89d257 resolved_id: 20260913_230725_89d257

=== third resolve, passing the roster canonical_session.id hint (fail-closed path exercised) ===
researcher third call: 20260913_230725_89d257 still consistent: true
```

Our resolution's id equals `profiles.list`'s own server-computed
`canonical_session` for both profiles, and is idempotent (adopts, never
re-mints). `npm run check`: green (536/536 vitest).

**Task 5 (avatars).** `blobatar@2.0.0` installed (MIT, matches
`apps/desktop/package.json:113`). `scripts/gen-bot-avatar-fixtures.mjs`
imports `blobatar/blob` directly (the same import the desktop's
`blobatarSvg` re-export resolves to) and generates
`src/lib/__fixtures__/bot-avatar.json` independently of
`src/lib/bot-avatar.ts`'s own seed-resolution port; `src/lib/bot-avatar.test.ts`
asserts `botAvatarSvg` produces byte-identical SVG strings against that
fixture for every `parseBlobShape` branch (plain name-seed, locked seed,
locked seed + pinned silhouette, pinned silhouette with the seed still
following the name), all passing. No render test of `BotAvatar.tsx` itself —
this project's vitest setup renders no `.tsx` components (M14's own
established limitation), and no screen mounts it yet regardless.

**Task 6.** `npm run check` after the last commit (`e2b3bfd`): typecheck
clean, 536/536 vitest, 52/52 Python, lint/format clean, exit code 0.

**Not attempted this round:** any of M15's screen tasks (Bot settings sheet,
Composer chips, Tasks tab screen, pairing flow, gestures) — out of scope per
this round's brief ("the three data-layer tasks marked †, plus avatars. No
new screens this round").
