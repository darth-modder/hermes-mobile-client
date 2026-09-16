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

- [x] † `src/api/bots.ts`: roster from `profiles.list`; canonical chat per profile using the
      desktop's exact-title rule from `canonical-chat.ts` (read it; vendor the title constant and
      the resolution rule through the sync script if they are pure, otherwise port with a cited
      line range); soul read and write through the profile's `SOUL.md` RPCs; description; model
      pin (`null` = inherit); toolsets and skills per profile. Unit tests against recorded RPC
      fixtures, as `src/api/sessions.ts` did.
- [x] Avatars: `blobatar` 2.0.0 rendered through `react-native-svg` (`SvgXml`), seeded exactly as
      the desktop's `avatar.tsx` seeds it, so the same bot shows the same face on both surfaces.
      Test: the SVG string for a fixed seed equals the desktop's for the same seed.
- [x] `app/(main)/bots/index.tsx`: the roster, one row per bot (avatar, name, handle, model, last
      message preview, relative time), "New bot" (create profile sheet: name, description, model,
      avatar seed), pull-to-refresh. Opening a bot opens its canonical chat in the existing chat
      screen with the bot's identity in the header.
- [x] Bot settings sheet from the chat header: description, soul editor (mono role, save on
      blur with a confirm if the soul changed on the host since it was loaded), model pin, and a
      "Capabilities" screen listing installed skills and toolsets with per-bot toggles and a
      search over installed skills.
- [x] Drawer order becomes Bots, Sessions, Tasks, then the rest, matching the desktop's Bot Mode
      sidebar strip order (Sessions / Bots) inverted for the phone, recorded as a Deviation.

### B. Chat affordances

- [x] † `src/api/models.ts`: model options for the picker (the same source Settings › Models
      uses) and per-session `config.set` for `model` and `reasoning_effort` scoped with
      `--session`, never profile-wide.
- [ ] Composer trailing controls: a model chip and an effort chip. Model chip opens a searchable
      sheet of available models; effort chip opens a five-option sheet (none, low, medium, high,
      xhigh, labelled Off … XHigh). Both change the current session only and reflect in the next
      `session.info`.
- [x] Response stats line under a settled assistant message: model, total tokens, tokens per
      second, shown only when the server provided `usage` for that message; older rows stay bare.
- [x] Jump-to-latest: while the reader is scrolled away from the tail, a pill shows "Latest" with
      the count of assistant messages that arrived since; streaming auto-follow only when within
      one viewport of the tail. Tapping the pill scrolls to the tail and clears the count.
- [ ] Hold-to-dictate: tap the mic to dictate into the composer (M11's path, unchanged); hold
      the mic for 2.5 s to dictate and auto-send on release, with a visible "Auto-send" state and
      an "Edit before sending" escape while the transcript is still editable. Haptic on the
      threshold.
- [x] Refresh conversation action in the header overflow (re-runs `session.resume` hydration),
      for the case the user does not trust the live view.
- [x] Edit-and-resend on a user message (long-press → Edit → composer prefilled; sending
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

- [x] Bots: with two profiles on the host, the roster shows two bots whose avatar SVGs equal the
      desktop's for the same seeds (test), opening one lands in its canonical chat (the session
      id equals the one the desktop's rule resolves, checked with a Node script against the same
      host), and editing the soul changes `SOUL.md` on the host (read back over RPC).
- [x] Model and effort: changing both from the composer chips is reflected in the next
      `session.info` for that session only; another session's `session.info` is unchanged.
- [x] Jump-to-latest: scroll up during a streaming reply; the pill appears with a count that
      increments per completed assistant message; tapping it lands on the tail; no auto-scroll
      happened while scrolled away.
- [ ] Hold-to-dictate: a 2.5 s hold auto-sends the transcript on release (a prompt lands on the
      wire with that text); a tap only fills the composer.
- [x] Response stats appear only on messages that carry server `usage`; a transcript row from
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
3. **~~`profiles.configure` cannot clear an existing model pin.~~ Corrected
   round 2: it cannot, but the gateway offers a different, working path round
   1 didn't check.** `_configure_model` (`methods_profiles.py:482-501`)
   genuinely only ever writes a pin — `if not (model and provider): return
   None` no-ops whenever either is missing, no sentinel clears one — that
   half of round 1's claim stands. What was wrong: round 1 stopped at
   `profiles.configure` and reported "no RPC-level way to unpin at all,"
   without checking whether some OTHER RPC could. The layer it missed: the
   desktop clears a bot's model pin through `cli.exec` running `hermes
   --profile <name> config unset model`
   (`apps/desktop/src/plugins/hermes-bots/profile-config.tsx:566-575`).
   Checked directly, both gates `cli.exec` passes through: its registration
   (`tui_gateway/methods_tools.py:434`, `@method("cli.exec")`) carries no
   source restriction, and the headless-argv blocklist
   (`tui_gateway/server.py:3163-3168`, `_CLI_EXEC_BLOCKED` — `setup`,
   `gateway`, `sessions browse`, `config edit`) doesn't name `config unset`.
   `src/api/bots.ts`'s `clearBotModelPin` (round 2) is that same call, ported
   verbatim, argv built as a fixed array (never an interpolated string) and
   the profile name checked against the roster first. Live-verified: pinned
   `coder` to `deepseek-v4-flash`, cleared it, `profiles.describe` read back
   `{"provider":"","default":""}` — genuinely empty, not just the
   inherited-at-creation value it started from (see the Verification log).
   `ConfigureBotPatch.model: null` (round 1's workaround) is superseded by
   this for the unpin case; it still means "leave the pin alone" for every
   other caller of `configureBot`, since `profiles.configure` itself hasn't
   changed.
4. **M15 task B's doc text names `reasoning_effort` as the `config.set` key;
   the real key is `reasoning`.** Established and cited in round 1
   (`src/api/models.ts`'s header: the desktop's own effort control sends
   `key: 'reasoning'`, `apps/desktop/src/store/model-presets.ts:89`; the
   gateway's dispatch table has no `reasoning_effort` entry at all,
   `tui_gateway/methods_config_set.py:451`). `reasoning_effort` is only the
   `session.info` *read-back* field name
   (`src/gateway/session-stream/session-info.ts:71-72`,
   `tui_gateway/server.py:2041-2044,2063`). Recording as its own Deviation
   per round 2's instruction, rather than leaving it folded into task 2's
   commit message only.
5. **~~A bot's canonical chat cannot actually be opened on-device the first
   time.~~ Resolved round 3: `session.resume` was missing one param —
   `profile` — not missing an architecture.** Round 2 stopped at
   `session.resume`'s call shape (`{ session_id: storedSessionId }`,
   `src/gateway/session-connection.ts`'s old `resumeSession`) and concluded
   the lazy-session 4007 was structural — the same class of mistake as round
   1's Deviation 3: stopping at one RPC's current params instead of checking
   a NEIGHBORING one the server already reads. The layer that check missed:
   `tui_gateway/methods_session.py:453-454`'s `_Resume.__init__` —
   ```
   # ``profile`` (app-global remote mode): resume from another local profile's state.db.
   self.profile = (params.get("profile") or "").strip() or None
   ```
   — a param `session.resume` already accepts and round 2's own citations
   never passed. `_find_live_unpersisted` (:511-517) matches a live,
   not-yet-persisted Bot Chat only when its `profile_home` equals that
   param's; `_resume_live_unpersisted`'s docstring (:520-521) says outright
   this path exists "for every fresh Bot Chat." Without `profile`, resume
   falls back to the default store and 4007s (:571-590) — proven live this
   round, four ways, each a fresh WebSocket connection (never "same
   connection" as the fix): a hidden Bot Chat resumed without `profile`
   4007s both before any turn and after one has 24 messages in it (so this
   was never a zero-message special case); resumed WITH `profile` it
   succeeds both times. Full transcript: `%LOCALAPPDATA%\hermes-android-
   field\m15-r3\task1a-evidence.txt`.

   **Is this a real desktop/mobile difference?** Yes. The desktop never
   passes `profile` to `session.resume` either
   (`apps/desktop/src/store/gateway-profile-request.test.ts:253-259`: `await
   requestGatewayForAgent('remote-primary', 'research', 'session.resume', {
   session_id: 'research-session' })` — no `profile` key in the RPC params)
   — it dials a SEPARATE, profile-scoped connection first
   (`getConnectionFor({ connectionId, profile: 'research' })`, asserted at
   :257) and issues `session.resume` on that connection, so the profile
   scoping happens at DIAL time, once per connection. Mobile holds exactly
   one shared gateway connection for the whole app (this file's own header:
   "M04: one active connection in v1") — with no per-profile connection to
   scope the lookup, `profile` has to travel as an RPC param instead, once
   per call. Same server-side requirement, two different places to satisfy
   it — not a bug on either side.

   **The fix** (`src/gateway/session-connection.ts`): `resumeSession` gained
   an optional third `profile` argument, sent as `session.resume`'s
   `profile` param when given. The chat screen (`app/(main)/sessions/
   [id].tsx`) passes its `botId` route param straight through. A
   module-level `storedSessionProfile` map remembers which profile a stored
   id belongs to once given, so `rehydrateSession` — the reducer's own
   internal reconnect path (`session.reclaimed`, a dropped socket), which
   never sees a route param — still supplies it on every later resume
   without threading a profile field through the pure wire-protocol reducer
   (`session-stream-reducer.ts` / `session-stream/*`), which owns none of
   this identity plumbing.

   **Every other session-addressed RPC in this file was checked and needs no
   change.** `submitPrompt`, `stopTurn`, `steerTurn`, `askBtw`,
   `compressSession`, `renameSession`, `execSlashCommand`,
   `respondApproval`, `respondClarify`, `respondSudo`, `respondSecret`,
   `attachImageBytes`, `attachFile`, `attachPdf` (lines 792-960) all address
   the session via `runtimeIdForStored()` — the RUNTIME id, once
   `resumeSession` has bound one. Server-side, every one of those methods
   resolves through `_sess`/`_sess_nowait` (`tui_gateway/server.py:1045-
   1047`): `s = _sessions.get(sid)` — a direct lookup in the live, in-memory,
   profile-agnostic `_sessions` dict, never a profile-scoped `state.db`
   lookup. Only a STORED-id-addressed call reaches the profile-scoped path
   `_resume_locate` guards, and `session.resume` is the only one of those in
   this app.
   `createCanonicalChat` (`src/api/bots.ts:413-433`) and
   `findExistingCanonicalChat`'s `session.list` (`src/api/bots.ts`) already
   passed `profile` (round 1) and needed no change.

6. **Drawer order on the phone: Bots, Sessions, then "Scheduled jobs", not yet "Tasks".** The
   desktop's Bot Mode strip reads Sessions / Bots. The phone inverts it so Bots leads, as task A
   asks. The third row still opens the existing cron screen under its current label, "Scheduled
   jobs", because group C's Tasks tab (`app/(main)/tasks/index.tsx`) isn't built yet. Renaming it
   before that screen exists would promise a redesign that isn't there. The row is renamed in the
   commit that lands the Tasks tab. Rationale in `src/components/drawer-rows.ts`'s header; added
   by Opus at the group A close-out, because round 2 referred to this Deviation without writing it.
7. **Composer: model/effort chips get their own row above the composer, off `chat.html`'s inline
   layout.** `docs/mobile-prototypes/chat.html:333-334` puts the model/effort chips inline with
   the composer's other controls (`.composer__controls`), but this composer's row already holds
   four icon buttons (M06/M11) — round 7 found that adding two more there would squeeze the
   `TextInput` below its own placeholder's width, the same failure mode M14 Deviation 15 named for
   Stop/Steer (device-observed there as "Messag/e Herme/s…" wrapping). Same fix shape: the chips
   get their own row instead, above the input (`Composer.tsx`'s `chipRow`), so both keep their
   full 48dp targets and the input's width is untouched — a restyle, not a rebuild, per M14's own
   adaptation rule, named here since it's a real departure from the prototype's row structure.
8. **Effort chip: eight options (Off plus seven `VALID_REASONING_EFFORTS` levels), not the task
   text's five.** M15 task B's doc text describes "a five-option sheet (none, low, medium, high,
   xhigh, labelled Off … XHigh)" — five words for six slots, already inconsistent with itself.
   Checked against the primary source instead: `hermes_constants.py:873`'s
   `VALID_REASONING_EFFORTS` lists seven on-scale words (minimal, low, medium, high, xhigh, max,
   ultra), mirrored by the desktop at `apps/desktop/src/lib/reasoning-effort.ts:6`
   (`REASONING_EFFORTS`) — neither has ever had five. `EffortChip`'s sheet lists Off plus all
   seven, labelled from the vendored `shell.modelOptions` block (`src/upstream/i18n/en.ts:
   2996-3011`) plus `settings.model.reasoningOff` (`en.ts:1100`) for Off, which `shell.modelOptions`
   has no entry of its own for. Same pattern as Deviation 4 (a task-doc field name checked against
   the gateway and corrected) applied to a value set instead of a key name.

9. **Copy and Edit-and-resend collapse into one long-press menu, not the desktop's split
   hover/click affordances.** The desktop's vendored equivalents are two different
   interactions on two different message roles: a hover-revealed Copy button on assistant
   replies only (`apps/desktop/src/components/assistant-ui/thread/assistant-message.tsx:636`,
   `CopyButton` with `label={copy.copy}`) and, on user messages only, clicking the bubble opens
   an inline edit composer that reverts the turn on send — interrupt + rewind
   (`apps/desktop/src/components/assistant-ui/thread/user-message.tsx:499-528`). Mobile has
   neither hover nor a click-vs-long-press distinction to split these across, and M15 task B's
   own doc text already settles Edit's send behavior differently from the desktop's rewind
   ("sending creates a new turn, the old one is not rewritten") — so both actions collapse into
   one long-press menu per message: Copy always present, Edit added only when `message.role
   === 'user'`. Labels are still the desktop's own vendored copy, not retyped:
   `assistant.thread.copy` ('Copy') and `assistant.thread.editMessage` ('Edit message'),
   `src/upstream/i18n/en.ts:3377,3407`.

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

### Round 2 — Deviation 3 correction, Bots screens, device verification (2026-09-14)

**Scope.** Task 0a (`clearBotModelPin`), task 0b (Deviation 4), task 1 (Bots
roster + New bot sheet), task 2 (Bot settings sheet, soul editor, model pin,
Capabilities), task 3 (drawer order), plus device verification of all of the
above against a fresh throwaway gateway (`hermes-m15-r2-home`, port 9131,
`auth_required: true`, `tester`/scratch-password login, two `adb reverse`
tunnels to the `hermes-test` hardware-accelerated AVD) and a physical build
(WSL2 Gradle, D3). Code-level work (tasks 0-3) is committed; this section
covers device verification (round 2's task 4) plus what it could and
couldn't reach.

**Build and emulator.** WSL2 Gradle build succeeded (`BUILD SUCCESSFUL` in
21m 42s, second attempt — first hit an AAPT2 daemon timeout from resource
contention with a since-crashed software emulator). Ran on the pre-existing
hardware-accelerated `hermes-test` AVD (`D:\Software\Android-SDK\emulator`),
not the WSL software emulator (unstable — repeated ANRs/SIGSEGVs under TCG).
Metro served via `adb reverse tcp:8081 tcp:8081`; gateway via `adb reverse
tcp:9131 tcp:9131`.

**Task 4a (roster + 48dp audit).** Roster renders all four seeded bots
(`default`, `coder`, `researcher`, `writer-bot`) with avatar, name/handle,
description, model, and relative time. `uiautomator dump` bounds against the
device's own density (`wm density` → 420, so 48dp = 126px): the "Open menu"
and "New bot" header icon buttons are exactly 126×126px (`bounds="[21,139]
[147,265]"` and `[933,139][1059,265]"`) — at the minimum, not under it; each
bot row is a single full-width clickable region 189-217px tall (72-83dp) —
well over. No sub-48dp targets found.

**Task 4b (avatars).** Each bot renders a distinct `blobatar` SVG (shape +
color + face) via `SvgXml`/`com.horcrux.svg`, matching round 1's fixture
equality test — visually confirmed on-device (screenshot), no new test
needed since round 1 already covers the SVG-generation correctness and this
round only needed to confirm the ES-module package bundles and renders
through Metro on a real device, which it does.

**Task 4c (canonical chat resolution) — id resolution CONFIRMED, chat-open
BLOCKED.** Tapped `researcher` on-device; `[app/(main)/bots/index.tsx]`'s
`resolveCanonicalChat` result was captured via a temporary `__DEV__` log
(reverted before this commit) via `adb logcat`:
```
'[m15-verify] canonical chat', 'researcher', '->', '20260914_023418_18659f'
```
`desktop-rule-canonical-chat.js` (written round 2, mirrors
`canonical-chat.ts`'s `findExistingCanonicalChat` exactly), run standalone
against the same gateway/profile:
```
desktop rule resolution for researcher: 20260914_023418_18659f
raw session.list result: {"sessions":[{"id":"20260914_023418_18659f",
"resolved_id":"20260914_023418_18659f","title":"Bot Chat","preview":"",
"started_at":1789335259.9698472,"message_count":0,"source":"tui"}]}
```
Byte-for-byte match. But the chat screen itself then showed "Couldn't load
this session" / `session not found` and stayed that way through a manual
Retry — see Deviation 5 above for the isolated root cause (a gateway-side
`session.resume` gap for "lazy" sessions, unrelated to this round's id-
resolution code, which is correct). **Task 4c: id resolution done and
device-verified; chat-open part-done — blocked by Deviation 5, reported
rather than patched.**

**Task 4d (soul editor) and 4e (model pin) — RPC-verified only, not
click-through.** Since the Bot Settings sheet is reachable only from the
chat header (`app/(main)/sessions/[id].tsx:159`) and no bot's canonical chat
could be opened (Deviation 5), the sheet itself could not be exercised
on-device this round. The RPC calls it makes were verified directly against
the same live gateway instead:
- Soul read/write/read-back (`describeBot`/`configureBot`, exactly
  `BotSettingsSheet.tsx`'s `saveSoul`): wrote a new soul to `coder`,
  `profiles.configure` → `{"ok":true,"applied":{"soul":true}}`,
  `profiles.describe` read back an exact match.
- Soul staleness guard (`BotSettingsSheet.tsx:109-124`'s exact re-read-
  before-write condition): loaded soul, changed it independently from Node
  (simulating `soul-staleness-inject.js` running mid-edit), re-read —
  `fresh.soul !== detail.soul` correctly evaluated `true`, confirming the
  guard fires on a real round-trip.
- Model pin round-trip (`configureBot`/`clearBotModelPin`): pinned `coder`
  to `deepseek-v4-flash` (`profiles.configure` → `{"applied":{"model":
  true}}`), then cleared via `clearBotModelPin`'s exact call (`cli.exec`,
  argv `['--profile','coder','config','unset','model']`) →
  `{"blocked":false,"code":0}`, `profiles.describe` read back
  `{"provider":"","default":""}` — genuinely cleared, not just unchanged.
**Task 4d/4e: RPC-verified correct; the on-device tap-through of the sheet
itself is not attempted, honestly, because of Deviation 5 — not because it
was skipped.**

**Task 1 (New bot sheet) — device-verified.** Opened via the roster's "+";
renders Name/Description/Model ("Inherit host default")/Avatar Seed fields
matching `bots.html`'s new-bot view and the desktop create dialog's labels.
Created a real bot (`m15r2-testbot`) end-to-end through the sheet —
appeared in the roster immediately after with its own generated avatar,
confirmed via `profiles.list` (`"name": "m15r2-testbot", "model": "mimo-
v2.5", "provider": "opencode-go"`).

**Task 3 (drawer order) — device-verified.** Drawer shows `Bots`, `Sessions`,
`Scheduled jobs` leading, in that order, matching the committed
`drawer-rows.ts` and this doc's own Deviation about "Scheduled jobs" not
being renamed "Tasks" (no Tasks screen exists yet).

**Composites (task 4f) — partial.** `composite.py` (from the M14 field kit)
against the already-captured prototype screenshots
(`docs/mobile-prototypes` served with `?bare=1`): roster and New-bot sheet,
light theme, both produced (`composite-bots-roster-light.png`,
`composite-bots-new-light.png`). **Not captured this round:** dark-theme
device screenshots (time), and the Bot Settings sheet composite in either
theme (blocked entirely by Deviation 5 — nothing to screenshot).

**Incidental finding, not chased further.** The Sessions tab's REST listing
(`GET /api/sessions?limit=100&order=recent`) returned `HTTP 401` partway
through this session, recovering on retry after a fresh sign-in; the WS-RPC
side (`profiles.list`, `session.list`, etc.) kept working throughout. Likely
the REST bearer token's own TTL expiring under this round's repeated
external `curl`/Node logins as the same `tester` user (used to obtain
WS tickets for the standalone verification scripts) rather than anything
`app`-side — noted for awareness, not investigated further; out of scope
for M15 Bots.

**Task 5.** `npm run check` after the last commit: typecheck clean, 61 test
files / 563 tests passed (vitest), 52/52 Python (`server-plugin/hermes-push`
— the one visible traceback is an intentionally mocked failure the suite
asserts on, not a real error), lint clean, `prettier --check .` clean.
Exit code 0.

**Honest summary of task 4 by sub-task:**
- 4a: done, device-verified.
- 4b: done, device-verified.
- 4c: part-done — id resolution device-verified and cross-checked correct;
  chat-open blocked by Deviation 5 (reported, not patched).
- 4d: part-done — RPC-level verified against the live gateway; on-device
  sheet interaction not reached (blocked by 4c's blocker).
- 4e: part-done — same as 4d.
- 4f: part-done — roster and New-bot sheet composites produced (light only);
  Settings-sheet composite and dark-theme composites not produced.

### Round 3 — Deviation 5 fixed, chat opens on device, model/capabilities device-verified (2026-09-15)

**Scope.** Task 0 (dev-client native-dependency check), task 1 (Deviation 5
fix — `profile` on `session.resume`, `src/gateway/session-connection.ts`,
committed `0a118bd`), task 2 (device re-verification of everything Deviation
5 blocked in round 2), task 3 ("Hermes couldn't start" repro attempt),
task 4 (`npm run check`). Against a fresh throwaway gateway
(`hermes-m15-r3-home`, port 9132, two seeded profiles `researcher`/`coder`,
`auth_required: true`), same `hermes-test` hardware-accelerated AVD round 2
used (never destroyed — `emulator -list-avds` still lists it, confirmed
before this round started).

**Task 0 (dev client vs. this branch's native deps).** Code-verified, not
rebuilt. `git diff 18c37f3 337db04 -- package.json` (M15's own merge-base
vs. the M13/M14 merge that just landed on `main`) is empty — M14's native
additions (`react-native-svg`, `expo-haptics`, `expo-font`) were already
present at `18c37f3` (M15's own branch point), so today's merge changed
none of them; `git diff 18c37f3 337db04 --stat -- app.json android/
package-lock.json` is also empty. The round-2-built APK (installed
`2026-09-14 01:44:57` per `adb shell dumpsys package`, inferred from the
build timestamp falling between round 2's task 2 commit and its
verification-log commit — not read from an explicit build-log line) was
built from this same unchanged native-dependency set. Confirmed live
anyway: relaunched the existing install with Metro serving fresh JS
(no rebuild), SVGs render correctly (bot avatars, task 2 below) and haptics
fire on submit (inherited from round 1/2, unchanged this round) — no
native-module-mismatch symptom (a red-box "requireNativeComponent" /
"NativeModule doesn't exist" error) appeared at any point this round.

**Task 1.** See the commit and Deviation 5 above. Live proof (4 resume
attempts, fresh connection each time): before any turn, `session.resume`
without `profile` -> 4007; with `profile` -> success. After a real turn
(24 messages, mid-stream), without `profile` -> 4007 again; with `profile`
-> success, live turn state returned. Full transcript:
`%LOCALAPPDATA%\hermes-android-field\m15-r3\task1a-evidence.txt`. Unit
tests added (`src/gateway/session-connection.test.ts`, 4 new cases) —
567/567 vitest.

**Task 2a (open/message/reopen/relaunch).** Done, device-verified. Opened
`coder` (never used this round) — chat opened with no error. Sent "Say
hello in exactly five words.", got a live streamed reply ("Hello there, how
are you today?"), turn completed (`12.1k tok · 1% ctx`). Left to the roster
and back in: history intact. Force-stopped and cold-relaunched the app,
reconnected through the dev-client launcher, reopened `coder`: full history
still there. This is the exact flow Deviation 5 blocked in round 2 —
confirmed working now.

**Task 2b (Bot settings sheet).**
- Soul edit + readback: done, device-verified. Typed an edit into the SOUL.md
  field on-device, blurred (tapping the sheet's own title reliably triggers
  the save; tapping the adjacent DESCRIPTION field did not — see note below),
  read back via `profiles.describe`: the edit landed verbatim inside the
  existing text plus the `ensureMessagingProtocol`-appended "Messaging other
  agents" section, confirming `saveSoul()`'s exact behavior
  (`src/components/BotSettingsSheet.tsx`).
- Staleness confirm: attempted, not conclusively triggered on device. Typed
  a second edit, ran `soul-staleness-inject-r3.js` against the live gateway
  to change the soul from Node mid-edit (confirmed via its own
  `profiles.configure` response), then blurred — but the blur landed on the
  DESCRIPTION field by mistake (a repeat of the same mis-tap noted above)
  rather than the SOUL field, so `saveSoul()`'s re-read-before-write branch
  was never exercised this round. The mechanism itself was already proven
  correct at the RPC level in round 2's verification log (load → external
  change → re-read mismatch → confirm fires) and is unchanged this round;
  not re-proven on-device here for lack of time, reported honestly rather
  than claimed.
- Model pin/inherit: done, device-verified, read back at each step. Picked
  `mimo-v2.5` explicitly from the Model picker →`profiles.describe` showed
  `{"provider":"opencode-go","default":"mimo-v2.5"}` (a real pin, not an
  inherited echo). Picked "Inherit host default" → `profiles.describe`
  showed `{"provider":"","default":""}` (genuinely cleared, via
  `clearBotModelPin`'s `cli.exec` path, Deviation 3). The roster's own row
  for `coder` also dropped its "· mimo-v2.5" suffix after the clear,
  confirming the roster reads the same cleared state.
- Capabilities toggle: part-done. Toggled the `hermes-agent` skill off and
  the `stt` (Speech-to-Text) toolset on, tapped Save. Fresh
  `profiles.describe` confirms the toolset side: `stt` `enabled: false ->
  true`. The skill side did not confirm the same way: the sheet's own
  summary badge updated correctly (`1·16` -> `0·17`), but `profiles.describe`
  still reported `hermes-agent`'s `enabled: true` afterward. Not diagnosed
  further under time pressure — recorded as observed, not explained. Toolset
  toggle: device-verified. Skill toggle: UI-observed only, RPC readback
  disagreed, unresolved.

**Task 2c (expensive-model confirm).** Not attempted. The throwaway host's
`config.yaml` only lists `mimo-v2.5`/`deepseek-v4-flash` under
`opencode-go`, neither flagged as an expensive-model trigger in this setup,
and there was no time left this round to seed one. Code path
(`confirmExpensiveModel`/`confirm_required`, `src/api/bots.ts`'s
`ConfigureBotResult`) is unchanged from round 1/2 and was code-verified
there; not re-attempted here.

**Task 2d (48dp audit of settings sheet + Capabilities).** Not attempted —
no `uiautomator dump` taken specifically of these two screens this round
(dumps were pulled opportunistically per-tap for coordinates, not archived
as a formal audit pass). Given time constraints, skipped rather than done
partially and reported as complete.

**Task 2e (composites).** Not attempted this round — no new prototype or
device captures taken for the settings sheet; round 2's roster/new-bot
composites (light only) still stand as the most recent evidence.

**Task 3 ("Hermes couldn't start" reproduction).** Did not reproduce the
exact round-2 screen/text in three controlled cold-relaunch variants. What
each variant actually showed:
- **(a) Metro running, everything reachable:** cold relaunch boots straight
  to the Sessions/Bots screens, no error at all.
- **(b) Metro's `adb reverse` tunnel removed** (JS bundle unreachable): the
  native Expo Dev Launcher shows its own dialog, `"Error loading app /
  Failed to connect to /127.0.0.1:8081"` — specific, not "Hermes couldn't
  start" (this fires before the app's own JS ever runs).
- **(c) Gateway's `adb reverse` tunnel removed** (JS loads fine, backend
  unreachable): both Sessions and Bots show `"fetch failed:
  java.net.ConnectException: Failed to connect to /127.0.0.1:9132"` —
  again specific, not generic.

  Root-caused instead a **related, more informative** finding: opening a
  bot chat intermittently failed with the *generic* `"Could not connect to
  Hermes gateway"` even while the transport was provably fine — a raw
  WebSocket handshake sent from the device shell straight through the same
  `adb reverse` tunnel (`nc` with a hand-built `Sec-WebSocket-Protocol:
  hermes-gateway-v1, hermes-gateway-ticket.<ticket>` header, matching
  `src/gateway/dial.ts:56`'s exact protocol list) got `HTTP/1.1 101
  Switching Protocols` and a real `gateway.ready` event back immediately.
  The generic message is `src/gateway/mobile-gateway.ts:17-26`'s
  `connectErrorMessage` option, which `src/upstream/shared/json-rpc-
  gateway.ts:244-252,258-281`'s `connect()` substitutes for *any* socket
  `error` or connect-timeout, discarding the real reason — a pre-existing,
  vendored-client design (unchanged by Deviation 5's fix, which never
  touches `connect()`/`ensureGatewayConnection()`), not something
  introduced this round. Each time it happened, a full app restart (not
  just a "Retry" tap) reliably cleared it, which points at some client-side
  connection state that outlives a single dial rather than a genuinely
  down backend — but with the specific reason thrown away by design, this
  round could not pin down which state. Reported per the standing
  instruction to stop rather than patch a pre-existing, unrelated masking
  behavior under time pressure; not fixed.

**Task 4.** `npm run check` after the last commit (`0a118bd`): typecheck
clean, 61 test files / 567 tests passed (4 new for Deviation 5), 52/52
Python, lint clean, `prettier --check .` clean. Exit code 0.

**Honest summary of round 3 by task:**
- 0: done, code-verified (diff-proven no native dependency change) plus
  live confirmation of no mismatch symptom; not rebuilt (none needed).
- 1: done, both live-proven against the gateway and device-verified (task
  2a's chat-open is the on-device proof this fix actually works).
- 2a: done, device-verified.
- 2b: part-done — soul edit and model pin/inherit fully device-verified
  with RPC readback; staleness confirm and the skill-toggle half of
  Capabilities not conclusively verified (see above, both honestly
  reported rather than claimed).
- 2c: not attempted (no expensive-model trigger available on the throwaway
  host, time).
- 2d: not attempted (time).
- 2e: not attempted (time).
- 3: done as a reproduction exercise — the exact round-2 screen did not
  reproduce in three controlled variants; a related, better-understood
  finding was root-caused instead (see above) and reported, not patched.
- 4: done, green.

### Round 4 — connect-error masking fixed, environment instability limited group A closure (2026-09-15)

**Scope.** Task 0 (stale-connection cleanup), task 1 (fix connect-error
masking — `src/net/connect-reason.ts` new, `src/gateway/mobile-gateway.ts`,
`src/gateway/session-connection.ts`, `src/net/http.ts`, committed `7a38bdb` +
lint fixup `17f083c`), task 2 (group A device closure — soul staleness
confirm, Capabilities, expensive-model, 48dp audit, composites), task 3
(`npm run check`), task 4 (this entry), task 5 (teardown).

**Task 0.** Done, device-verified, with a self-correction worth recording.
The task's own instruction to read MMKV via a raw `run-as ... cat` byte scan
turned out to be unreliable in this environment: react-native-mmkv's on-disk
header didn't match a naive `actualSize`-at-offset-0 parse, and — more
importantly — a byte-level substring scan for `connections.list`/
`connections.active` kept finding **stale trailing bytes** left behind by
earlier, larger writes that a shorter overwrite never zeroes. Concretely: the
raw scan reported `M15R3` as present in both the list and as active, even
immediately *after* removing it through the app and confirming via a fresh
Registered Gateways screenshot that only `Hone`/`M14Close3` remained. The
first message this round pasted that wrong raw-scan output and had to be
corrected in the next message. From then on the app's own UI (Settings →
Registered Gateways, which reads `getActiveConnection()`/`listConnections()`
through the real native MMKV binding, not a byte scan) was treated as ground
truth. `M14Close3` was present as the task anticipated (round 3's teardown
correctly removed `M15R3`); it was removed via the destructive-tap rule
(fresh dump, card confirmed, dialog text confirmed it named `M14Close3` not
Hone), leaving only Hone, Primary + Current — device-verified via the UI, not
the unreliable raw scan.

**Task 1.** Done, device-verified against the throwaway gateway (port 9133,
scratch `HERMES_HOME`, basic auth, `researcher`/`coder` profiles per
setup-gw.sh's pattern).

`src/upstream/shared/json-rpc-gateway.ts:252` and `:280` (unchanged, per
AGENTS.md — never hand-edited) always reject `connect()` with the same fixed
`connectErrorMessage`, discarding the real WebSocket `error` event. The fix
adds `src/net/connect-reason.ts`: `classifyConnectReason` maps a failure to
`dns | refused | timeout | tls | unauthorized | forbidden | unreachable`,
reusing M04's reason ladder (`src/net/auth/ladder.ts`'s `classifyFailure`)
for the 401/403 case and pattern-matching the raw transport message for the
rest. `MobileGateway.connect()` (`src/gateway/mobile-gateway.ts`) captures
the raw error via its own `socketFactory`-installed listener and rethrows a
classified message instead of the vendored generic one. `src/net/http.ts`
classifies network-level `fetch()` failures the same way, so every REST
caller benefits (this mattered in practice — round 3's own field notes,
task 3, record that RN's `fetch()` on this Android build passes the
underlying OkHttp exception through in `.message`, e.g. `"fetch failed:
java.net.ConnectException: Failed to connect to /127.0.0.1:9132"`, exactly
like the WS leg; the original plan to leave `fetch()` "opaquely generic" was
wrong and corrected before writing the fix). `session-connection.ts`'s
`resolveAuth` catch only needed to add classification for its one remaining
special case (`HttpError`/401, via the ladder), since `http.ts` already
covers the network-level branch.

Device-verified, three cases, exact on-screen text pasted at the time:
- **Host stopped** (gateway process killed, `adb reverse` still up): the
  session detail screen's retry card showed *"Couldn't load this session ...
  **Could not reach the host.**"* — replacing the old generic "Could not
  connect to Hermes gateway".
- **Wrong port** (`http://127.0.0.1:9134`, nothing listening): the connect
  screen's "Detect auth mode" probe showed *"Could not reach that Hermes
  gateway. **Connection refused — is the host running?**"*.
- **Wrong password**: two distinct paths both confirmed. The initial
  sign-in screen (a pre-existing, independent code path —
  `src/net/auth/password-login.ts`'s `PasswordLoginError`, unrelated to this
  fix) showed *"Incorrect username or password."*, unchanged and correct
  already. Separately, a genuine 401 on **reconnect** (the gateway process
  was restarted between sessions, invalidating the in-memory-only session
  cookie RN's `fetch()` cookie jar held — a real, reproducible-by-accident
  case, not manufactured) went through this round's fix and showed
  *"Authentication failed — check the password."* on the same retry card as
  the host-stopped case above — confirming the fix's own code path, not just
  the pre-existing login screen.
- **Bonus, unplanned:** a transient DNS hiccup against Hone mid-round (the
  emulator's network was briefly flaky) showed *"Couldn't find that host —
  check the address."* on the boot-failure (Sessions) screen — the fourth
  reason bucket, confirmed for free.

Tests: `src/net/connect-reason.test.ts` (10 cases) and
`src/gateway/mobile-gateway.test.ts` (3 cases, including `.cause`
preservation) added; 580 tests total (567 + 13), all passing.

**Known gap, not fixed this round:** `src/api/sessions.ts`'s `sessionsRequest`
(the boot-failure screen's actual data call) goes through `http.ts` too, but
a **stale-session 401** there still surfaced as a raw `"HTTP 401
/api/sessions?limit=100&order=recent"` on the Sessions screen — `http.ts`
deliberately leaves `HttpError` (any parsed status) alone, only classifying
network-level failures, and `sessionsRequest` has no per-call classification
step the way `resolveAuth` does. Observed on-device, not patched — reported
per the standing instruction rather than expanding scope under time
pressure.

**Task 2.** Environment instability — not the app — consumed the rest of
this round's time budget. In order:
- The throwaway gateway's session cookie (RN `fetch()`'s in-memory-only
  cookie jar) expired repeatedly within single-digit minutes, forcing
  several unplanned re-sign-ins mid-task.
- `adb` itself wedged twice (commands hanging past 60s), requiring a
  force-kill of the `adb` server process and, once, a full `adb reboot` of
  the emulator guest to recover.
- Metro crashed once with `EMFILE` after being restarted without `CI=1` (to
  pick up watch-mode for a new file `metro` hadn't indexed since it started)
  — exactly the failure mode the round's own standing instruction warns
  about; recovered by restarting with `CI=1` again, which meant every
  subsequent code edit needed a manual Metro restart rather than picking up
  live.
- The bot settings sheet's SOUL.md field repeatedly failed to receive taps
  aimed at it — taps intended for the multiline Soul `TextInput` landed on
  the adjacent Description field instead (the same mis-tap round 3's own log
  independently reports for this exact sheet), twice corrupting the
  Description field's text via IME autocomplete before being caught and
  reverted. This is the same fragility round 3 flagged, not a new one.
- Removing the throwaway connection while it, not Hone, held the "active"
  slot (confirmed via `app/index.tsx`'s `getActiveConnection()`-gated root
  redirect: a cold relaunch after removal opened `/connect`, not
  `/session-list`) needed a deep link (`adb shell am start -a
  android.intent.action.VIEW -d "hermes-android://settings/connections"`) to
  reach Settings at all, since the root route has no connection to redirect
  through. Re-doing "Switch to Hone" from there and confirming via a second
  genuine cold relaunch (force-stop + launch, not just backgrounding) fixed
  it — recorded in detail under Task 5 below since it doubled as part of
  teardown.

Given this, task 2's sub-items are honestly: **2a (soul staleness confirm)
not conclusively device-verified this round either** — same as round 3's own
report for the same reason (mis-taps on this sheet), plus this round's
additional cookie/adb/Metro interruptions. The load-path half of the
mechanism (`saveSoul()`'s re-read-before-write against `detail.soul`,
`src/components/BotSettingsSheet.tsx:100-138`) was incidentally reconfirmed
working: the sheet, once opened, showed the exact soul text a Node script
(`soul-staleness-inject-r4.js`, new this round, uses node 24's native
`fetch`/`WebSocket`, no `ws` dependency) had written moments earlier via
`profiles.configure` — proving the sheet's load path reads the live host
value — but the save-time staleness *confirm* itself was not exercised.
**2b-2e: not attempted** this round (time, consumed by the above). Not
claimed as done.

**Task 3.** `npm run check` after the last commit (`17f083c`): typecheck
clean, 63 test files / 580 tests passed (13 new for task 1), 52/52 Python,
lint clean, `prettier --check .` clean (a lint fixup commit was needed after
the first pass — import order and Prettier formatting on the new files, both
mechanical, no behavior change). Exit code 0.

**Task 5 (teardown).** Done, device-verified at each step:
- Switched to Hone (`Switch to Hone`, confirmed "Primary Current"), removed
  the throwaway connection (destructive-tap rule: fresh dump, card and
  dialog text both confirmed `"M15R4"`, not Hone, before confirming). A cold
  relaunch immediately after still opened `/connect`, revealing the
  active-slot issue described above; reached Settings via the
  `hermes-android://settings/connections` deep link, re-did `Switch to
  Hone`, then verified with a *second*, genuine cold relaunch (force-stop +
  `am start`) that landed on `/session-list` with Hone's real sessions
  loading — the durable fix, not just an in-session UI state.
- Metro and the throwaway gateway (and its `hermes-agent` venv/runtime child
  processes) stopped; `curl` to both `:8081/status` and `:9133/api/health`
  confirmed connection-refused (`000`) afterward.
- Deleted: the scratch `HERMES_HOME` (`%TEMP%\hermes-m15-r4-home`),
  `scratch-password.txt`, and two `.bat` shims `hermes profile create` had
  written to `~/.local/bin` (`coder.bat`, `researcher.bat`) — all confirmed
  gone. No cookie files were created this round (the Node injection script
  used node 24's native `fetch`, not `curl -c`).
- `adb reverse --list` empty (after a second `adb` server restart — it
  wedged again during teardown); `font_scale` confirmed `1.0` (never
  touched this round).
- Emulator shut down via `adb emu kill`; `adb devices` empty afterward;
  `emulator -list-avds` still lists `hermes-test`.
- `git push`: below, working tree clean.

**Honest summary of round 4 by task:**
- 0: done, device-verified — with a documented self-correction (raw MMKV
  byte-scanning proved unreliable; the app's own UI was used as ground
  truth instead, see above).
- 1: done, device-verified — all three required cases plus a fourth
  (DNS) confirmed unplanned. One known, unfixed gap reported (sessionsRequest
  401 stays raw).
- 2a: not conclusively device-verified (same root cause round 3 hit, plus
  this round's cookie/adb/Metro interruptions) — the load-path half was
  incidentally reconfirmed; the save-time confirm was not exercised.
- 2b: not attempted (time).
- 2c: not attempted (time).
- 2d: not attempted (time).
- 2e: not attempted (time).
- 3: done, green (after one lint fixup commit).
- 5: done, device-verified at every step (see above).

### Round 5 — trustworthy registry log, connect-reason repro ruled out, soul staleness fixed on device, sessionsRequest 401 fixed; Capabilities skill-toggle bug reconfirmed (2026-09-15)

**Scope.** Task 0 (`__DEV__` registry readback log, replacing raw MMKV
byte-scanning — `src/connections/registry.ts`, `app/_layout.tsx`, committed
`c474eab`), task 1 (reproduce-or-rule-out the "switched to Hone, relaunch
opened /connect" report), task 2 (soul staleness confirm, both directions),
task 3a (Capabilities toggle read-back), task 4a (`sessionsRequest`'s raw
401 fix — `src/api/sessions.ts`, committed `4abba2d`), task 4b (cookie
lifetime read-only diagnosis), task 5 (`npm run check`). Against a fresh
throwaway gateway (port 9134, `HERMES_HOME` at `%TEMP%\hermes-m15-r5-home`,
`researcher`/`coder` profiles, basic auth), the same `hermes-test`
hardware-accelerated AVD every prior round used (never destroyed).

**Task 0.** Done, device-verified. `registry.ts` gained `registryLogLines()`
(pure, the exact text) and `logRegistryState()` (the `__DEV__` guard around
it, a no-op under plain Node/vitest where the global is absent — the file is
imported directly by `registry.test.ts`, so a bare `__DEV__` reference would
throw there). Called after every write in `setActiveConnection`,
`switchActiveConnection`, `deleteConnection`, `setPrimaryConnection`, and
once at startup from `app/_layout.tsx`'s `RootLayout` (a `useEffect`,
matching `fonts.ts`'s existing `__DEV__`-log pattern). Two new unit tests
(`registry.test.ts`) assert the log text carries only id/label/primary/
needsLogin and never `baseUrl`, `authMode` or header names, and that
`logRegistryState()` itself prints nothing without `__DEV__`. Live proof,
`adb logcat` throughout task 1 below, e.g.:
```
[registry] active: conn-1789426055940-vtv767 (M15R5)
[registry] list: conn-1789205984475-cpgcec (Hone) primary=true needsLogin=false
[registry] list: conn-1789426055940-vtv767 (M15R5) primary=false needsLogin=false
```
This is now the storage readback trusted for the rest of this round and
should be for future rounds too — never a byte scan.

**Task 1.** Ruled out, not reproduced — three full cycles, each with a fresh
`adb logcat` registry readback at every step (add throwaway → make active →
switch to Hone → confirm Current via both the log and a UI screenshot →
remove the throwaway via the destructive-tap rule, confirmed by a fresh
`uiautomator dump` naming the card being removed → force-stop → cold
launch). All three cycles: the registry log after cold launch showed
`active: ... (Hone)` / `list: ... (Hone) primary=true needsLogin=false` with
nothing else in the list, and the app landed on `/session-list` with Hone's
real sessions loading — never `/connect`. Matches the code-level analysis
in the task brief exactly (`registry.ts`'s `deleteConnection` only clears
the active slot when the removed connection IS active; `switchActiveConnection`
writes synchronously; nothing in this branch calls `clearActiveConnection`
— confirmed by `grep`, its only caller is its own test). Round 4's
observation stands as unexplained, most likely exactly what round 4 itself
guessed: a tap that didn't register, or state lost to that round's emulator
reboot — not a reproducible bug.

**Task 2.** Done, device-verified — both the "is this a real overlap"
question and the staleness confirm itself, in both directions (keep host's
version / keep mine).
- *Overlap check.* `uiautomator dump` with the Soul field's keyboard closed
  showed Description ending at y=1291 and Soul starting at y=1345 (54px
  gap, no overlap). With the keyboard open, Soul's own bounds are unchanged
  and it visually never overlaps Description — but the sheet's full
  accessibility-tree bounds for Soul extend *behind* the on-screen keyboard,
  and the underlying chat screen's composer `EditText` (not part of the
  modal sheet, and never actually reachable by touch while the sheet is up)
  sits at a numerically overlapping position in the same dump. A targeted
  test — typing a marker string at a tap coordinate inside that
  numerically-overlapping zone — landed correctly inside the Soul field, not
  the hidden composer, confirming touch dispatch is correct and this is not
  a real, user-facing layout defect. The actual lesson (and most likely
  explanation for rounds 3/4's mis-taps): a tap computed from a *stale*
  `uiautomator` dump — taken before the sheet's content reflowed after a
  prior edit or dialog — can land on the wrong field, because the sheet's
  field bounds visibly shift by tens of pixels between interactions (e.g.
  Description moved from `[42,1123][1038,1291]` to `[42,1162][1038,1330]`
  after one round-trip through the staleness dialog). Always re-dump
  immediately before tapping; never reuse a coordinate across a dialog or
  keyboard-visibility change. No code fix needed — nothing here is a defect,
  it's a testing discipline requirement, now recorded as such.
- *Staleness confirm, "keep theirs" (CANCEL).* Focused Soul via a fresh
  dump's node center, typed a marker, ran `soul-staleness-inject-r5.js`
  (adapted from round 4's script, port 9134) to change `coder`'s soul from
  Node via `profiles.configure` while the sheet was open, then blurred by
  tapping the Description field (also freshly dumped). The confirm dialog
  appeared: *"Soul changed on the host — This bot's SOUL.md was edited
  somewhere else since you opened it. Overwrite it with your version?"*.
  Tapped CANCEL; `profiles.describe` read back the Node-injected text
  verbatim — the host's version won, confirming the reload-on-cancel path.
- *Staleness confirm, "keep mine" (SAVE).* Repeated with a second marker and
  a second Node injection; tapped SAVE this time. `profiles.describe` read
  back the on-device edit (with the marker text) verbatim, including the
  `ensureMessagingProtocol`-appended "Messaging other agents" section —
  confirming the overwrite-with-mine path.

**Task 3a.** Done, device-verified — with a real, reconfirmed bug.
Toggled `hermes-agent` (a skill) off and `stt`/Speech-to-Text (a toolset) on
in `coder`'s Capabilities screen, tapped Save (found via a fresh dump each
time — the Save button's touch target overlaps the last list row's switch
by several dozen px, another stale-coordinate trap). `profiles.describe`
read back: **toolset side correct** — `stt.enabled` went `false → true`,
matching the UI. **Skill side wrong** — `hermes-agent.enabled` still read
`true` after Save, even though the sheet's own summary badge updated to
"0 · 17" (0 skills, matching the toggle-off). This is the exact discrepancy
round 3 first reported and left unresolved ("the sheet's own summary badge
updated correctly... but `profiles.describe` still reported `hermes-agent`'s
`enabled: true` afterward") — now reproduced a second time, two rounds
apart, confirming it is a real, standing bug in the skill-toggle save path
(not a fluke of round 3's environment). Not diagnosed or fixed this round
(out of this round's brief); flagging it as a confirmed defect worth its
own task. The "enable all clears the toolset pin" check
(`profile-config.tsx:585-590`'s desktop logic, ported at
`src/components/CapabilitiesSheet.tsx`/`src/api/bots.ts`'s
`toolsets_pinned`) was code-confirmed only — `toolsets_pinned: true` was
read back correctly before this test, but the on-device "toggle the one
remaining disabled toolset, save, and confirm `toolsets_pinned` flips to
false" sequence was not completed: the nested Capabilities screen inside
the Bot settings sheet proved too fragile to drive reliably via blind
coordinates (row bounds shift after almost every interaction, and the
bottom-docked Save bar overlaps the last couple of switches' touch targets)
and repeated attempts cost more time than this round could spend on one
sub-check. Not claimed as device-verified.

**Task 3b (expensive-model confirm).** Not attempted, same as round 3: the
throwaway host's `config.yaml` only lists `mimo-v2.5`/`deepseek-v4-flash`
under `opencode-go`, neither flagged as an expensive-model trigger, and
seeding one was out of this round's time budget. Code path unchanged since
round 1/2's code-level verification.

**Task 3c (48dp audits) and 3d (composites).** Not attempted this round —
time was spent on tasks 0-2 and 4 instead, which this round's brief called
out as needing device closure most urgently (a trustworthy readback and
resolving the connect-reason repro report). Honestly not done, not
partially claimed.

**Task 4a.** Done, both live-RPC-proven and device-verified. See the commit
above. `src/api/sessions.ts`'s `sessionsRequest` now classifies any
`HttpError` through `classifyConnectReason`/`describeConnectReason` (the
same M04 reason ladder `session-connection.ts`'s `resolveAuth` already used
for its own `HttpError` case), so a REST-level 401 gets the same friendly
message instead of a raw `HTTP 401 ...` line. Two new tests
(`sessions.test.ts`): a 401 classifies to "Authentication failed — check the
password." (and explicitly does *not* still contain "HTTP 401"), and a
non-auth 5xx classifies to "Could not reach the host." rather than being
left raw. Device-verified live: killed the throwaway gateway's process,
restarted it against the same `HERMES_HOME`/port/credentials (invalidating
the in-memory session cookie without changing the password), cold-relaunched
the app — the Sessions screen showed *"Authentication failed — check the
password."* where round 4 saw a raw `HTTP 401 /api/sessions?limit=100&order=recent`.

**Task 4b (cookie-lifetime diagnosis, read-only).** Done, code-level only —
read-only as instructed, not fixed regardless of the finding. The basic-auth
provider's access-token cookie TTL is 12 hours by default
(`plugins/dashboard_auth/basic/__init__.py:32`,
`_DEFAULT_TTL_SECONDS = 12 * 60 * 60`), with a 30-day refresh token (`:33`)
and `Max-Age` set to `exp - now` (`hermes_cli/dashboard_auth/
request_utils.py:43-45`, `access_token_max_age`, floored at 60s). The
gateway's own middleware transparently rotates both cookies on any request
that arrives with an expired access-token cookie but a still-valid
refresh-token cookie (`hermes_cli/dashboard_auth/middleware.py:179-196`,
`_attempt_refresh`/`_serve_refreshed`) — the top-of-file comment states
outright "the middleware transparently refreshes via the 30-day refresh
token when the access token lapses, so the TTL controls refresh frequency,
not login length." **This does not match round 4's "expired within
single-digit minutes" symptom** — a 12-hour/30-day contract, with
server-side auto-refresh, should not force a re-login within minutes at
all. The mobile app's own client code (`src/net/http.ts`,
`src/net/auth/password-login.ts`, `src/gateway/session-connection.ts`) never
reads, inspects or persists Set-Cookie headers itself: every password-mode
call passes `credentials: 'include'` and relies entirely on the RN/OkHttp
networking layer's own (default, unconfigured) cookie handling —
`package.json` has no cookie-management dependency at all (`grep -i cookie
package.json` is empty). **Conclusion:** a user on a password connection is
not expected to be logged out every few minutes by the server's own
contract; round 4's symptom is more likely a client-side cookie-persistence
gap in RN's default fetch/cookie jar than a short server session, but
confirming that specific root cause needs an isolated on-device timing test
(two authenticated REST calls several minutes apart, checking whether the
second one still carries the first's Set-Cookie) that this round did not
have time to run. Reported as a diagnosis, not fixed — this is outside this
branch's own code either way (the server's TTL is generous; if RN's cookie
jar really is the gap, the fix is either an explicit cookie-management
dependency or moving password mode onto the same ticket-based pattern
token/oauth already use, both larger changes than a read-only round should
decide).

**Environment note, not a finding.** Mid-round, an unrelated Android system
prompt (`com.google.android.gms`'s "Sign in with ease" / Google account
setup wizard) surfaced over the app for no action this round took
deliberately — dismissed via SKIP and the system Back button without
entering any account information, then the emulator was returned to the
home screen and the app cleanly relaunched. Not the app's own UI, not
interacted with beyond backing out; noted here only so the screenshot
sequence around task 3a's later attempts is not mistaken for an app screen.

**Task 5.** `npm run check` after the last commit (`4abba2d`): typecheck
clean, 63 test files / 584 tests passed (4 new: 2 for task 0, 2 for task
4a), 52/52 Python (the one visible traceback is the same intentionally
mocked failure prior rounds' logs also note, not a real error), lint clean,
`prettier --check .` clean. Exit code 0.

**Honest summary of round 5 by task:**
- 0: done, device-verified.
- 1: done — ruled out, not reproduced, across three full cycles with fresh
  evidence at every step.
- 2: done, device-verified — both the overlap question (not a real defect,
  root-caused to stale-coordinate testing instead) and both directions of
  the staleness confirm.
- 3a: part-done — toggle-and-readback device-verified for both a skill and
  a toolset, surfacing a real, reconfirmed bug (skill toggle doesn't
  persist server-side despite the UI/summary badge updating); the
  toolset-pin-clears-on-enable-all sub-check was not completed on device
  (fragile nested-sheet automation, time), only code-confirmed.
- 3b: not attempted (no expensive-model trigger available, time) — same as
  round 3.
- 3c: not attempted (time).
- 3d: not attempted (time).
- 4a: done, both live-RPC and device-verified.
- 4b: done as a read-only diagnosis (not fixed, as instructed) — the
  server's own contract doesn't explain round 4's symptom; the likely cause
  is named but not conclusively proven this round.
- 5: done, green.
- 6 (this log entry) and 7 (teardown): done, see below.

**Task 7 (teardown).** Done, device-verified at each step:
- Switched to Hone (registry log: `active: ... (Hone)`, list now
  `[Hone primary=true]` only, confirmed before AND after the remove),
  removed `M15R5` via the destructive-tap rule — a fresh `uiautomator dump`
  immediately before the tap, the confirm dialog's own text checked
  ("M15R5" will be removed..."), only then REMOVE tapped. A cold relaunch
  (force-stop + `am start`, new PID each time — `6068` → `6638` → `6876`
  across this round's launches, confirming each one was genuine) landed
  cleanly on `/session-list` with Hone's real sessions, registry log
  showing only Hone, `primary=true`, `needsLogin=false`.
- Metro (both node PIDs from this round's two starts) and the throwaway
  gateway (`hermes.exe`, restarted once mid-round for task 4a's live check)
  stopped; `curl` to both `127.0.0.1:8081/status` and
  `127.0.0.1:9134/api/health` returned `000` (connection refused)
  afterward. Left this round's own `node`/`hermes` processes only — five
  unrelated `node` processes already running before this round started
  (timestamps `2026-09-14 23:49:xx`, the previous evening) were not
  touched.
- Deleted: the scratch `HERMES_HOME` (`%TEMP%\hermes-m15-r5-home`),
  `scratch-password.txt`, and the two `.bat` shims `hermes profile create`
  wrote to `~/.local/bin` (`coder.bat`, `researcher.bat`) — all confirmed
  gone by a follow-up `ls` failing on each path.
- `adb reverse --list` empty after `--remove-all` (one `adb` wedge hit
  mid-teardown — `adb reverse --remove-all` hung past its timeout; per the
  standing rule, killed only the `adb` server process, `adb start-server`,
  device reconnected cleanly, no emulator reboot needed); `font_scale`
  confirmed `1.0` (never touched this round).
- Emulator shut down via `adb emu kill`; `adb devices` empty immediately
  after, and a follow-up process check confirmed no lingering `emulator.exe`
  processes a few seconds later; `emulator -list-avds` still lists
  `hermes-test`. Only the local `adb` server daemon process remains (no
  device attached to it) — not a stray client.
- `git push`: below, working tree clean after this commit.

### Round 6 — M15 group A close-out: skill-lock premise corrected, toolset pin clear device-verified, real 48dp fix, cookie bug isolated to the client (2026-09-15)

**Scope.** A short, fixed checklist: task 1 (Capabilities skill-toggle premise
correction — `src/components/CapabilitiesSheet.tsx`, `src/api/bots.ts`,
`src/lib/strings.mobile.ts`, committed `d9ff16c` + a same-round fixup
`9c23ced`), task 2 (enable-all clears the toolset pin, device-verified), task
3 (expensive-model, code-verify only), task 4 (48dp audit of four screens,
one real fix), task 5 (composites — not attempted), task 6 (cookie lifetime,
time-boxed), task 7 (`npm run check`), task 9 (teardown). Against a fresh
throwaway gateway (port 9135, `HERMES_HOME` at `%TEMP%\hermes-m15aclose-home`,
`researcher`/`coder` profiles, basic auth), the same `hermes-test`
hardware-accelerated AVD every prior round used.

**Task 1.** Done, device-verified, with a self-correction recorded honestly.
The premise was right: `hermes_cli/skills_config.py:43-54`'s
`save_disabled_skills` silently drops any name in
`agent/skill_utils.py:270`'s `ESSENTIAL_SKILLS` (`frozenset({"hermes-agent"})`)
from the persisted `disabled` set before it ever reaches `profiles.configure`'s
`_configure_cfg_sections` (`tui_gateway/methods_profiles.py:548-555`) — the
gateway never disables it, full stop. `CapabilitiesSheet.tsx`'s own defect
was separate: `save()` discarded `configureBot`'s return value entirely and
rendered the local toggle state via `onSaved({ ...detail, skills, toolsets })`
instead of what the server actually stored.

Fixed: `save()` now re-reads `profiles.describe` after `configureBot` and
renders that (`setSkills(fresh.skills)`, `setToolsets(fresh.toolsets)`,
`onSaved(fresh)`). A new pure helper, `skillsServerKeptEnabled` (`src/api/
bots.ts`), diffs what the caller attempted to disable against what the fresh
read shows still enabled — never hard-codes a skill name — and drives a
per-row note (`botsCapabilitiesSkillLockedNote`, `src/lib/strings.mobile.ts`:
*"‘hermes-agent’ can't be disabled — the host keeps it on."*). Unit-tested
directly (`bots.test.ts`, 3 cases) since this project's vitest setup doesn't
render `.tsx` components.

First on-device pass found the note never actually rendered. Root cause: the
sheet's reset `useEffect` depended on `[detail, visible]`, so `onSaved(fresh)`
updating the parent's `detail` prop re-triggered the SAME effect, which
unconditionally reset `lockedSkillNames` back to `[]` — wiping the note the
instant `save()` had just set it, before the screenshot could ever catch it
displayed. Fixed in the same round (`9c23ced`): the effect now depends only
on `[visible]` (reads `detail` through a ref so it still sees the current
value without re-running on every in-place update), since `save()` already
applies the server's fresh state directly and doesn't need the effect to
duplicate that. Re-verified device-side after the fix:
- Toggled `hermes-agent` off, tapped Save (fresh dump each time — the row is
  now the tap target, see task 4). The switch snapped back to enabled and
  *"‘hermes-agent’ can't be disabled — the host keeps it on."* appeared
  directly under it, exactly as designed.
- The toolset side of the same save (task 2's pin-clear test, run earlier
  the same round) was already confirmed correct independently.
- **Not device-verified:** "toggle a genuinely non-essential skill off, save,
  confirm it stays off via `profiles.describe`." Both seeded profiles
  (`researcher`/`coder`) were created `--no-skills`, so `hermes-agent` is the
  ONLY skill installed on either — there was no non-essential skill on this
  throwaway host to exercise that path with. The general write-then-
  re-read pipeline is the same code for both cases (only
  `skillsServerKeptEnabled`'s diff differs in outcome), and the toolset save
  through the identical `configureBot`/`describeBot` round-trip is
  device-confirmed working, but the "stays off" half of task 1 specifically
  is honestly not directly proven this round.

**Task 2.** Done, device-verified. Pinned one toolset (`researcher`,
toggling off Web Search & Scraping while `stt`/`context_engine` were already
off by default — 15 of 18 enabled) via the sheet; `profiles.describe` read
back `toolsets_pinned: true`, `disabled: ["web","stt","context_engine"]`. A
first UI-driven attempt at the "enable all" half silently produced no
change server-side (`configureBot` threw no error, but the readback showed
the pin untouched) — isolated with a direct RPC script bypassing the app
entirely, which pinned/unpinned correctly every time, confirming the
mechanism itself (`_save_toolset_pin`, `tui_gateway/methods_profiles.py:
508-516`) is sound; the one-off app-driven miss was not reproduced on a
careful retry (fresh dump before every tap, the earlier root cause of most
of this round's automation friction) and is recorded as unexplained rather
than claimed as a bug. Retry: toggled `web`, `stt`, `context_engine` all
back on (18 of 18), saved — `profiles.describe` read back
`toolsets_pinned: false`, with `stt`/`context_engine` reverting to the
platform's own default-off set (`hermes_cli/tools_config.py`'s
`_DEFAULT_OFF_TOOLSETS`, read through `methods_profiles.py:377-397`'s
`_describe_toolsets`) — the pin is genuinely gone, not just coincidentally
matching. Both readbacks pasted above; both against `researcher`.

**Task 3 (expensive-model confirm).** Code-verified only, as instructed —
the throwaway host's `config.yaml` has no model flagged as an expensive-model
trigger and seeding one was out of this round's scope. The
`confirm_required` → resend handshake is: `_configure_model`
(`tui_gateway/methods_profiles.py:480-501`) computes `confirm_message` via
`hermes_cli.model_selection_guards.combined_selection_warning` unless
`confirm_expensive_model` is already truthy; `profiles.configure`'s handler
(`:563-586`) folds that into the same `{confirm_required, confirm_message}`
shape `config.set`'s model switch uses. Client side: `src/api/bots.ts`'s
`configureBot` sends `confirm_expensive_model` only when
`ConfigureBotPatch.confirmExpensiveModel` is set, tested directly in
`bots.test.ts`'s *"configureBot resends confirm_expensive_model only when
the caller asks"*; `BotSettingsSheet.tsx:162-163` is where the UI shows the
`Alert` on `result.confirm_required` and resends with `confirmExpensiveModel:
true`. The same handshake shape is exercised at the `config.set` layer in
`models.test.ts` (the `deferred`/`confirm_required` fixtures there).

**Task 4 (48dp audit).** Done — light theme only (dark not attempted, time).
dp = px / (420/160) = px / 2.625 on this device (`wm density` → 420,
confirmed again this round). Every clickable node measured across the four
screens:

| Screen | Node | px (w×h) | dp (w×h) | OK? |
|---|---|---|---|---|
| Roster | Open menu | 126×126 | 48.0×48.0 | ✅ (exact minimum) |
| Roster | New bot | 126×126 | 48.0×48.0 | ✅ (exact minimum) |
| Roster | Bot row (each) | 1080×189–217 | 411×72–83 | ✅ |
| New-bot sheet | Close | 126×126 | 48.0×48.0 | ✅ (exact minimum) |
| New-bot sheet | Name field | 996×132 | 379×50.3 | ✅ |
| New-bot sheet | Description field | 996×168 | 379×64.0 | ✅ |
| New-bot sheet | Model row | 996×126 | 379×48.0 | ✅ (exact minimum) |
| New-bot sheet | Avatar seed field | 996×132 | 379×50.3 | ✅ |
| New-bot sheet | Cancel | 488×126 | 186×48.0 | ✅ (exact minimum) |
| New-bot sheet | Create Bot | 487×126 | 185×48.0 | ✅ (exact minimum) |
| Bot settings sheet | Back | 126×126 | 48.0×48.0 | ✅ (exact minimum) |
| Bot settings sheet | Bot settings icon | 126×126 | 48.0×48.0 | ✅ (exact minimum) |
| Bot settings sheet | Close | 126×126 | 48.0×48.0 | ✅ (exact minimum) |
| Bot settings sheet | Model row | 996×147 | 379×56.0 | ✅ |
| Bot settings sheet | Capabilities row | 996×147 | 379×56.0 | ✅ |
| Bot settings sheet | Attach image/doc/voice/read-aloud | 126×126 each | 48.0×48.0 each | ✅ (exact minimum) |
| Bot settings sheet | Composer field | 370×168 | 141×64.0 | ✅ |
| **Capabilities** | **Skill/toolset row Switch itself** | **122×71** | **46.5×27.0** | **❌ real violation** |
| Capabilities | Save | 996×126 | 379×48.0 | ✅ (exact minimum) |

**One real violation, fixed and re-dumped.** Every skill/toolset row's bare
`<Switch>` renders at a fixed native size regardless of its container —
`styles.row`'s own `minHeight: 48` sizes the ROW (confirmed: the row's own
clickable bounds after the fix are 996×126px = 379×48.0dp and 996×136px =
379×51.8dp), but before this round only the Switch itself was clickable,
and its native rendered bounds (122×71px) are under 48dp in BOTH dimensions
— worst axis at 27dp, little over half the minimum. Fixed
(`CapabilitiesSheet.tsx`): each row (skill and toolset) is now wrapped in a
`Pressable` that toggles the same value; the `Switch` stays wired for a tap
landing directly on it. Same-scope fix, not touching the other three
screens' pre-existing `<Switch>` usages elsewhere in the app
(`settings/toolsets.tsx`, `settings/skills.tsx`, `settings/profiles.tsx`,
`settings/mcp.tsx`, `settings/notifications.tsx`, `channels/index.tsx`,
`webhooks/index.tsx` all share this exact bare-Switch pattern — a wider
issue worth its own pass, out of this round's four-screen scope). Re-dumped
after the fix: the parent row is now `clickable="true"` at
`[42,284][1038,410]` (hermes-agent) and `[42,494][1038,630]` (Web Search &
Scraping) — 48.0dp and 51.8dp tall respectively — and toggling by tapping
the row (not the tiny switch) was device-confirmed to work
(`checked="false"` after the tap, matching the intended toggle).

**Task 5 (composites).** Not attempted — time, spent instead on tasks 1/2/4's
device re-verification after each fix and task 6's investigation below.
Round 2's roster/new-bot composites (light only) remain the most recent
evidence; nothing new produced this round.

**Task 6 (cookie lifetime), time-boxed.** Done — root-caused further than
"reported, not fixed" required, with strong evidence the gap is client-side.
Signed in to the throwaway gateway (password mode) at `17:10:54`. Left the
app idle (never killed) and checked at intervals:
- **T+~5min (`17:16:01`):** Sessions (REST) showed *"Authentication failed —
  check the password."* — the first sign of trouble, unprompted (no gateway
  restart this time, unlike round 5's deliberate one).
- **T+~5-7min:** the WS layer (Bots roster via `profiles.list`, then
  opening `coder`'s chat and sending "Say hello in exactly three words.")
  worked completely fine — full streamed reply received (`12.1k tok`).
  **This is the key data point**: REST failed while the already-open
  WebSocket (opened once, at sign-in, with a valid ticket) kept working —
  because an established WS connection is never re-checked against the
  cookie after its initial upgrade handshake, unlike each fresh REST call.
- **T+~10-11min (`17:21:36`):** REST still failing with the same message;
  WS (Bots roster) still working.
- **T+~14min, cold relaunch (force-stop + `am start`, new PID `6876`):**
  **both layers now failed** — Sessions (REST) showed the same
  "Authentication failed," and Bots (a *fresh* WS dial, which DOES need a
  valid cookie to mint its ws-ticket) also failed the same way. This
  confirms the earlier WS "success" was only because that one connection
  never needed to re-present the cookie — a brand-new dial needs it just as
  much as REST does, and by then it too failed.
- **Root cause isolation.** Saved the exact `Set-Cookie` bytes from a
  separate, independent login (`control-cookie.txt`, `17:25:50`) — its own
  `Max-Age=43200` (12h) is right there in the raw header, confirming
  `plugins/dashboard_auth/basic/__init__.py:32`'s `_DEFAULT_TTL_SECONDS`
  code-level reading exactly. Re-sent that SAME saved cookie against
  `/api/sessions` at `17:35:06` — **9 minutes 16 seconds later, HTTP 200.**
  The server-issued cookie is fine and the server honors its own 12-hour
  TTL correctly when the identical bytes are resent (these are stateless
  HMAC-signed tokens — `plugins/dashboard_auth/basic/__init__.py:87-109`,
  `_sign`/`_unsign` — no server-side session store to lose, so a resend of
  the same bytes either verifies or it doesn't, deterministically). Yet the
  app's own cookie, from a real sign-in, was already dead by minute 5.
  **Conclusion: this is not a server-side session death — it's the app not
  correctly persisting or resending its own valid cookie.** The app itself
  never touches Set-Cookie at all (`src/net/http.ts`, `src/net/auth/
  password-login.ts`, `src/gateway/session-connection.ts` all pass
  `credentials: 'include'` and rely entirely on RN's own, unconfigured
  fetch/cookie-jar layer — `package.json` has no cookie-management
  dependency, confirmed empty `grep -i cookie package.json`), so the gap is
  in that layer, not in any code this branch owns. Not fixed, as instructed
  — reported with file:line and the isolating test above.

**Task 7.** `npm run check` after the last commit (`9c23ced`): typecheck
clean, 63 test files / 587 tests passed (3 new: `skillsServerKeptEnabled`),
52/52 Python (the one visible traceback is the same intentionally mocked
failure every prior round's log also notes), lint clean, `prettier --check .`
clean. Exit code 0.

**Honest summary of round 6 by task:**
- 1: done, device-verified, including a same-round fixup after the first
  on-device pass caught the note not rendering. One sub-check ("a
  non-essential skill stays disabled") not directly device-verified — no
  non-essential skill exists on either seeded profile.
- 2: done, device-verified (`toolsets_pinned` true → false, both readbacks
  pasted). One earlier app-driven attempt silently no-op'd and was not
  reproduced on retry — reported as unexplained, not claimed as a bug.
- 3: done, code-verified only (no expensive-model trigger available, as
  instructed).
- 4: done for light theme (dark not attempted) — found and fixed one real
  violation (Capabilities switch rows), re-dumped to confirm.
- 5: not attempted (time).
- 6: done, time-boxed — root-caused past "reported" to a client-side
  cookie-persistence gap, evidenced by a controlled cookie that survived
  9m16s using the exact bytes the app's own dead session could not.
- 7: done, green.

**Task 9 (teardown).** Done, device-verified at each step:
- Switched to Hone (registry log: `active: ... (Hone)`, list
  `[Hone primary=true]` only, confirmed before AND after the remove),
  removed `MACLOSE` via the destructive-tap rule — a fresh `uiautomator
  dump` immediately before the tap, the confirm dialog's own text checked
  ("MACLOSE" will be removed...), only then REMOVE tapped. A cold relaunch
  (force-stop + `am start`, new PID `7046`, confirming a genuine restart)
  landed cleanly on `/session-list` with Hone's real sessions, registry log
  showing only Hone, `primary=true`, `needsLogin=false`.
- Metro (this round's two restarts) and the throwaway gateway (`hermes.exe`)
  stopped; `curl` to both `127.0.0.1:8081/status` and
  `127.0.0.1:9135/api/health` returned `000` (connection refused)
  afterward. No prototype servers were started this round (task 5 not
  attempted), so nothing else to stop. Left alone: five unrelated `node`
  processes already running before this round started
  (`2026-09-15 14:17:xx`–`14:18:xx`, well before this round's own work
  began) — not touched, matching the standing rule.
- Deleted: the scratch `HERMES_HOME` (`%TEMP%\hermes-m15aclose-home`),
  `scratch-password.txt`, this round's own `control-cookie.txt` (task 6's
  isolation test artifact), and the two `.bat` shims `hermes profile create`
  wrote to `~/.local/bin` (`coder.bat`, `researcher.bat`) — all confirmed
  gone by a follow-up `ls` failing on each path.
- `adb reverse --list` empty after `--remove-all`; `font_scale` confirmed
  `1.0` (never touched this round).
- Emulator shut down via `adb emu kill`; `adb devices` empty immediately
  after. Two `emulator.exe` processes were still visible for a few seconds
  post-kill (a shutdown-in-progress, not a stray) — a second check after a
  short wait confirmed both gone, only the local `adb` server daemon
  process left (no device attached to it). `emulator -list-avds` still
  lists `hermes-test`.
- `git push`: below, working tree clean after this commit.

## M15 group A — exit criteria, as of round 6

- **Bots roster/canonical chat/soul edit** (per this doc's own Exit
  criteria section, "Bots: ... editing the soul changes SOUL.md on the
  host"): **met** — device-verified across rounds 2-6; soul staleness
  confirm (both keep-mine and keep-theirs) device-verified round 5.
- **Capabilities screen reflects the server's actual state, not a locally
  assumed one**: **met** — round 6, device-verified (this round's task 1).
  An essential skill cannot be disabled and the sheet now says so instead
  of silently reverting with no explanation.
- **Toolset pin set/clear round-trips through `profiles.configure`/
  `profiles.describe`**: **met** — round 6, device-verified (`toolsets_pinned`
  true → false, both readbacks pasted in task 2 above).
- **Connect-reason ladder covers WS connect, ws-ticket mint, and the
  Sessions REST call**: **met** — round 4 (WS/ticket) and round 5
  (`sessionsRequest`), both device-verified.
- **"Switched to Hone, relaunch opened /connect" is either fixed or ruled
  out**: **met (ruled out)** — round 5, three full cycles, not reproduced.
- **Every clickable node on the four audited screens meets 48dp**: **met
  for light theme** — round 6 found and fixed the one real violation
  (Capabilities switch rows); dark theme not audited (not attempted).
- **Composites match the prototype in both themes, deviations named**:
  **not met** — not attempted any round after round 2's light-only roster/
  new-bot pair; Bot Settings sheet and Capabilities composites never
  produced in either theme.
- **Expensive-model confirm exercised end-to-end on device**: **not
  met, code-verified only** — no throwaway host across any round has ever
  had a model configured to trigger it; the handshake itself is
  code-verified and unit-tested (round 6 task 3).
- **A user on a password connection is not silently logged out**: **not
  met** — round 6 isolated the cause to a client-side cookie-persistence
  gap (`src/net/http.ts` and friends rely entirely on RN's own,
  unconfigured fetch cookie jar); reported with evidence, not fixed, per
  every round's standing instruction not to expand scope on this one.

### Opus close-out, group A (2026-09-15)

Group A's five tasks and the Bots exit criterion are ticked. Opus checked the evidence against
the rounds' commits, dumps and logs, and re-ran `npm run check` at `64df0ef` (exit 0, 587 tests).

**Bots exit criterion, part by part:**
- **Two bots on the roster:** round 2, task 4a.
- **Avatar SVGs equal the desktop's:** round 1, task 5 (`src/lib/bot-avatar.test.ts`, against a
  fixture generated independently from `blobatar`).
- **Opening a bot lands in the canonical chat the desktop's rule resolves:** the id came from a
  Node script in round 2 (task 4c). Round 3 showed the chat opening on device after the
  Deviation 5 fix (`0a118bd`).
- **A soul edit reaches `SOUL.md`:** read back over `profiles.describe` in rounds 3 and 5, including
  both directions of the changed-on-host confirm.

**Not claimed, and not part of M15's exit criteria:**
- the dark-theme 48 dp audit
- side-by-side composites of the settings sheet and Capabilities
- an expensive-model confirm on device (code-verified only)
- a non-essential skill staying disabled (no seeded profile had one)

These are carried as known gaps, not blockers.

**Correction to round 6's cookie conclusion.** The evidence shows the server honours its 12-hour
cookie lifetime for a freshly issued cookie. It does not show that the client lost its own
cookie. A different cause fits the same observations:
- `m14-device/setup-gw.sh` sets no `HERMES_DASHBOARD_BASIC_AUTH_SECRET`.
- Without one, the basic-auth plugin "generat[es] a random per-process signing key. Sessions will
  not survive a restart or span multiple workers" (`plugins/dashboard_auth/basic/__init__.py:191-202`).
- Any gateway restart or second process during the idle window would reject the app's cookie and
  accept one minted afterwards, which is exactly what round 6 saw.

No gateway log from that run was kept, so neither cause is confirmed. `setup-gw.sh` now pins a
per-scratch-home secret. The idle test is re-run with it before any client-side cookie work
starts. For real deployments (Hone), `dashboard.basic_auth.secret` should be set, or every
gateway restart signs every phone out.

### Round 7 — cookie fix confirmed, model/effort chips and response stats device-verified, two real bugs found and fixed, one found and not fixed (2026-09-15)

**Task 0 (cookie idle re-test): met.** `setup-gw-r7.sh` pins `HERMES_DASHBOARD_BASIC_AUTH_SECRET`
per scratch home; `gw.log`'s startup carries no "no 'secret' configured" INFO line. Signed in,
checked REST + WS at ~6, ~12 and ~20 minutes — all three succeeded, zero 401s, zero restarts or
worker spawns in the gateway log. Confirms the Opus close-out correction: round 6's failure was
the missing secret, not a client-side cookie-persistence gap. Item closed.

**Task 1 (model/effort chips): met, after a fix.** `ModelChip`/`EffortChip` (`0f453de`) render
without squeezing the composer's input (Deviation 7); `EffortChip` lists Off plus all seven
`VALID_REASONING_EFFORTS` levels (Deviation 8). Device pass found the model sheet's list
rendering zero rows even though `getGlobalModelOptions` returned 58 models — a genuine Android
layout bug (`f1fad80`): a `ScrollView` nested directly in `Sheet.tsx`'s percentage-height
(`maxHeight: '88%'`) body measures to zero height regardless of its own `maxHeight`/`height`
style; render-time logging confirmed React held and re-rendered all 58 options while the native
list stayed empty. Fixed by wrapping it in a plain `View` (explicit `height: 320`, which sizes
correctly in that same ancestor chain) with the `ScrollView` filling it via `flex: 1`.
Device-verified after the fix: changed both model (mimo-v2.5 → claude-sonnet-5) and effort
(Off → Medium) on session A (`coder`, stored id `20260915_185158_bf85de`) from the chips; the
next read of that session shows both:
```
"model":"claude-sonnet-5","model_config":"{\"follow_profile_config\": true, \"model\":
\"claude-sonnet-5\", \"provider\": \"anthropic\", ..., \"reasoning_config\": {\"enabled\":
true, \"effort\": \"medium\"}}"
```
Session B (`researcher`, stored id `20260915_193653_ffdb28`, created fresh this round since
neither `researcher` nor `default` had one yet) is unchanged: `"model":"mimo-v2.5",
"model_config":"{\"follow_profile_config\": true}"` — no `reasoning_config` override.
`config.yaml`'s `model.default` is still `mimo-v2.5` / `provider: opencode-go`, untouched, per
D17.3. (Read via each session's own `GET /api/sessions/{id}?profile=...` — the persisted
`session.info`-equivalent state — since the round's scratch gateway doesn't expose a direct
event log; the WS `session.info` push itself was not captured verbatim.)

**Not fixed, reported: the chip/header display goes stale after an app restart.**
Right after picking a model/effort on-device, the composer header correctly showed "anthropic ·
claude-sonnet-5 · medium". After a later cold relaunch (force-stop + relaunch, done repeatedly
this round for Metro-picks-up-the-edit reasons unrelated to this bug), the SAME session's header
and chips reverted to showing "opencode-go · mimo-v2.5" / "Off" — the pre-change values — even
though `GET /api/sessions/{id}` confirms the server still has `claude-sonnet-5`/`medium`. This is
a client-side staleness bug, not a server one: `session-connection.ts`'s `hydrate` effect (a
full re-fetch) only fires for `session.reclaimed`-while-active or an incomplete-turn recovery,
not for an ordinary "open an existing chat" navigation — so whatever RPC populates
`SessionState.model`/`reasoningEffort` on a plain chat-screen mount did not carry the session's
current values. This also affects task 2's `message.model` stamping (below): a message completed
under this state showed the stale model, not the actual one used. Not investigated further this
round (a new bug, not one of the round's five tasks) — filed as a known gap here rather than
silently worked around.

**Task 2 (response stats): met, after a fix.** `ResponseStats` (`d01dded`) renders `model · Σ
tok · tok/s` under a settled assistant message when `message.usage.total > 0`, reading
`usage.avg_tps` directly (matches the desktop's `tokensPerSecondLabel`,
`apps/desktop/src/lib/statusbar.tsx:72-76`) and `compactNumber` ported verbatim
(`apps/desktop/src/lib/format.ts:1-24` → `src/lib/format.ts`). Device pass found the model
segment always empty — traced to a wrong assumption in the original port: `ChatMessage.model` was
sourced from `message.complete`'s own payload, but the real gateway never sends one there.
Checked directly: `_complete_turn_payload` (`tui_gateway/prompt_turn.py:622-648`) builds
`{"text": raw, "usage": _get_usage(agent), "status": status}` plus a few optional keys
(`reasoning`, `warning`, `response_previewed`, `billing`, `failure_reason`, `rendered`) — no
`model` key at any point. Fixed (`cc57b14`) by sourcing it from the session's own `model` field
(set by a prior `session.info`) at the moment `message.complete` lands instead. Device-verified
post-fix, both themes (light: screenshots in `m15-r7/38-coderA-light-withstats.png`; dark:
`m15-r7/43-darkset.png` sets Dark under Settings › Appearance, `45-coderA-dark-withstats.png`): a
new message in session A shows `mimo-v2.5 · Σ 12.2k tok · 6.7 tok/s` beneath it (model reads
`mimo-v2.5` here rather than the just-picked `claude-sonnet-5` because of the staleness bug
above — `session.model` was itself stale at send time on that particular run). A message from
before the feature existed in the same session ("Hi there, friend!", seeded in task 0) shows no
stats line in both themes (`37-coderA-light-nostats.png`, `41/44-coderA-dark-nostats*.png`) — the
backend doesn't persist `usage`/`model` onto a stored message row, so a rehydrated message
correctly has neither, matching the exit criterion's "a transcript row from before the feature
shows none." One more finding, also not a task-2 bug: an app restart clears the stats line even
off a message that DID show one before the restart (`hi again` had `Σ 16k tok · 2.8 tok/s`
in `38-coderA-light-withstats.png`, then showed nothing at all post-restart in
`44-coderA-dark-nostats2.png`) — the same non-persistence, working as designed, just surfaced
by this round's restart-heavy test flow rather than a real second bug.

**Task 3 (`npm run check`):** exit 0 — `tsc -p . --noEmit` clean, vitest 614/614 (67 files),
`test:plugin` 52/52, `eslint .` clean, `prettier --check .` clean. Run at `cc57b14`.

**One commit-hygiene slip, reported per the round's own honesty rule:** `src/lib/strings.mobile.ts`'s
`MODEL_CHIP_*`/`EFFORT_CHIP_*` string additions were added in one edit pass before task 2's
commit and landed in `d01dded` (task 2) rather than `0f453de` (task 1), where they belong. Not
corrected via git history surgery (rebase/amend) per the standing rule against it; left as a
minor process note rather than silently ignored.

### Round 8 — vendored hand-edit undone, stale model/effort fixed and device-verified, jump-to-latest / refresh / copy-edit built and device-verified (2026-09-16)

**Environment note, not a task finding:** this round's emulator (`hermes-test` AVD) and its
Metro instance both had to be rebuilt from scratch — the AVD's `emulator` binary wasn't on this
machine under the SDK root prior rounds used (`C:\Program Files (x86)\Android\android-sdk`); it
was found under a second, complete SDK install at `D:\Software\Android-SDK` instead. Separately,
running Metro in `CI=1` (per this round's own instruction) turned out to disable more than
client auto-reload: **Metro's own transform cache is not invalidated by a source edit while
running in CI mode**, so a force-stop + cold relaunch of the app — normally enough to pick up
new JS — kept serving stale bundles for every code change made after Metro's own process
started. Discovered only after task 2's on-device pill showed no visible text/icon and a
`console.log` trace never appeared in Metro's own log despite firing on every scroll event in
the running (stale) bundle. Fixed by killing and restarting Metro with `--clear` (confirmed by
its own "Bundler cache is empty, rebuilding" line and a genuinely full module count, e.g. `8828
modules`, not the `(1 module)` deltas a cache hit produces) after every source edit intended for
device testing, for the rest of the round. Noted here because it cost real time and will recur
for any future CI=1 round unless Metro is restarted (not just the app) after each edit.

**Task 0 (vendored hand-edit): met.** `d01dded`/`cc57b14`'s hand-added `model?`/`usage?` on
`ChatMessage` (`src/upstream/lib/chat-messages/types.ts`) removed; both fields now live on a
local `ChatMessageWithExtras` type (`src/chat/message-extras.ts`, new file) that
`message-stream.ts`'s `completeAssistantMessage`/`completeMessage`/`newAssistantFromCompletion`
and `ResponseStats.tsx` use instead — both are optional fields, so a plain `ChatMessage` already
satisfies the wider type with no cast needed anywhere else in the codebase (confirmed:
`session-stream/types.ts`'s `SessionState.messages: ChatMessage[]` needed no change).
`message-usage-stamping.test.ts` updated to import and type against
`ChatMessageWithExtras` (its `lastAssistantMessage` helper was reading `.model`/`.usage` off a
bare `ChatMessage`). Proved byte-for-byte: `node scripts/sync-upstream.mjs` then `git status`/
`git diff --stat src/upstream/` showed only the restorative deletion (16 lines removed, nothing
added) against the last-committed vendored file — i.e. a fresh sync now reproduces
`src/upstream/` with zero diff. `npm run check`: exit 0 (627 tests). Commit `4144da5`.

**Task 1 (stale model/effort after restart): met, root-caused and device-verified.** Root cause
confirmed at `src/gateway/session-connection.ts`'s old `resumeSession`/`createSession`
(pre-fix): both only ever seeded `messages`, `title` and pending requests from the RPC
response — never the `model`/`provider`/`reasoning_effort` the response's own `info` field
(`SessionRuntimeInfo`) carries. Those only ever reached `SessionState` via a live `session.info`
WebSocket event (`session-info.ts`'s `handleSessionInfoEvent`), which does not re-fire for a
session that was already running before this client (re)connected — exactly round 7's
observation. Mirrors the desktop's own `applyRuntimeInfo` call on this same response field
(`apps/desktop/src/app/session/hooks/use-session-actions/index.ts:1759`). Fix: exported
`session-info.ts`'s existing `sessionInfoStatePatch`/`applySessionInfoStatePatch` (unchanged —
`SessionRuntimeInfo` has the same field names/types the live event payload does, so the same
no-op-if-unchanged patch logic applies with no cast) and apply them to `response.info` in both
`resumeSession` and `createSession`, via a new `seedSessionInfo` helper next to the existing
`seedSessionMessages`/`seedSessionTitle`. Four new unit tests in `session-connection.test.ts`
against a fake gateway (model/provider/effort applied from resume; overwrites a stale value from
a prior open; a resume with no `info` at all applies nothing; create applies `info` too).
Device-verified on the hermes-test AVD, throwaway gateway on port 9138 (`setup-gw-r8.sh`, same
shape as `setup-gw-r7.sh`): created session A, set `deepseek-v4-flash`/`low` from the chips;
session B, `mimo-v2.5`/`medium`. A Node script over the RPC (`session.resume`, not `GET
/api/sessions` — `rpc-check.mjs`, password-login → `/api/auth/ws-ticket` → the `hermes-gateway-
v1`/`hermes-gateway-ticket.<ticket>` WS subprotocol) read both sessions' `info` before the
restart:
```
A: {"model":"deepseek-v4-flash","provider":"opencode-go","reasoning_effort":"low", ...}
B: {"model":"mimo-v2.5","provider":"opencode-go","reasoning_effort":"medium", ...}
```
Force-stopped the app, cold-launched, reopened both from the session list. Header/chips on-device
showed `deepseek-v4-flash · low` for A and `mimo-v2.5 · medium` for B — not the config-default
`mimo-v2.5`/Off a stale hydrate would have shown. The same RPC script read both sessions again
after the relaunch: identical `info` to the pre-restart snapshot, and `config.yaml`'s
`model.default` unchanged (`mimo-v2.5`/`opencode-go`) throughout. Commit `85f0e76`.

**Task 2 (jump-to-latest): met, device-verified.** Counting logic in `src/chat/latest-pill.ts`
(new file, pure, unit-tested — 8 tests): tracks settled (`role === 'assistant' && !pending &&
!hidden`) message ids already seen, so a re-render never double-counts one turn, and resets
whenever the reader is back at the tail. Wired into `Transcript.tsx` via `FlashList`'s
`onScroll` (`AT_TAIL_OFFSET_PX = 24`, an allowance for overscroll/sub-pixel reporting, not an
exact 0) and a `Pressable` pill (`ChevronDown` + `latestPillLabel`, new string in
`strings.mobile.ts`) positioned `absolute` above the composer. Existing streaming auto-follow
(`maintainVisibleContentPosition`'s own threshold) is untouched. Device-verified on session D
(`hermes-test` AVD, gateway 9138): scrolled away from the tail mid-conversation, sent two
further turns while away — the pill appeared reading "Latest · 1" after the first settled, then
"Latest · 2" after the second, with the transcript never auto-scrolling back down while away
(confirmed both by screenshot and by the `isAtTail`/`onScroll` trace logged temporarily for this
check, then removed before commit). Tapped the pill: scrolled to the tail and the count cleared
to 0 in the same trace. Screenshots: `128-pill-visible.png` ("Latest · 1"), `129-pill-count2.png`
("Latest · 2"), `130-after-pill-tap.png` (cleared, at tail). Commit `7621f77`.

**Task 3 (refresh conversation): met, device-verified on both a plain and a bot chat.**
`SessionHeader.tsx` gained a "More" overflow button (`MoreVertical`, both the plain-chat/Compress
layout and the bot-chat/Settings layout) opening a `Menu` with one item, "Refresh conversation"
(`SESSION_HEADER_REFRESH_LABEL`), calling a new `onRefresh` prop. The screen
(`app/(main)/sessions/[id].tsx`) owns the actual call — a new `refreshConversation` callback
that calls `resumeSession(id, title, botId)`, the same `botId` `openSession` already threads
through per M15 Deviation 5 — reporting failure as a toast
(`SESSION_HEADER_REFRESH_FAILED_TITLE`) rather than replacing the screen with the boot-failure
card `openSession`'s own error path renders, since a quiet manual re-sync shouldn't blank out a
transcript already on screen. Device-verified with a temporary trace (removed before commit): on
the plain chat "Count from 1 to 40 with comments", Refresh conversation called `resumeSession`
with `botId=(none)`; on the `coder` bot chat, the same action called it with `botId=coder`. Both
resolved with no visible disruption to the open transcript (screenshots
`137-overflow-open.png`/`138-after-refresh-tap.png` plain chat, `143-coder-chat.png`/
`144-coder-refreshed.png` bot chat). Commit `9da2693`.

**Task 4 (copy and edit-and-resend): met, device-verified.** Long-press any message bubble
(`Transcript.tsx`'s `MessageBubble`, new `Pressable` wrapper, `delayLongPress={350}`) opens a
`Menu` with "Copy" always present and "Edit message" added only for `message.role === 'user'` —
see Deviation 9 for why these collapse into one menu instead of the desktop's split hover/click
affordances. Copy uses React Native core's deprecated-but-still-linked `Clipboard.setString`
(no `expo-clipboard` dependency exists in this project yet, and adding one is a native module
that would need a fresh native build outside this round's scope — noted rather than silently
worked around). Edit calls a new one-shot signal, `requestComposePrefill`
(`src/store/compose-request.ts`, same "request counter" shape as the existing
`$scrollToBottomRequests`), which `Composer.tsx` applies via a new effect (`text` is owned as
local `useState`, not a live store subscription, so an external write needs a signal to apply
rather than a direct draft write) and focuses the input. Sending the prefilled text submits a
normal new turn — the original message is never rewritten, matching the task's own wording,
unlike the desktop's click-to-edit (interrupt + rewind). Device-verified on session D: long-
pressed the user message "Reply with just the digit 2. No tool use.", tapped Edit, composer
prefilled with that exact text, appended `-EDITEDNOW`, sent — a brand-new turn appeared at the
tail with its own reply, and the original "digit 2" turn and its original reply, still earlier
in the transcript, were untouched (`157-tail-after-edit.png` shows both side by side). Long-
pressed an assistant reply ("2"), tapped Copy — the Android keyboard's own clipboard-content
preview showed "2" immediately after
(`161-composer-longpress.png`), and the native text-selection popup on the composer field
offered "Paste" (`163-paste-menu2.png`, only shown by the OS when the clipboard is non-empty) —
both are OS-level confirmations the text reached the system clipboard, independent of this
app's own code. Commit `7c7da08`.

**Found, not part of this round's tasks, filed for follow-up rather than fixed here:** the
composer's Model and Reasoning-effort bottom sheets (`ModelChip.tsx`/`EffortChip.tsx`) have
list rows whose touch hit-regions are degenerate on this emulator — `adb shell uiautomator
dump` repeatedly showed a selected row's own clickable bounds collapsed to near-zero or inverted
height (e.g. `bounds="[42,1319][1038,1331]"`, 12px; `bounds="[42,2151][1038,2139]"`, inverted),
while the row's visible text rendered elsewhere on screen — a direct tap on the visible text
fell through to whatever real view sat underneath (the composer's own input/icons) instead of
selecting the row. Only keyboard-focus navigation (`KEYCODE_TAB`/`KEYCODE_DPAD_DOWN` then
`KEYCODE_ENTER`) reliably selected a row; this is how every model/effort change in this round's
device testing was actually made, not by tapping the visible label directly. Not one of this
round's five tasks, and not chased further here; flagged as a background task
(`task_7ad4c507`, title "Fix untappable rows in composer's Model/Reasoning-effort sheets") for
separate investigation — likely a FlashList row-measurement issue specific to these two sheets,
since the same rows worked fine via keyboard focus and other (non-virtualized) `Menu`-based
sheets in this same round (the jump-to-latest pill, the refresh/copy/edit menus) never showed
the bug.

**Task 5 (`npm run check`):** exit 0 — `tsc -p . --noEmit` clean, vitest 627/627 (68 files),
`test:plugin` 52/52, `eslint .` clean, `prettier --check .` clean. Run after `7c7da08`, the
round's last commit, with a clean working tree.

**Teardown (a-f, mirroring round 6/7's own pattern — round 7 itself did not write its teardown
up in this file, so this mirrors round 6's most recently fully-documented instance instead).**
Done, device-verified at each step:
- (a) Switched to Hone from Registered gateways ("Switch to Hone"), confirmed the card flipped to
  `Primary`/`Current` and M15-R8 lost `Current`. Removed `M15-R8` via the destructive-tap rule — a
  fresh `uiautomator dump` immediately before the tap, the confirm dialog's own text checked
  ("M15-R8" will be removed from this app...), only then `REMOVE` tapped; the list afterward
  showed only Hone (`Primary`, `Current`). A cold relaunch (force-stop + `am start`, reconnect
  to Metro's dev-launcher — required every relaunch this round, a dev-client property, not a
  bug) landed cleanly on the session list with Hone's real sessions ("Replace Hermes-ifrah with
  DeepSeek...", "[someuser] hi i would like...", etc.) — never `/connect`.
- (b) Metro (PID `4528`, `node.exe`) and the throwaway gateway (PID `2084`,
  `hermes-agent\.hermes-runtime\python\...\python.exe`, per `setup-gw-r8.sh`) stopped by PID —
  not `hermes serve --stop`, which is unscoped and would have hit every Hermes process on the
  machine. `curl --max-time 3` to both `http://127.0.0.1:8081/status` and
  `http://127.0.0.1:9138/api/health` returned nothing (exit 7, connection refused) afterward.
  Nothing else running this round to stop (no prototype servers).
- (c) Deleted: the scratch `HERMES_HOME` (`%TEMP%\hermes-m15r8-home`),
  `scratch-password.txt`, and the two `.bat` shims `hermes profile create` wrote to
  `~/.local/bin` (`coder.bat`, `researcher.bat`) — all confirmed gone by a follow-up `ls` failing
  on each path (`No such file or directory`). The field evidence directory itself
  (`%LOCALAPPDATA%\hermes-android-field\m15-r8\`, screenshots/dumps/logs) is left in place, per
  the round's own instruction to put evidence there.
- (d) `adb reverse --remove-all` wedged mid-teardown (the same class of hang round 6 hit,
  `adb reverse --remove-all hung past its timeout`) — per the standing rule, killed only the
  local `adb` server process (not the emulator), `adb start-server`, the device reconnected on
  its own after a few seconds (`emulator-5554 device`, a fresh `transport_id`), then
  `adb reverse --remove-all` + `adb reverse --list` completed cleanly (empty). `font_scale`
  confirmed `1.0` (never touched this round).
- (e) Emulator shut down via `adb emu kill` (`OK: killing emulator, bye bye`); `adb devices`
  empty immediately after. Two `emulator.exe` processes were still visible for a few seconds
  post-kill (shutdown-in-progress, not a stray, same as round 6's note) — a follow-up check ~8s
  later confirmed both gone. `emulator -list-avds` still lists `hermes-test` (the AVD itself was
  never deleted, only shut down). Only the local `adb` server daemon process remains, no device
  attached.
- (f) `git push`: `274d315` and the five preceding commits (`4144da5`..`7c7da08`) already pushed
  earlier in the round (`bdb4089..274d315  m15-bots-mobile-ux -> m15-bots-mobile-ux`); `git
  status` confirms a clean working tree and the branch up to date with `origin/m15-bots-mobile-ux`
  at teardown time.

### Opus review, group B partial (2026-09-16)

Opus checked rounds 7 and 8 against their commits, logs and host state, and re-ran `npm run check`
at `f9ff3be` (exit 0, 627 tests). `src/upstream/` is byte-identical to the group A close
(`4363d9e`), so round 7's hand-edit to the vendored file is fully undone (`4144da5`).

**Ticked:**
- **Tasks:** the models data layer (round 1), response stats (round 7), jump-to-latest,
  refresh conversation, and copy / edit-and-resend (all round 8).
- **Model and effort exit criterion.** Round 7 changed both from the chips. Round 8 then read
  `session.info` over RPC with a Node script: session A changed, session B unchanged, and
  `config.yaml`'s `model.default` unchanged, still true after a cold relaunch (`85f0e76`).
- **Jump-to-latest exit criterion** (round 8, task 2).
- **Response stats exit criterion.** Round 7 showed stats on a new message and none on a message
  from before the feature, in both themes.

**Not ticked:**
- **The composer chips task.** Round 8 reports reproducible touch-target defects in the model and
  effort sheets (degenerate FlashList row bounds). Those must reach 48 dp before the task counts
  as done.
- **Hold-to-dictate.** Not started. It needs a test plan first, because the emulator's dictation
  never produced real text in M11.

### Round 9 — chip sheets' touch targets root-caused and fixed, hold-to-dictate (2026-09-16)

**Task 1 (Model and effort sheets, 48 dp): met, root-caused and device-verified.**

*Root cause — not the rows, and not FlashList.* Round 8 filed this as "likely a FlashList
row-measurement issue specific to these two sheets". It is neither. Neither sheet contains a
`FlashList`: `ModelChip.tsx:133` uses a plain `ScrollView` (round 7's own fix) and
`EffortChip.tsx:86` renders a `Menu`, which is `Pressable` rows inside a `Sheet`
(`Menu.tsx:36-57`). The only `FlashList` in the app is the transcript's (`Transcript.tsx:269`),
which sits *behind* the sheet. The rows' own layout was never wrong either — `Menu.tsx:67-72`
and `ModelChip.tsx:179-185` both already set `minHeight: 48`.

The defect is in the `Sheet` primitive's root, `Sheet.tsx:77` (pre-fix):
`<View style={StyleSheet.absoluteFill}>`. `absoluteFill` fills *the caller's mount point*, not
the screen. Every sheet that worked is mounted at the top level of a full-screen container
(`app/(main)/bots/index.tsx:330`, `cron/index.tsx:239`, `settings/profiles.tsx:282`,
`projects/index.tsx:208`, `sessions/[id].tsx:195`), where those are the same thing. `ModelChip`
and `EffortChip` are mounted inside `Composer`'s `chipRow` (`Composer.tsx:477-484`), a 144 px
band — where they are not. Android draws children that overflow their parent (RN Views default
to `overflow: 'visible'`) but `ViewGroup.dispatchTouchEvent` does not dispatch touches to them,
and `AccessibilityNodeInfoDumper` intersects every node's bounds with its ancestors' visible
bounds. One cause, both of round 8's symptoms at once: the rows drew where you could see them,
the taps went to the composer underneath, and `uiautomator` reported collapsed or inverted
rectangles.

*Proved on device before the fix* (hermes-test AVD, 1080x2400 @ 420 dpi, so 1 dp = 2.625 px and
48 dp = 126 px), with the pre-fix `Sheet.tsx` deliberately checked back out. Every node of both
sheets is clipped to exactly `y` in `[1995, 2139]` — 144 px, which is `chipRow` exactly. Effort
sheet:

```
      [168,1995][912,1877] 744x-118px = 283.4x-45.0dp   TextView  'Reasoning effort'  <== DEGENERATE
CLICK [912,1995][1038,1909] 126x-86px = 48.0x-32.8dp    ViewGroup desc='Close'        <== DEGENERATE
CLICK [42,1995][1038,2067] 996x72px  = 379.4x27.4dp     ViewGroup desc='Off'          <== UNDER 48dp
CLICK [42,2067][1038,2139] 996x72px  = 379.4x27.4dp     ViewGroup desc='Minimal'      <== UNDER 48dp
CLICK [42,2193][1038,2139] 996x-54px = 379.4x-20.6dp    ViewGroup desc='Low'          <== DEGENERATE
CLICK [42,2319][1038,2139] 996x-180px= 379.4x-68.6dp    ViewGroup desc='Medium'       <== DEGENERATE
```

Model sheet, same run, same clip band — the rows are gone from the dump entirely because their
clipped rectangle is empty, leaving only the title, the close button and the search field:

```
      [168,1995][912,1877] 744x-118px = 283.4x-45.0dp   TextView  'Model'             <== DEGENERATE
CLICK [912,1995][1038,1909] 126x-86px = 48.0x-32.8dp    ViewGroup desc='Close'        <== DEGENERATE
CLICK [42,1995][1038,2067] 996x72px  = 379.4x27.4dp     EditText  'Search models…'    <== UNDER 48dp
```

Note the unclipped pitch is already visible in the first block: Low at 2193, Medium at 2319 —
126 px apart, i.e. the rows were always 48 dp. And the composer's own controls stay listed as
clickable *over* the sheet in the same dump (`[21,2012][385,2138] desc='Model'`), which is
exactly why round 8 saw taps "fall through to the composer's own input/icons".

*Fix* (`019a36b`, `src/components/ui/Sheet.tsx`): host the whole sheet in a react-native `Modal`
(`transparent`, `statusBarTranslucent`, `animationType="none"` so the existing `Animated`
transition still owns the motion). A Modal gets its own full-screen window, so touch dispatch,
`uiautomator`'s reported bounds, and the body's percentage `maxHeight` all resolve against the
display rather than the caller's mount point. Two knock-ons, both deliberate: `onRequestClose`
gives every sheet Android back-dismissal, which the plain-View version never had (pre-fix, Back
popped the whole chat screen instead — observed this round); and `mounted` (a ref) had to become
`rendered` (state), because a modal left mounted after closing swallows every touch on the screen
behind it, so it must stop rendering once the close animation settles, and only state re-renders.

*Dumps after the fix.* Effort sheet, **light**, every clickable node — all eight rows exactly
126 px = 48.0 dp, nothing degenerate:

```
CLICK [912,1141][1038,1267] 126x126px = 48.0x48.0dp  centre=(975,1204)  ViewGroup desc='Close'
CLICK [42,1299][1038,1425]  996x126px = 379.4x48.0dp centre=(540,1362)  ViewGroup desc='Off'
CLICK [42,1425][1038,1551]  996x126px = 379.4x48.0dp centre=(540,1488)  ViewGroup desc='Minimal'
CLICK [42,1551][1038,1677]  996x126px = 379.4x48.0dp centre=(540,1614)  ViewGroup desc='Low'
CLICK [42,1677][1038,1803]  996x126px = 379.4x48.0dp centre=(540,1740)  ViewGroup desc='Medium'
CLICK [42,1803][1038,1929]  996x126px = 379.4x48.0dp centre=(540,1866)  ViewGroup desc='High'
CLICK [42,1929][1038,2055]  996x126px = 379.4x48.0dp centre=(540,1992)  ViewGroup desc='Extra High'
CLICK [42,2055][1038,2181]  996x126px = 379.4x48.0dp centre=(540,2118)  ViewGroup desc='Max'
CLICK [42,2181][1038,2307]  996x126px = 379.4x48.0dp centre=(540,2244)  ViewGroup desc='Ultra'
```

Effort sheet, **dark** (`adb shell cmd uimode night yes`) — identical geometry; only the palette
changes (`21-effort-sheet-dark.png` shows the dark surface with `Low` in primary):

```
CLICK [912,1141][1038,1267] 126x126px = 48.0x48.0dp  centre=(975,1204)  ViewGroup desc='Close'
CLICK [42,1299][1038,1425]  996x126px = 379.4x48.0dp centre=(540,1362)  ViewGroup desc='Off'
CLICK [42,1425][1038,1551]  996x126px = 379.4x48.0dp centre=(540,1488)  ViewGroup desc='Minimal'
CLICK [42,1551][1038,1677]  996x126px = 379.4x48.0dp centre=(540,1614)  ViewGroup desc='Low'
CLICK [42,1677][1038,1803]  996x126px = 379.4x48.0dp centre=(540,1740)  ViewGroup desc='Medium'
CLICK [42,1803][1038,1929]  996x126px = 379.4x48.0dp centre=(540,1866)  ViewGroup desc='High'
CLICK [42,1929][1038,2055]  996x126px = 379.4x48.0dp centre=(540,1992)  ViewGroup desc='Extra High'
CLICK [42,2055][1038,2181]  996x126px = 379.4x48.0dp centre=(540,2118)  ViewGroup desc='Max'
CLICK [42,2181][1038,2307]  996x126px = 379.4x48.0dp centre=(540,2244)  ViewGroup desc='Ultra'
```

Model sheet, **light**, every clickable node (filtered to `deepseek` so the interesting rows are
adjacent) — rows are 152-153 px = 57.9-58.3 dp, taller than 48 dp because each carries a model
line plus a provider line:

```
CLICK [912,1093][1038,1219] 126x126px = 48.0x48.0dp  centre=(975,1156)  ViewGroup desc='Close'
CLICK [42,1251][1038,1383]  996x132px = 379.4x50.3dp centre=(540,1317)  EditText  'Search models…'
CLICK [42,1466][1038,1619]  996x153px = 379.4x58.3dp centre=(540,1542)  ViewGroup desc='deepseek-v4-flash, opencode-go'
CLICK [42,1618][1038,1770]  996x152px = 379.4x57.9dp centre=(540,1694)  ViewGroup desc='deepseek-v4-pro, opencode-go'
CLICK [42,1771][1038,1923]  996x152px = 379.4x57.9dp centre=(540,1847)  ViewGroup desc='deepseek-flash, opencode-go'
CLICK [42,1923][1038,2075]  996x152px = 379.4x57.9dp centre=(540,1999)  ViewGroup desc='deepseek-v4.1-flash, opencode-go'
CLICK [42,2075][1038,2228]  996x153px = 379.4x58.3dp centre=(540,2151)  ViewGroup desc='deepseek-v4-flash-vision-exp, opencode-go'
CLICK [42,2227][1038,2306]  996x79px  = 379.4x30.1dp centre=(540,2266)  ViewGroup desc='deepseek-v4-flash-free, opencode-free'
```

Model sheet, **dark** — identical geometry to the light dump above, same eight nodes
(`20-model-sheet-dark.xml` / `20-model-sheet-dark.png`).

One honest caveat on that last model row: 30.1 dp. That is the list's own scroll viewport
(`ModelChip.tsx:176-178`, `listOuter: { height: 320 }` → 840 px, here `y` in `[1466, 2306]`)
cutting the row that is half-scrolled off its bottom edge. Scrolling it into view measures it at
57.9 dp, and scrolling *past* it inverts the rows now off the top — normal behaviour for any
scrolling list, the same way the session list's bottom row measures 38.5 dp against the screen
edge. It is categorically different from the pre-fix state, where the clip band was 144 px total
and *no* row was ever fully hittable. Not fixed further: the fixed 320 dp list height is not a
multiple of the 58 dp row pitch, so the last visible row is always part-cut; that is cosmetic and
was not part of this task.

*Selection by tapping, read back off the gateway.* Both taps used a fresh `uiautomator dump`
immediately before, and the node's own dumped centre. The session was
`20260916_145310_0997eb`; `session.info` was read over the RPC (`rpc-check.mjs` — password login
to `/auth/password-login` per `plugins/dashboard_auth/basic/__init__.py:123`, then
`/api/auth/ws-ticket`, then `/api/ws` with the `hermes-gateway-v1` /
`hermes-gateway-ticket.<ticket>` subprotocols, `src/gateway/dial.ts:29,56`).

Before either tap:

```
{"model":"mimo-v2.5","provider":"opencode-go","reasoning_effort":"","title":"Greeting","stored_session_id":"20260916_145310_0997eb"}
```

Tapped the model row `desc='deepseek-v4-flash, opencode-go'` at its dumped centre `(540,1542)` —
deliberately the hardest case available, with `deepseek-v4-pro`, `deepseek-flash`,
`deepseek-v4.1-flash` and `deepseek-v4-flash-vision-exp` as immediate neighbours. On the wire
(see task 4 for the trace proxy):

```
09:56:50.454 C->S {"jsonrpc":"2.0","id":"r4","method":"config.set","params":{"key":"model","session_id":"62cf4542","value":"deepseek-v4-flash --provider opencode-go --session"}}
```

Tapped the effort row `desc='Low'` at its dumped centre `(540,1614)`, between `Minimal` and
`Medium`:

```
09:58:07.716 C->S {"jsonrpc":"2.0","id":"r5","method":"config.set","params":{"key":"reasoning","session_id":"62cf4542","value":"low"}}
```

`session.info` after both:

```
{"model":"deepseek-v4-flash","provider":"opencode-go","reasoning_effort":"low","title":"Greeting","stored_session_id":"20260916_145310_0997eb"}
```

Both taps hit the intended row, not a neighbour. The header re-rendered to
`opencode-go · deepseek-v4-flash · low`.

*Regression check on the shared primitive.* The `Modal` change touches every sheet in the app, so
one screen-level sheet was re-checked on device: the chat header's overflow `Menu`
(`SessionHeader.tsx:229`) still opens, measures `996x126px = 379.4x48.0dp`, and its "Refresh
conversation" item still fires —
`10:04:26.318 C->S {"jsonrpc":"2.0","id":"r6","method":"session.resume","params":{"session_id":"20260916_145310_0997eb"}}` —
with the transcript intact.

**Task 2 (hold-to-dictate test plan), written before any code.**

*(a) What the dictation path actually is.* Gateway STT over REST, not on-device recognition and
not the `voice.*` RPCs. The chain is: the mic button (`Composer.tsx:504-518`) → `toggleRecording`
(`Composer.tsx:366-413`) → `startRecording` / `stopRecordingAndTranscribe`
(`src/voice/recorder.ts`, `expo-audio` capturing m4a) → `transcribeAudio` (`src/voice/api.ts:66`)
→ `POST /api/audio/transcribe` with a `data:audio/m4a;base64,…` payload → the host's local
Whisper, upstream `hermes_cli/web_routers/audio.py`. There is no on-device recognizer and no
`voice.*` call site anywhere in `src/` (grepped; the only hit is a comment in
`src/api/system.ts:23`). AGENTS.md is explicit about why: "`voice.*`/`wake.*` RPCs … drive the
*server's* mic and speaker. Mobile voice goes through `/api/audio/*` with on-device capture."

*Why M11's emulator text was empty* (M11-push-and-voice.md:384-395): the emulator's virtual
microphone has no scriptable way to inject speech — no `adb emu` mic command, and
`emulator -help-audio` offers only a backend choice, no WAV-input flag — so what `expo-audio`
records is silence. The host's Whisper "base" model answers silence with an empty transcript
rather than an error, which is `audio.py`'s own documented behaviour ("no speech detected …
returns an empty transcript"), and `Composer.tsx`'s `if (transcript)` guard then correctly
inserts nothing. So the failure is *upstream of the app*: the capture, encode, upload and
empty-result paths were all proven live in M11; only the audio content was missing.

*(b) The two options, evaluated.*

**Option 1 — the emulator's host-audio microphone with a played sample.** It would prove the one
thing nothing else can: that real audio in produces real text out, end to end (expo-audio →
m4a → base64 → POST → Whisper → transcript). It proves nothing at all about this task's actual
subject — the hold threshold, the auto-send decision, or the escape — because those sit
downstream of a transcript and behave the same whatever produced it. It is also not achievable
here: routing audio into the guest means feeding the *host's* default recording device, and this
machine has no microphone and no virtual loopback device to play a WAV into; installing an audio
driver (VB-Cable or equivalent) is out of scope for this round. Even with one, the sample would
have to be played inside the 2.5 s hold window, which is timing-fragile for a scripted run. This
is precisely the gap M11 already looked at and left open.

**Option 2 — a `__DEV__`-only transcript-source seam.** Keep `startRecording` and the real
recorder stop untouched — permission, native capture and stop all still run for real — and
substitute only the value that `transcribeAudio` would have returned, so fixed text arrives at
exactly the callback point a real transcript would. It proves everything this task adds: that a
tap fills the composer and sends nothing; that a ≥2.5 s hold auto-sends on release and puts
`prompt.submit` on the wire with exactly that text; that "Edit before sending" cancels the
auto-send and leaves the text editable; and that a cancel sends nothing. It does not prove real
recognition — mic capture content, encoding, upload and Whisper are all bypassed by construction.
It must be `__DEV__`-gated so it cannot reach a shipped build.

**Option 3 — both.** Strictly the best coverage, and the right answer if option 1 were available.
Here it collapses to option 2, because option 1 cannot be run on this machine.

*Chosen: option 2, with the result labelled for what it is.* The two halves are genuinely
separable, and M11 already closed the other one as far as this environment allows: M11's
2026-09-09 device pass proved permission, native recording, upload and the empty-transcript guard
live. So the seam covers the logic M15 actually adds, M11 covers the mechanism, and the one thing
neither covers — a real spoken word coming back as text — stays M11's open `[physical]`-class
item. Task 4's result is therefore labelled "wire path verified with the dev seam; real-speech
recognition remains M11's [physical] item", per this round's own instruction.
