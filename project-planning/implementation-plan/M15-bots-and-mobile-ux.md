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
