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
- [x] Composer trailing controls: a model chip and an effort chip. Model chip opens a searchable
      sheet of available models; effort chip opens a five-option sheet (none, low, medium, high,
      xhigh, labelled Off … XHigh). Both change the current session only and reflect in the next
      `session.info`.
- [x] Response stats line under a settled assistant message: model, total tokens, tokens per
      second, shown only when the server provided `usage` for that message; older rows stay bare.
- [x] Jump-to-latest: while the reader is scrolled away from the tail, a pill shows "Latest" with
      the count of assistant messages that arrived since; streaming auto-follow only when within
      one viewport of the tail. Tapping the pill scrolls to the tail and clears the count.
- [x] Hold-to-dictate: tap the mic to dictate into the composer (M11's path, unchanged); hold
      the mic for 2.5 s to dictate and auto-send on release, with a visible "Auto-send" state and
      an "Edit before sending" escape while the transcript is still editable. Haptic on the
      threshold.
- [x] Refresh conversation action in the header overflow (re-runs `session.resume` hydration),
      for the case the user does not trust the live view.
- [x] Edit-and-resend on a user message (long-press → Edit → composer prefilled; sending
      creates a new turn, the old one is not rewritten), and Copy on any message.

### C. Tasks tab (†data layer)

- [x] † `src/api/cron.ts` gains templates (from the desktop's cron templates source) and the
      delivery target field.
- [x] `app/(main)/tasks/index.tsx` replaces the cron screen's framing: rows show name, schedule
      in words, next run, last run, a "Running now" state; detail screen with the prompt, model,
      deliver-to, schedule; "New task" sheet with name, prompt, schedule (cron expression or the
      template's preset, with the placeholder `0 9 * * *` and a plain-language echo of what it
      means), deliver-to, and a template picker. Edit prompt in place.

### D. Pairing and connection health

- [x] Connect flow gains a "Pair over Tailscale (recommended)" path: three steps (join the same
      tailnet; run a reachable, authenticated gateway; enter the host's tailnet URL), a hard
      rejection of `127.0.0.1`, `localhost` and `10.0.2.2` with the reason ("that address is this
      phone, not your computer"), then the existing detection and login. A "This computer"
      section links the host-side docs.
- [x] `docs/CONNECTING.md` gains the host-side recipe: keep `hermes serve` running after login
      on Windows (Task Scheduler), macOS (LaunchAgent) and Linux (systemd user unit), bound so
      the gate engages (D13.3), with the tailnet hostname. Scripts under `scripts/host/` are
      optional; the doc is the deliverable.
- [x] "Connection needs attention" banner: one persistent banner state when the gateway is
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
- [x] Hold-to-dictate: a 2.5 s hold auto-sends the transcript on release (a prompt lands on the
      wire with that text); a tap only fills the composer.
- [x] Response stats appear only on messages that carry server `usage`; a transcript row from
      before the feature shows none.
- [x] Tasks: creating a task from a template posts the expected cron payload; the list shows
      next and last run; triggering it shows "Running now" and then updates last run.
- [x] Pairing: entering `127.0.0.1` or `10.0.2.2` in the Tailscale step is rejected with the
      reason; a tailnet-shaped URL proceeds to detection.
- [x] Banner: killing the host produces the banner with "unreachable"; a 401 produces it with
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

10. **The chip sheets' untappable rows were a `Sheet` primitive bug, not a FlashList bug — and
    the fix changes every sheet in the app.** Round 8 filed this as "likely a FlashList
    row-measurement issue specific to these two sheets". Neither sheet contains a `FlashList`
    (`ModelChip.tsx:133` is a `ScrollView`, `EffortChip.tsx:86` is a `Menu` of `Pressable` rows),
    and both already set `minHeight: 48` on their rows. The defect was `Sheet.tsx`'s
    `StyleSheet.absoluteFill` root, which fills the caller's mount point rather than the screen —
    fine for the eight sheets mounted at a screen's top level, wrong for the two mounted inside
    `Composer`'s 144 px `chipRow`. So the fix is in the shared primitive: every `Sheet` in the app
    now renders inside a react-native `Modal`. That is a wider blast radius than a two-file fix
    would have been, and it is the right one — the bug is in the primitive, and a caller-side
    workaround would have left the next caller to rediscover it. Two behaviour changes come with
    it, both improvements and both deliberate: Android Back now dismisses a sheet instead of
    popping the whole screen behind it (`onRequestClose`), and a closed sheet now genuinely
    unmounts (`mounted` ref → `rendered` state), which it had to, because a transparent modal left
    up would swallow every touch on the screen behind it. One screen-level sheet was re-verified
    on device against this change (round 9's verification log, task 1).

11. **Hold-to-dictate keeps M11's tap as a toggle rather than making the whole gesture
    press-and-hold.** The obvious implementation of "hold the mic" is `onPressIn` starts
    recording and `onPressOut` stops it — but M15 task B also says the tap path is "M11's path,
    unchanged", and M11's path is a toggle (tap to start, tap again to stop and transcribe). A
    pure press-and-hold would have turned a tap into a ~100 ms recording. So the release
    *decides*: under the threshold it hands back to M11's toggle untouched, and only a hold past
    `HOLD_AUTO_SEND_MS` stops the recorder and arms the send. Both gestures live on one button
    with no long-press/short-press ambiguity, because the two outcomes are distinguished by the
    hold duration the task already specifies.

12. **The auto-send fires after a 1.5 s grace window, not instantly on release.** M15 task B asks
    for "an 'Edit before sending' escape while the transcript is still editable", and an escape
    is only meaningful if there is an interval to take it in: send-on-release-immediately leaves
    nowhere for it to live. So releasing an armed hold puts the transcript in the composer,
    shows the escape, and submits `AUTO_SEND_GRACE_MS` later. The exit criterion ("a 2.5 s hold
    auto-sends the transcript on release") is still met — the release is what commits the send;
    the window only makes it revocable. Unlike the 2.5 s, this 1.5 s is **not** one of D16.3's
    three tunings restated from observation: it is this project's own choice, and the constant
    says so rather than implying a provenance it does not have.

13. **`app/dev/` is gated by a layout redirect, not by excluding the routes from the build.**
    M15 round 10 task 1 asked for a `__DEV__` gate on `app/dev/primitives.tsx` and
    `app/dev/dictation-seam.tsx`, which expo-router otherwise registers — and therefore exposes by
    deep link — in every build. The alternative would have been to keep the files out of a release
    bundle entirely (a Metro `blockList`, or moving them outside `app/`), which is a stronger
    guarantee: a redirect still ships the screen's code. It was not taken, for two reasons. Moving
    them out of `app/` costs them their routes, and a dev story screen you cannot open by URL is
    most of the way to useless; and a bundler-level exclusion is invisible at the call site, where
    the next person adding an `app/dev/` screen will not see it. The layout is where a reader
    looks. The redirect is also the second lock rather than the only one — round 9 had already put
    the transcript seam's own guard in `src/voice/dev-transcript-seam.ts` rather than at its
    caller, precisely so no route could switch it on — and that guard is now the shared
    `src/lib/dev-build.ts` both use. Recorded because "dev routes are gated" is weaker than "dev
    routes are absent", and the difference should not have to be rediscovered from the code.

14. **~~The Tasks tab draws no tab strip.~~ Built round 15 — see Deviation 20.**
    `docs/mobile-prototypes/tasks.html:102-106` puts a Bots · Sessions · Tasks tab row under the
    header on every view. That row is M15 E's work — the prototype's own behaviour note says
    "Swiping between the three tabs works (M15 E)" (`:50`) — and no shared tab-strip component
    existed yet at the time this was written. `app/(main)/tasks/index.tsx` was therefore reached
    from the drawer like every other list screen, and drew no strip at all rather than a dead one
    that doesn't switch tabs. The counters, rows, detail and New task sheet were all as drawn;
    unchanged by round 15's fix.

15. **The cron humanizer is a port of the desktop's, not a new one — and it drops
    `toLocaleString`.** M15 round 11's task asked for "a small pure one" *if* no vendored or
    desktop humanizer existed. One does (`apps/desktop/src/app/cron/index.tsx:151-264` over
    `SCHEDULE_OPTIONS:101-109`), so `src/lib/cron-schedule.ts` ports it — same branch order, same
    predicates, same en.ts strings. Two functions deliberately differ:
    `formatCronTime` (desktop `:161-173`) and `formatRunTimestamp`
    (`src/lib/task-format.ts`, desktop `formatTime` `:266-278`) end in
    `toLocaleTimeString`/`toLocaleString` upstream, which on Electron is Chromium's full ICU.
    Here that would make a sentence describing a *locale-free* cron expression render differently
    per device and per Hermes-engine Intl build, and would make the unit tests assert whatever
    locale the machine running them happened to be set to. Both format directly instead, in the
    shape the prototype draws (`tasks.html:130-131`, "Every day at 9:00 AM", "Next Sep 13, 2026,
    9:00 AM · last today 9:00 AM"). The guard order of both originals is preserved, including
    the desktop's non-integer fallback to a raw `hour:minute` pair.

16. **"New task", not the vendored "New cron".** `src/upstream/i18n/en.ts` has
    `cron.newCron` ('New cron') and `cron.createTitle` ('New cron job'); D15.4 normally makes the
    vendored wording win. Both name the *desktop's* noun, and the whole point of M15 C is the
    re-framing of that screen as the Tasks tab — `tasks.html` says "task" throughout (`:33`,
    `:95`, `:99`, `:343-345`). The header action, the sheet title and the empty state therefore
    follow the screen's noun. Everything else on these screens uses the vendored strings
    directly, including `cron.title`, `cron.states.*`, `cron.emptyTitleNew`, `cron.emptyDescNew`,
    `cron.promptLabel`, `cron.deliverLabel`, `cron.modelLabel`, `cron.triggerNow`,
    `cron.pauseTitle`, `cron.resumeTitle`, `cron.deleteTitle`, the `deleteDesc` pair,
    `cron.createAction`, `cron.scheduleLabels.*`, `cron.scheduleHints.*` and the whole humanizer
    vocabulary.

17. **The old `/(main)/cron` routes became redirects, not deletions.** M15 C replaces that
    screen, and the drawer no longer points at it. Deleting the two route files would have made
    `hermes-android://(main)/cron` and `.../cron/<id>` dead. Both are now bare `<Redirect>`s —
    the detail one forwards its `id` — and both are listed in `route-replicates.test.ts`'s
    `NOT_A_SCREEN`, the same explicit mechanism `app/index.tsx` and `app/session/[id].tsx`
    already use for shims with no rendered UI of their own.

18. **The URL guard rejects `10.0.2.2` on the Tailscale path only.** M15 D's brief says
    "hard-reject 127.0.0.1, localhost and 10.0.2.2". The first two are rejected on both entry
    paths; `10.0.2.2` is not. `docs/mobile-prototypes/connect.html`'s Behaviour block draws the
    line itself: it "is rejected the same way (M15 exit criterion)" on the Tailscale path, but
    "on the 'Enter a URL' path it is allowed, because on an emulator it IS the computer" — and
    that path's own `:start` card offers "a LAN address, a reverse proxy, or **an emulator
    host**" as valid answers, so rejecting it there would contradict the screen's own
    description. The exit criterion is exercised on the Tailscale path, where both addresses are
    rejected. `src/net/gateway-url-guard.ts` takes the path as a `mode` parameter rather than
    inferring it.

19. **The in-app setup checklist is not the prototype's three lines.** connect.html `:steps`
    ends its pasteable checklist with `hermes auth add password --user tester`. That command does
    not exist: `hermes auth add <provider>` is "Add a pooled credential"
    (`hermes_cli/_parser.py:73`) and configures **model-provider** API keys, not the dashboard
    auth gate. The checklist and `docs/CONNECTING.md` both use the mechanism that does exist —
    the basic-auth plugin's env vars (`plugins/dashboard_auth/basic/__init__.py:220-222`) plus
    the signing secret at `:191-202`, which the prototype does not mention at all and without
    which every gateway restart signs every paired phone out.

20. **The tab row switches tabs with `router.replace`, not a co-mounted pager, and the swipe
    lives on the 48dp strip, not the screen body.** M15 round 15 (group E task 3) found the
    premise had drifted further than Deviation 14 said: not only was no tab strip drawn, but
    Bots/Sessions/Tasks were reached only through `AppDrawer.tsx:96`'s `router.push` — a new
    stack entry every time — while `sessions.html:20` and `bots.html:47` both describe "real tabs
    that switch in place", explicitly contrasted with the desktop prototype's own push-based
    tabs ("theirs push a screen and swap the strip"). Two implementation choices, both departures
    from the most literal reading, both recorded here rather than discovered later:
    - **`router.replace`, not a `react-native-pager-view` co-mounting all three screens.** A true
      pager would keep Bots, Sessions and Tasks mounted together so a drag tracks the finger
      continuously — the fuller reading of "switch in place" — but it is a materially larger
      change: a new native dependency, three screens' worth of data-loading (`useFocusEffect`,
      live subscriptions) now needing to coexist mounted rather than mount-on-navigate, and a
      routing restructure this round's time did not cover carrying through safely. `router.replace`
      gets the property that actually matters for the exit criterion — the tab row switches
      without growing the stack — proven live: from Tasks (reached via two `replace` calls,
      Sessions → Bots → Tasks), an edge-swipe-back exited the app straight to the launcher
      instead of returning to Bots, meaning neither earlier tab was still on the stack to pop to.
    - **The swipe gesture is scoped to `TabStrip`'s own 48dp row, not the screen body below it.**
      Round 10 found no adb-injected gesture (`input swipe`, `draganddrop`, a hand-built
      motionevent DOWN/MOVE/UP) reaches a JS `PanResponder`; round 15 re-confirmed this for
      `Sheet.tsx`'s existing drag (see the Verification log) and found the same true of a
      `react-native-gesture-handler` `Gesture.Pan()` mounted *inside `Sheet`'s `Modal`* — three
      injection methods, zero result, no regression-testable surface either way. A full-screen
      recognizer on the tab screens would only have multiplied that untestable surface (fighting
      `FlatList`/`SectionList` vertical scroll, the drawer's own edge swipe, and
      `react-native-screens`' edge-back) for a benefit this harness could never confirm. Scoping
      the gesture to the tab row keeps everything below it exactly as it already was.

    **Correction to the assumption "RNGH gestures are not injectable," recorded rather than
    silently carried forward.** `TabStrip`'s own `Gesture.Pan()` — same API, same `.runOnJS(true)`
    threading — *is* reachable by `input swipe` when mounted directly on a screen (not inside a
    `Modal`): both directions, repeatable, device-verified (Verification log, round 15). The
    non-injectability is specific to the `Sheet`/`Modal` context, not a blanket property of RNGH
    on this harness — a real, checked distinction, not a guess generalized from one data point.

    One residual risk, not resolved and not claimed to be: an edge-originating swipe on the tab
    row (starting inside `EDGE_GUARD_PX`, meant to cede to the system/`react-native-screens` back
    gesture) gave two different results across otherwise-identical injected swipes from the same
    tab — once correctly deferring (the screen exited/popped, `TabStrip`'s own gesture never
    fired), once advancing the active tab by two instead of blocking as coded. Raised
    `EDGE_GUARD_PX` from 24 to 40 for more margin, but this reads as a genuine touch-dispatch race
    between the two gesture recognizers rather than a threshold bug, and widening the number does
    not prove the race is gone. Manual check needed on a real device: an edge-band swipe on the
    tab row should never double-fire or skip a tab.

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

**Task 3 (hold-to-dictate implementation): met.** Commit `782b948`.

`src/chat/hold-to-dictate.ts` is the whole decision surface — a pure reducer over
`press` / `threshold` / `release` / `transcript-empty` / `escape` / `grace-elapsed` / `cancel`,
returning one named effect per transition. `Composer.tsx` runs the effects and owns nothing
else. Split out for the same reason `latest-pill.ts` and `dictation-guard.ts` were: the
threshold, the release decision, the escape and the cancel are then unit-testable without
mounting `Composer`, running a recorder, or spending 2.5 s of wall clock per case. 26 tests
(`hold-to-dictate.test.ts`).

- **Tap — M11's path, unchanged.** Below the threshold the release hands straight back to M11's
  toggle: the first tap leaves the recorder running, the second stops it and fills the composer.
  Same `stopRecordingAndTranscribe`, same cross-session guard (`dictation-guard.ts`), same
  "empty transcript inserts nothing".
- **Hold ≥ 2.5 s — auto-send on release.** `HOLD_AUTO_SEND_MS = 2500`, cited at the constant as
  D16.3's observed tuning ("a 2.5 s hold … restated from observation of the product, not from
  its source").
- **Visible "Auto-send" state** from the moment the threshold is crossed until the send fires or
  is escaped — a row above the chips reading "Auto-send" (primary) with "Release to send" while
  the finger is still down.
- **"Edit before sending" escape**, replacing that hint once the transcript is actually in the
  composer and editable. `AUTO_SEND_GRACE_MS = 1500` is the window it lives in.
- **Haptic on the threshold**: a new `hapticArmed()` (`src/lib/haptics.ts`), `ImpactFeedbackStyle
  .Medium` rather than the `Light` the existing helpers use — it has to be felt without looking,
  since the point of the gesture is that the user is holding the phone and talking.

Three decisions worth naming, all of them load-bearing:

1. `release` measures the hold from its own press timestamp instead of trusting the threshold
   timer to have fired. The timer drives only the visible state and its haptic, so a starved JS
   thread (the ordinary case mid-stream, not a hypothetical) cannot lose an auto-send. Tested:
   "a long enough release auto-sends even if the threshold timer never fired".
2. `grace-elapsed` is ignored outside `pending`. The grace timer is not cancellable from a pure
   reducer, so the *only* thing stopping an escaped transcript from flying anyway is that the
   late timer is a no-op. Tested directly.
3. An empty transcript never auto-sends. M11 saw exactly that on the emulator — silence in,
   empty transcript out — so a queued send whose transcript comes back empty is dropped rather
   than submitting an empty prompt.

`Composer` needed two refs to make the queued send correct, both because the send fires from a
`setTimeout` whose closure predates the transcript landing: `dictationRef` (so every dispatch
reduces the *current* machine, not the one that existed when the timer was armed) and `textRef`
(so `send()` submits the text that is in the composer now). `send()` reading `textRef.current`
rather than `text` is the one behavioural change to an existing path, and it is a strict
improvement — the Send button's own closure is always current anyway.

**Strings.** No upstream equivalent exists: grepped `src/upstream/i18n/en.ts` for `auto.?send`,
`autosend`, `editBeforeSend` and for any `hold` / `dictat` / `record` key and found nothing,
because the desktop has no touch gesture to label. The four labels
(`COMPOSER_AUTO_SEND_LABEL`, `COMPOSER_AUTO_SEND_ARMED_HINT`,
`COMPOSER_EDIT_BEFORE_SENDING_LABEL`, `COMPOSER_HOLD_TO_AUTO_SEND_HINT`) go in
`strings.mobile.ts` with that reason recorded next to them, per the round's instruction.

**The dev seam**, as task 2's plan settled: `src/voice/dev-transcript-seam.ts` substitutes only
the text `transcribeAudio` would have returned, in `recorder.ts` *after* the real
`recorder.stop()` — permission, native capture and stop all still run. It is hard-wired to
`null` outside `__DEV__` (the gate is in the seam, not at the caller, so no future caller can
switch it on in a shipped build), and is reachable from `adb` through
`app/dev/dictation-seam.tsx`, a dev-only route in the same namespace and with the same
dev-only-by-convention status as `primitives.tsx`.

**Task 4 (device verification): met for the wire path. Labelled — wire path verified with the
dev seam; real-speech recognition remains M11's [physical] item.**

Same AVD, gateway and app build as task 1, on the fresh bundle that includes the dictation code
(`Android Bundled 17659ms index.ts (8832 modules)` after a `--clear` restart — 8832 against task
1's 8829, i.e. the three new modules). `RECORD_AUDIO` granted up front
(`adb shell pm grant`, confirmed `granted=true`) so no permission dialog could land mid-gesture.

*The wire trace.* The gateway's own log has no request logging at any level this round could
reach (`setup-gw-r9.log` is three lines: `SETUP DONE`, `HERMES_BACKEND_READY port=9139`,
`Hermes backend listening`), so "nothing was sent" could not be shown from it. Instead a
logging proxy sits in front: `adb reverse tcp:9139 tcp:9140` points the device's
`127.0.0.1:9139` at a Node proxy (`ws-trace.cjs`, `ws@7.5.13` out of the repo's own
`node_modules`) that logs every HTTP request and every client→server WebSocket frame before
forwarding to the real gateway on 9139. The app's configured URL never changed. Every block
below is that log, unedited, including the heartbeats — so an absence of `prompt.submit` is a
real absence and not a filtered one.

*(a) Tap: the composer fills and nothing is sent.* Seam armed with
`hold to dictate wire check R9`. First tap at the mic's dumped centre `(336,2259)` — the
accessibility label flipped to `Stop recording`, i.e. the recorder is running and M11's toggle
is intact:

```
CLICK [273,2196][399,2322] 126x126px = 48.0x48.0dp  centre=(336,2259)  Button  desc='Stop recording'
```

Second tap at the same centre — the recorder stops, the transcript lands, the label goes back:

```
CLICK [273,2196][399,2322] 126x126px = 48.0x48.0dp  centre=(336,2259)  Button    desc='Record voice message'
CLICK [525,2153][895,2321] 370x168px = 141.0x64.0dp centre=(710,2237)  EditText  'hold to dictate wire check R9'
CLICK [906,2196][1059,2322] 153x126px = 58.3x48.0dp centre=(982,2259)  ViewGroup desc='Send'
```

Every client→server frame in that window:

```
10:19:16.853 C->S {"jsonrpc":"2.0","id":"heartbeat-4","method":"gateway.ping","params":{}}
10:19:31.870 C->S {"jsonrpc":"2.0","id":"heartbeat-5","method":"gateway.ping","params":{}}
10:19:46.886 C->S {"jsonrpc":"2.0","id":"heartbeat-6","method":"gateway.ping","params":{}}
10:20:01.903 C->S {"jsonrpc":"2.0","id":"heartbeat-7","method":"gateway.ping","params":{}}
```

Four heartbeats, no `prompt.submit`. Nothing was sent.

*(b) Hold 2.5 s and release: a prompt lands with exactly that text.* Composer cleared, seam
re-armed with `auto send on release R9`, then `input motionevent DOWN` at `(336,2259)`, 3.0 s,
`UP`:

```
10:21:47.020 C->S {"jsonrpc":"2.0","id":"heartbeat-14","method":"gateway.ping","params":{}}
10:22:02.037 C->S {"jsonrpc":"2.0","id":"heartbeat-15","method":"gateway.ping","params":{}}
10:22:03.374 C->S {"jsonrpc":"2.0","id":"r7","method":"prompt.submit","params":{"session_id":"aacd7489","text":"auto send on release R9"}}
10:22:17.053 C->S {"jsonrpc":"2.0","id":"heartbeat-16","method":"gateway.ping","params":{}}
```

Exactly the transcript — nothing appended, nothing truncated. Reproduced twice more in the
course of the (c) runs, with different phrases each time, both auto-sent on release with no
escape tapped: `"text":"escape keeps the text R9"` at `10:26:35.287` and
`"text":"escape run three R9"` at `10:29:27.355`.

The visible state was captured by `screencap` rather than `uiautomator dump`, because **a dump
taken while a touch is held returns nothing** — `uiautomator dump` waits for the window to go
idle and a held press never lets it. Two mid-hold dumps came back empty before this was
understood; the screenshots are the evidence instead. `36-hold-armed.png`, at ~3.2 s into the
hold, shows the row above the chips reading "Auto-send" (primary) on the left and "Release to
send" on the right, the mic icon red (`MicOff`), and the OS's own green microphone-in-use dot
lit in the status bar — the recorder really is capturing. `35-hold-below-threshold.png`, at
~1.2 s, shows no such row.

*(c) Hold, then "Edit before sending": nothing is sent and the text stays.* The escape's own
node, from a dump taken inside the grace window:

```
CLICK [682,1869][1049,1995] 367x126px = 139.8x48.0dp  centre=(865,1932)  Button  desc='Edit before sending'
```

and the composer alongside it, already holding the transcript and editable:

```
CLICK [525,2153][895,2321] 370x168px = 141.0x64.0dp  centre=(710,2237)  EditText  'escape keeps the text R9'
```

Seam re-armed with `escape run four R9`; `DOWN`, 3.0 s, `UP`, then the escape tapped at
`(865,1932)`. Every client→server frame from the mark to eight seconds after the tap — well
past the 1.5 s grace:

```
10:30:47.619 C->S {"jsonrpc":"2.0","id":"heartbeat-50","method":"gateway.ping","params":{}}
10:31:02.636 C->S {"jsonrpc":"2.0","id":"heartbeat-51","method":"gateway.ping","params":{}}
```

No `prompt.submit`. The composer afterwards:

```
CLICK [525,2153][895,2321] 370x168px = 141.0x64.0dp  centre=(710,2237)  EditText  'escape run four R9'
CLICK [906,2196][1059,2322] 153x126px = 58.3x48.0dp  centre=(982,2259)  ViewGroup desc='Send'
```

Text intact, Auto-send row gone, no turn running. `40-after-escape.png` shows the same thing
from the other side: the three earlier auto-sends are user bubbles in the transcript
("escape keeps the text R9", "escape run two R9", "escape run three R9") while "escape run four
R9" is still sitting in the composer.

*One procedural deviation, stated rather than glossed.* The round's rule is a fresh dump and a
node-centre tap before every tap. For this one tap that is not physically possible: the grace
window is 1.5 s and a `uiautomator dump` + `adb pull` round trip is about 2 s, so three attempts
to dump-then-tap all had the grace fire first (their sends are the two extra `prompt.submit`
lines quoted in (b), which is why they are quoted there — they are real auto-sends, not
failures). The successful run tapped `(865,1932)` immediately on release. That coordinate is not
guessed: two dumps of this exact screen state, taken minutes apart in the two immediately
preceding runs, both reported `desc='Edit before sending'` at `[682,1869][1049,1995]`, and the
composer was confirmed idle (no Stop/Steer action row, which is the only thing that shifts this
row) in the dump immediately before the hold. The tap is non-destructive, and its effect was
verified by dump afterwards.

*What this does and does not prove.* It proves the tap path fills and sends nothing, that a
≥2.5 s hold auto-sends on release with exactly the transcript text on the wire, that the visible
Auto-send state and its haptic path are reached, and that the escape cancels the send while
keeping the text. It does not prove real-speech recognition: the transcript came from the
`__DEV__` seam, so mic content, m4a encoding, upload and Whisper were bypassed by construction.
Per this round's own instruction the result is labelled: **wire path verified with the dev seam;
real-speech recognition remains M11's [physical] item.** The seam was cleared
(`hermes-android://dev/dictation-seam?clear=1`, screen confirming `(none — real transcription)`)
before teardown.

**Task 5 (`npm run check`): exit 0.** Run at `782b948`, the round's last code commit, with a
clean working tree.

```
 Test Files  69 passed (69)
      Tests  653 passed (653)
Ran 52 tests in 3.671s
OK
All matched files use Prettier code style!
EXIT=0
```

653 against round 8's 627 — the 26 new `hold-to-dictate.test.ts` cases. `tsc -p . --noEmit`
clean, `eslint .` clean. (The `RuntimeError: boom` and `Expo push send failed` lines in the
Python half's output are `hermes-push`'s own deliberate failure-path fixtures, unchanged from
previous rounds; the suite reports `OK`.)

**Exit criteria touched this round.**

- **Model and effort (chips task, group B).** Met. Both sheets' rows are real ≥48 dp native
  targets in both themes (48.0 dp effort, 57.9-58.3 dp model), and a tap at a dumped row centre
  selects that row and no other — proved on the wire (`config.set` model then reasoning) and by
  `session.resume().info` reading back `deepseek-v4-flash` / `low`.
- **Hold-to-dictate.** Met for the wire half, with the label the round's own instruction
  specifies. "A 2.5 s hold auto-sends the transcript on release (a prompt lands on the wire with
  that text)" — proved three times, `prompt.submit` carrying exactly the transcript. "A tap only
  fills the composer" — proved, with zero `prompt.submit` in the window. Both via the `__DEV__`
  transcript seam; real-speech recognition remains M11's `[physical]`-class item and is not
  claimed here.

Boxes are deliberately left unticked in this file — the user ticks them.

**Task 7 (teardown): done, each step with its own readback.**

- **(a) Hone restored, throwaway removed.** "Switch to Hone" tapped at its dumped centre
  `(211,677)`; the registry log — the storage readback — flipped immediately:
  `[registry] active: conn-1789205984475-cpgcec (Hone)`. `M15-R9` then removed under the
  destructive-tap rule: fresh dump immediately before the tap, the two `Remove` buttons
  disambiguated by card (`M15-R9`'s action row at `y 761-887`, Hone's at `y 1250-1376`), and the
  confirm dialog's own text read before confirming — `"M15-R9" will be removed from this app. The
  instance itself is not touched — you can add it again any time.` Named the throwaway, not Hone,
  so `REMOVE` was tapped. The list afterwards holds one card:

  ```
  CLICK [76,351][1004,477] 928x126px = 353.5x48.0dp  centre=(540,414)  ViewGroup desc='Hone, Primary, Current'
        [76,487][1004,540] 928x53px  = 353.5x20.2dp  centre=(540,513)  TextView  'https://gateway.example.org'
  ```

  Force-stopped and cold-launched (new PID `16377`, against `14238` before). The registry log
  after the relaunch:

  ```
  09-16 15:36:30.138 16377 16474 I ReactNativeJS: [registry] active: conn-1789205984475-cpgcec (Hone)
  09-16 15:36:30.138 16377 16474 I ReactNativeJS: [registry] list: conn-1789205984475-cpgcec (Hone) primary=true needsLogin=false
  ```

  One connection, Hone, active and primary. The app landed on the session list with Hone's real
  sessions ("Replace Hermes-ifrah with DeepSeek v4.1 flash", "Friendly greeting for mobile UI
  test", …) — never `/connect`. `51-cold-launch-session-list.png`. (The dev-client launcher step
  in between is a dev-build property, as in rounds 6-8, not a boot failure.)

- **(b) Metro, the gateway and the trace proxy stopped, ports refusing.** Stopped by PID — never
  `hermes serve --stop`, which AGENTS.md records as unscoped and fatal to every Hermes process on
  the machine. Metro `16928` (`node`), the throwaway gateway `8772` (`python`), the wire-trace
  proxy `15824` (`node`). Afterwards:

  ```
  http://127.0.0.1:8081/status    -> exit 7 output=[]
  http://127.0.0.1:9139/api/health -> exit 7 output=[]
  http://127.0.0.1:9140/api/health -> exit 7 output=[]
  ```

  All three `curl --max-time 3` calls exit 7 (connection refused) with no body. Nothing else was
  started this round.

- **(c) Scratch state deleted, each path named and re-checked.** Deleted, then `ls`'d again:
  1. the scratch `HERMES_HOME`, `%TEMP%\hermes-m15r9-home` (recursively — it held `.env`,
     `config.yaml`, `auth.json`, `sessions`, `state.db*`, and the rest of a real Hermes home);
  2. `%TEMP%\hermes-m15r9-home\.cookie-secret`, the round's stable cookie-signing key;
  3. `scratch-password.txt` in the evidence directory.

  All three now report `No such file or directory`. The real Hermes home
  (`%LOCALAPPDATA%\hermes`) is present and untouched — it was only ever read from, for the
  provider key. Unlike round 8 there are **no** `~/.local/bin` profile shims to remove: this
  round's `setup-gw-r9.sh` drops r8's two `hermes profile create` lines, because nothing here
  needed bot profiles; confirmed by `ls ~/.local/bin/*.bat` reporting no such file. The evidence
  directory itself (`%LOCALAPPDATA%\hermes-android-field\m15-r9\`, 24 screenshots/dumps plus
  `setup-gw-r9.sh`) is left in place, per the round's own instruction.

- **(d) `adb reverse` empty, `font_scale` 1.0.** `adb reverse --remove-all` wedged past its
  timeout first (exit 124) — the same hang rounds 6 and 8 hit. Per the standing rule, only the
  local `adb` server process was killed (PID `9036`; the emulator was left running), then
  `adb start-server`, after which the device reattached on its own (`emulator-5554 device`) and
  the retry completed cleanly: `remove-all exit=0`, and `adb reverse --list` returned `exit=0
  output=[]` — empty. `settings get system font_scale` returns `1.0` (never changed this round).
  Night mode, which task 1's dark-theme dumps switched on, was set back to `no`.

- **(e) Emulator shut down, AVD intact.** `adb emu kill` → `OK: killing emulator, bye bye`;
  `adb devices` empty immediately after. Two `emulator` processes lingered for a few seconds
  (shutdown in progress, same as rounds 6 and 8) — a check ~12 s later shows none.
  `emulator -list-avds` still lists `hermes-test`: shut down, not deleted.

- **(f) Pushed, working tree clean.** Four commits this round — `019a36b` (the Sheet fix),
  `697d24b` (task 1's evidence and task 2's plan), `782b948` (hold-to-dictate), `0b1db52` (this
  log and Deviations 10-12) — plus this teardown entry. Ordinary `git push`, no force, no merge.

### Opus review, group B closed (2026-09-16)

Opus checked round 9 against its commits, dumps and host state, and re-ran `npm run check` at
`3826c98` (exit 0, 653 tests). `src/upstream/` is still byte-identical to `4363d9e`. Nothing was
left listening after teardown, including the trace proxy.

**Ticked:**
- **Composer chips task.** Round 8's "FlashList row bounds" diagnosis was wrong. The real cause was
  `Sheet`'s `absoluteFill` root filling the composer's chip row instead of the screen, so Android
  never delivered touches to rows drawn outside it. Fixed in `019a36b` by hosting `Sheet` in a
  `Modal`. Effort rows now measure 48.0 dp and model rows 57.9–58.3 dp, in both themes. Taps at the
  dumped row centres hit the intended rows, confirmed by reading back `session.resume().info`.
- **Hold-to-dictate task and exit criterion.** Verified through the dev-only transcript seam:
  - A tap fills the composer and sends nothing.
  - A hold past 2.5 s sends exactly the transcript on the wire, reproduced three times.
  - The escape sends nothing and leaves the text in the composer.

  The auto-send waits for a 1.5 s grace window after release (Deviation 12) rather than firing the
  instant the finger lifts. That window is what makes "Edit before sending" possible. Recognising
  real speech remains M11's `[physical]` item; this criterion covers M15's hold, send and escape
  logic, which the seam exercises through the real recorder callback path.

**Carried forward; both must be done before M15 is `done`:**
1. **Sheet regression pass.** Hosting `Sheet` in a `Modal` changes every consumer, and only the two
   chip sheets were checked on device. Still to check: bots (new bot), cron (blueprints), projects,
   settings/profiles (create), `BotSettingsSheet` including the nested Capabilities sheet, and
   `Menu` (message long-press, row menus). For each: it opens, the keyboard doesn't cover focused
   inputs, back and swipe-down dismiss it, nested sheets stack, and touch targets are 48 dp.
2. **`app/dev/` is reachable in release builds.** `app/dev/primitives.tsx` (since M14) and
   `app/dev/dictation-seam.tsx` have no layout guard and no `__DEV__` gate, so a deep link opens
   them. The seam is inert outside `__DEV__`, so this is exposure, not a security hole. Add an
   `app/dev/_layout.tsx` that redirects when `!__DEV__`, with a test.

**Cosmetic, not blocking:** the model sheet's fixed 320 dp list height isn't a multiple of the
58 dp row pitch, so the last visible row is always partly cut off.

### Round 10 — Sheet regression pass, `app/dev/` gated; Tasks tab not started (2026-09-16)

**Scope note, stated up front.** This round covered tasks 0, 1, 4 and 6 (the two carried
blockers, the check, the teardown). **Tasks 2 and 3 — the Tasks tab (M15 C) and its device
verification — were not attempted.** Task 0 turned into far more than a pass/fail sweep: it found
a real regression, and then a second symptom that took several device rebuild cycles to attribute
correctly (each `CI=1` Metro restart with `--clear` is ~2 minutes before a single tap can be
retried). Rather than start a screen of the size `tasks.html` describes with what was left, it is
not started at all — an unfinished Tasks screen would have been worse than none. What *was*
produced for it is the source research task 2 asked for, recorded below so the next round starts
from it rather than repeating it.

**Task 0 (Sheet regression pass): done, device-verified, one regression found and fixed.**

`019a36b` moved every `Sheet` into a `Modal`; round 9 only verified the model and effort sheets.
All six remaining consumers were checked on device (dark theme, hermes-test AVD, 1080x2400 @
420 dpi, throwaway gateway `M15-R10` on port 9141).

*The regression: a `Modal` does not inherit the activity's soft-input mode.*
`android/app/src/main/AndroidManifest.xml:31` sets
`android:windowSoftInputMode="adjustResize"` on `MainActivity`, which is why every *screen* in
this app reflows around the IME. A `Modal` is its own window and does not inherit it, so once the
sheet moved into one, a focused input inside it was simply covered. Measured on the New profile
sheet (`app/(main)/settings/profiles.tsx:282`): with the IME up (`mInputShown=true`), every sheet
node stayed at its unfocused coordinates —

```
CLICK [912,1304][1038,1430] 126x126px = 48.0x48.0dp  centre=(975,1367)  ViewGroup desc='Close'
CLICK [42,1621][1038,1753] 996x132px = 379.4x50.3dp  centre=(540,1687)  EditText  'profile name'
CLICK [42,2190][530,2316]  488x126px = 185.9x48.0dp  centre=(286,2253)  Button    desc='Cancel'
CLICK [551,2190][1038,2316] 487x126px = 185.5x48.0dp centre=(794,2253)  Button    desc='Create profile'
```

— with the NAME field and both footer buttons behind the keyboard
(`01-profiles-keyboard.png` shows the sheet's title and one line of body, then keyboard).

*Fix* (`2e8d02f`, `src/components/ui/Sheet.tsx`): subscribe to React Native's own `Keyboard`
events and lift the sheet by the reported height (`marginBottom`, not `paddingBottom` — padding
would make the sheet taller and push its own top off-screen; a margin slides the same-sized sheet
up). RN's `Keyboard` rather than `react-native-keyboard-controller` (already a dependency,
driving the composer) because that library's components read a `KeyboardProvider` context mounted
once in `app/_layout.tsx:40`, in the main window — a second provider would have to go inside every
modal, whereas `Keyboard`'s events come from the IME and need none.

After the fix, the same sheet with the IME up — every node moved by the same 757 px delta:

```
CLICK [912,547][1038,673]  126x126px = 48.0x48.0dp  centre=(975,610)   ViewGroup desc='Close'
CLICK [42,864][1038,996]   996x132px = 379.4x50.3dp centre=(540,930)   EditText  'profile name'
CLICK [42,1192][1038,1318] 996x126px = 379.4x48.0dp centre=(540,1255)  ViewGroup desc='default'
CLICK [42,1433][530,1559]  488x126px = 185.9x48.0dp centre=(286,1496)  Button    desc='Cancel'
CLICK [551,1433][1038,1559] 487x126px = 185.5x48.0dp centre=(794,1496) Button    desc='Create profile'
```

and tapping Cancel at its new centre `(286,1496)` — with the keyboard still up — closed the
sheet, so the footer is genuinely reachable and not merely repositioned
(`02-profiles-keyboard-fixed.png`).

*Per-consumer results.* (a) opens · (b) focused input clear of the keyboard · (c) hardware back
dismisses only the top sheet · (d) swipe-down · (e) nested stacking · (f) every clickable node
≥ 48 dp.

| consumer | a | b | c | d | e | f |
| --- | --- | --- | --- | --- | --- | --- |
| `app/(main)/bots/index.tsx` — New bot | ✓ | ✓ lifted 757 px | ✓ | see below | n/a | ✓ 48.0–64.0 dp |
| `app/(main)/cron/index.tsx` — blueprints | ✓ | n/a, no input | ✓ | see below | n/a | ✓ 48.0–58.3 dp |
| `app/(main)/projects/index.tsx` — New project | ✓ | ✓ lifted 757 px | ✓ | see below | n/a | ✓ 48.0–50.3 dp |
| `app/(main)/settings/profiles.tsx` — New profile | ✓ | ✓ lifted 757 px | ✓ | see below | n/a | ✓ 48.0–50.3 dp |
| `src/components/BotSettingsSheet.tsx` | ✓ | ✓ | ✓ | see below | ✓ | ✓ 48.0–147.4 dp |
| ↳ nested `CapabilitiesSheet.tsx` | ✓ | ✓ | ✓ | see below | ✓ | ✗ see below |
| `src/components/ui/Menu.tsx` — header overflow | ✓ | n/a | ✓ | see below | n/a | ✓ 48.0 dp |
| `src/components/ui/Menu.tsx` — message long-press | ✓ | n/a | ✓ | see below | n/a | ✓ 48.0 dp |

*(e), in full.* From `BotSettingsSheet`, tapping `Capabilities` opened `CapabilitiesSheet` above
it: the dump then reports only the child's nodes (`Search skills and toolsets…`, the toolset
rows), the parent's own rows having dropped out of the accessibility tree because the child's
modal window occludes them. One Back returned to the parent with its rows present again
(`Capabilities, Skills and toolsets for this bot, 1 · 16` and `Model, Pinned for this bot,
mimo-v2.5` both back); a second Back closed the parent and left the chat (`Bot settings` header
button present). So nested sheets stack and unwind one level at a time, which is (c) and (e)
together.

*(c), a detail worth recording.* On a sheet with a focused input it takes two Backs, because the
first closes the IME — standard Android, not a sheet behaviour. On a sheet with no input, one
Back is enough.

*(d) could not be exercised — an instrumentation limit, not a result.* No adb-injected gesture
reaches React Native's JS responder system on this emulator. A temporary trace on
`onMoveShouldSetPanResponder`, `…Capture`, `onPanResponderMove` and `onPanResponderRelease`
(removed before commit) logged **nothing at all** for `input swipe` (400 ms, 1200 ms), for
`input draganddrop`, and for a hand-built `input motionevent DOWN` + seven `MOVE`s + `UP`, while
`input tap` in the same session reached the same subtree fine (a `CLOSE pressed` trace fired from
the ✕ inside the drag strip). Since the responder never receives a MOVE, the drag-to-dismiss path
cannot be reached from here at all, and this round can report neither pass nor fail for it. It
needs a real finger, or an injection method that produces a motion stream RN tracks.

Two things were tried and **reverted** rather than shipped unverified, both recorded here so they
are not re-attempted blind:
- Adding `onMoveShouldSetPanResponderCapture` to the drag handle. Motivated by a misreading — a
  "dead sheet head" that turned out to be my own broken multi-process `motionevent` drag wedging
  the touch stream (the head was reachable again on the next clean launch). With a real finger a
  `dy > 4` capture would also steal a slightly sloppy tap on Close, and none of that is testable
  here.
- Sizing the backdrop (`...StyleSheet.absoluteFillObject`) and splitting the open effect so the
  animation starts after mount. Neither made the scrim appear.

*Found, not fixed, not part of this round's tasks.* Two separate items, both filed rather than
chased:
1. **The sheet scrim never renders.** `onLayout` on the backdrop `Animated.View` reported
   `{"x":0,"y":0,"width":411.4,"height":0}` — `styles.backdrop` carries only a `backgroundColor`,
   so as a plain flex child it has no height, and the tap-to-dismiss `Pressable` inside it
   (`absoluteFill` *relative to that View*) is zero-sized too. On device the screen behind an open
   sheet is at full brightness (`06-backdrop-dimmed.png`) and the scrim's `Pressable` never
   appears in a dump. So tapping outside a sheet to close it does nothing. Pre-existing, not a
   `Modal` regression — the style has always been this shape. Sizing it did not make it appear
   either, so there is a second cause still unidentified; deliberately left as a known bug rather
   than a half-fix.
2. **`CapabilitiesSheet`'s toggles are under 48 dp.** Every `Switch` measures
   `122x71px = 46.5x27.0dp` (e.g. `[916,479][1038,550]`). The row around it is 51.8–52.2 dp and is
   itself tappable, but the switch — the thing a user aims at — is not. Unrelated to the `Modal`
   change; it is the `Switch` component's own size.

Also noticed while opening the cron screen, and relevant to task 2 when it happens: two inputs on
the *existing* cron screen (not a sheet) are under 48 dp —
`[42,806][1038,918] 42.7dp 'Morning briefing'` and
`[42,1143][1038,1254] 42.3dp '0 9 * * * or weekdays at 9am'`. That screen is the one M15 C
replaces.

**Task 1 (gate `app/dev/` in release builds): done; dev path device-verified, release path
code-verified only.** Commit `2677229`.

`app/dev/_layout.tsx` redirects to `/` unless `devRoutesEnabled()`. The `typeof __DEV__` guard
moved into `src/lib/dev-build.ts` and `src/voice/dev-transcript-seam.ts` now imports it, so the
two cannot drift — that guard had already been written twice (`src/connections/registry.ts:194`
and the seam), and a dev-only escape hatch failing open in a shipped build is exactly what it
exists to prevent. 9 tests (`src/lib/dev-build.test.ts`) cover `__DEV__` absent (the vitest case,
where a bare reference would throw rather than read falsy — the `typeof` half is load-bearing),
`false`, and `true`, plus that `devRoutesEnabled` tracks `isDevBuild` exactly.

`route-replicates.test.ts` still excludes `app/dev/`, and excludes this file twice over: once by
filename (`entry === '_layout.tsx'`, `src/lib/route-replicates.test.ts:44`) and once by prefix
(`rel.startsWith('dev/')`, same file, :50). Re-ran it: passes.

Device-verified in the dev build — `hermes-android://dev/primitives` and
`hermes-android://dev/dictation-seam?text=…` both still open, now inside the layout's `Stack`
(the new "Navigate up" header in the dump is that `Stack`, which is itself evidence the layout is
mounted). **The release case is code-verified only**: no release variant was built this round, so
"redirects in a release build" rests on the unit tests plus reading `_layout.tsx`, not on a
device.

**Tasks 2 and 3 (Tasks tab, M15 C): not attempted.** See the scope note above. The research task 2
asked for was done and is recorded here so it is not repeated:

- **"Schedule in words" is a server-provided string, not a client-side humanizer.** The desktop
  reads it with a fallback chain, `apps/desktop/src/app/cron/index.tsx:130-133`:

  ```ts
  function jobScheduleDisplay(job: CronJob): string {
    return asText(job.schedule_display) || asText(job.schedule?.display) || asText(job.schedule?.expr) || '—'
  }
  ```

  and the raw expression separately at :135-137 (`jobScheduleExpr`: `schedule?.expr` first, then
  `schedule_display`). `schedule_display` is produced host-side by
  `../hermes-agent/cron/jobs.py:438-470` (`_schedule_display_for_job`, called from the job
  normalizer), and written on create at `cron/jobs.py:1763`
  (`"schedule_display": parsed_schedule.get("display", schedule)`). So the list and detail screens
  must use the desktop's chain against `CronJob.schedule_display` / `schedule.display` /
  `schedule.expr`, not invent a parser.
- **The "Running now" state.** `apps/desktop/src/app/cron/job-state.ts:16-20`:

  ```ts
  export function jobState(job: CronJob): string {
    const state = typeof job.state === 'string' ? job.state.trim() : ''

    return state || (job.enabled === false ? 'disabled' : 'scheduled')
  }
  ```

  with the state vocabulary fixed by `STATE_DOT` at :5-13 — `completed`, `disabled`, `enabled`,
  `error`, `paused`, `running`, `scheduled`. "Running now" is `jobState(job) === 'running'`.
  `jobTitle` at :24-28 is the matching name fallback (name → first 60 of prompt → first 60 of
  script → id).
- **The plain-language echo in the New task sheet is a mobile-only addition, and the prototype
  says so.** `docs/mobile-prototypes/tasks.html:30-32` marks it `Field (ours)` — "the structured
  schedule picker … with a plain-language echo and the raw schedule string behind Advanced (the
  desktop's SchedulePicker; theirs only ever shows `0 9 * * *`)". It cannot reuse
  `schedule_display`, because that only exists once the job does. For template presets
  `CronBlueprint.scheduleHuman` (`src/api/cron.ts:86`) already carries one from the host — the
  blueprints sheet on device shows exactly these ("daily at 08:00", "every 30 minutes",
  "weekdays at 09:00"). Only a *typed* expression would need a client-side humanizer, and that
  would be new mobile-only logic needing its own tests and a Deviation.

**Task 4 (`npm run check`): exit 0**, run at `df696f9` with a clean tree.

```
 Test Files  70 passed (70)
      Tests  660 passed (660)
Ran 52 tests in 3.672s
OK
All matched files use Prettier code style!
EXIT=0
```

660 against round 9's 653: +9 `dev-build.test.ts`, and the two counts differ by the label-test
case count shifting with the new file. One incidental fix was needed to get there
(`df696f9`): `Sheet.tsx`'s `Keyboard.addListener('keyboardDidShow')` tripped
`labels.test.ts`'s retyped-label check, because `LOOKS_TECHNICAL`'s trailing character class
stops at an interior capital, so a camelCase platform-API event name read as prose. Added a
narrow `LOOKS_LIKE_CAMEL_IDENTIFIER` rule — one word, no whitespace, starts lowercase; anything
with a space or a leading capital is still checked.

**Exit criteria touched.** None of M15's own exit criteria are closed or advanced by this round —
tasks 0 and 1 are carried blockers and infrastructure, not criteria, and the Tasks criterion was
not attempted. The Tasks / Pairing / Banner / Gestures criteria all stand exactly as they did at
the group B close.

**Task 6 (teardown): done, each step with its own readback.**

- **(a) Hone restored, throwaway removed.** "Switch to Hone" tapped at its dumped centre
  `(211,677)`; the registry log — the storage readback — flipped straight away:

  ```
  09-16 16:44:46.457 14104 14184 I ReactNativeJS: [registry] active: conn-1789557801666-7fk4z4 (M15-R10)
  09-16 16:56:31.766 14104 14184 I ReactNativeJS: [registry] active: conn-1789205984475-cpgcec (Hone)
  ```

  `M15-R10` then removed under the destructive-tap rule: fresh dump immediately before, the two
  `Remove` buttons disambiguated by card (M15-R10's action row at `y 761-887`, Hone's at
  `y 1250-1376`), and the confirm dialog read before confirming — `"M15-R10" will be removed from
  this app. The instance itself is not touched — you can add it again any time.` It named the
  throwaway, not Hone, so `REMOVE` was tapped. The list afterwards holds one card:

  ```
  CLICK [76,351][1004,477] 928x126px = 353.5x48.0dp  centre=(540,414)  ViewGroup desc='Hone, Primary, Current'
  CLICK [42,816][1038,942] 996x126px = 379.4x48.0dp  centre=(540,879)  Button    desc='Add connection'
  ```

  Force-stopped and cold-launched (new PID `15348`, against `14104` before):

  ```
  09-16 16:57:32.058 15348 15426 I ReactNativeJS: [registry] active: conn-1789205984475-cpgcec (Hone)
  09-16 16:57:32.059 15348 15426 I ReactNativeJS: [registry] list: conn-1789205984475-cpgcec (Hone) primary=true needsLogin=false
  ```

  One connection, Hone, active and primary, and the app landed on the session list with Hone's own
  sessions ("Replace Hermes-ifrah with DeepSeek v4.1 flash", …) — never `/connect`.
  `50-teardown-session-list.png`.

- **(b) Metro, the gateway and the trace proxy stopped; ports refusing.** Stopped by PID — never
  `hermes serve --stop`, which AGENTS.md records as unscoped and fatal to every Hermes process on
  the machine. Metro `19128` (`node`), the throwaway gateway `1480` (`python`), the wire-trace
  proxy `3496` (`node`).

  ```
  http://127.0.0.1:8081/status     -> exit 7 output=[]
  http://127.0.0.1:9141/api/health -> exit 7 output=[]
  http://127.0.0.1:9142/api/health -> exit 7 output=[]
  ```

  All three `curl --max-time 3` calls exit 7 (connection refused), no body.

- **(c) Scratch state deleted, each path named and re-checked.** Deleted, then `ls`'d again — all
  report `No such file or directory`:
  1. the scratch `HERMES_HOME`, `%TEMP%\hermes-m15r10-home` (recursively);
  2. `%TEMP%\hermes-m15r10-home\.cookie-secret`;
  3. `scratch-password.txt` in the evidence directory;
  4. `~/.local/bin/coder.bat` and `~/.local/bin/researcher.bat` — unlike round 9, this round's
     script is the full `m14-device/setup-gw.sh` copy and *does* keep its two
     `hermes profile create` lines (task 0 needed a bot for `BotSettingsSheet`), so the two shims
     existed again and had to go.

  The real Hermes home (`%LOCALAPPDATA%\hermes`) is present and untouched — only ever read from,
  for the provider key. The evidence directory
  (`%LOCALAPPDATA%\hermes-android-field\m15-r10\`, screenshots, dumps and `setup-gw-r10.sh`) is
  left in place per the round's own instruction.

- **(d) `adb reverse` empty, `font_scale` 1.0.** `adb reverse --remove-all` wedged past its
  timeout first (exit 124) — the same hang rounds 6, 8 and 9 hit. Per the standing rule only the
  local `adb` server process was killed (PID `12336`; the emulator left running), then
  `adb start-server`, after which the device reattached on its own (`emulator-5554 device`) and
  the retry completed: `remove-all exit=0`, `adb reverse --list` → `exit=0 output=[]`, empty.
  `settings get system font_scale` → `1.0` (never changed this round). Night mode, which the whole
  task 0 sweep ran in, set back to `no`.

- **(e) Emulator shut down, AVD intact.** `adb emu kill` → `OK: killing emulator, bye bye`;
  `adb devices` empty immediately after. Two `emulator` processes lingered a few seconds
  (shutdown in progress, as in rounds 6, 8 and 9) — a check ~15 s later shows none.
  `emulator -list-avds` still lists `hermes-test`: shut down, not deleted.

- **(f) Pushed, working tree clean.** Four commits this round — `2e8d02f` (the sheet keyboard
  fix), `2677229` (the `app/dev/` gate), `df696f9` (the labels-test rule), `efffdfe` (this log and
  Deviation 13) — plus this teardown entry. Ordinary `git push`, no force, no merge.

### Round 11 — sheet scrim root-caused and fixed, Tasks tab built; not device-verified (2026-09-16)

Branch `m15-bots-mobile-ux`, from `35be976`. Two commits: `434c3cc` (task 0) and `3a616f3`
(task 1).

**Task 0 (sheet follow-ups): done, code-verified only — NOT device-verified.** Commit `434c3cc`.

*(a) The scrim. Both causes found, with file:line.*

1. **Zero height.** `styles.backdrop` (`src/components/ui/Sheet.tsx`, pre-change) carried only a
   `backgroundColor`. As a plain flex child of the `absoluteFill` root it stretched to full width
   and collapsed to zero height, because its only child is `position: absolute` and so
   contributes nothing to its parent's intrinsic size. That is exactly what round 10's `onLayout`
   measured (`{"x":0,"y":0,"width":411.4,"height":0}`).

2. **Why round 10's fix for (1) did nothing.** That attempt spread
   `...StyleSheet.absoluteFillObject`. **React Native 0.86.3 has no such export.**
   `node_modules/react-native/Libraries/StyleSheet/StyleSheetExports.js:21-27` declares
   `absoluteFill` as a plain object literal and exports exactly that one name at `:110`; there is
   no `absoluteFillObject` beside it. (The two-name era — `absoluteFill` a registered style ID,
   `absoluteFillObject` its object form — is gone; `absoluteFill` *is* the object now.) Spreading
   `undefined` into an object literal is legal JavaScript and contributes nothing, so the style
   stayed `{backgroundColor}` and the backdrop stayed zero-height. The edit compiled and read
   like a fix while changing nothing at runtime. `tsc` does flag it — `TS2551: Property
   'absoluteFillObject' does not exist on type 'typeof StyleSheet'. Did you mean 'absoluteFill'?`
   — which is how it was caught here. Round 10 never saw that error because the change was
   reverted before a typecheck ran.

   So the "second cause" is not a second rendering fault: it is the reason the first fix was a
   no-op. With `...StyleSheet.absoluteFill` the style is correct.

   **Not fixed, found while fixing this:** `src/components/AppDrawer.tsx:142-144` carries the
   identical zero-height `backdrop` — `Sheet`'s style was copied from it. The drawer's scrim
   therefore does not dim, and its tap-to-close `Pressable` is zero-sized too. Left alone
   deliberately: fixing it would start dimming the screen behind the drawer, a visible behaviour
   change outside this round's scope, and it needs its own device pass. Filed, not chased.

*(b) `CapabilitiesSheet` switches.* The `Switch` is now a pure indicator — `pointerEvents="none"`,
`importantForAccessibility="no"` (so it leaves the accessibility tree `uiautomator` dumps), and
its `onValueChange` deleted rather than left dead. The semantics moved to the row, which now
carries `accessibilityRole="switch"` and the `checked` state, so a toggle is one node instead of
two.

*(c) Keyboard lift on tall sheets.* `marginBottom: keyboardInset` lifted the sheet by the
keyboard's full height with nothing bounding it against the space left above the IME, so a tall
sheet pushed its own header off the top. The primitive's 88% rule is now measured against
`windowHeight - keyboardInset` and caps the sheet as a whole rather than just its body; the body
became a `ScrollView` with `flexShrink: 1` so it is the part that gives.

Also split the open effect so the native-driver animation starts after mount rather than against
unattached nodes. Recorded in the code as **defensive, not a fix for an observed symptom** — both
values end at their on-screen state, so a late attach has always attached already-correct.

**None of (a), (b) or (c) was device-verified.** No dp dump, no keyboard-open dump, no
backdrop-tap test, no nested BotSettings → Capabilities check. The round never reached a running
build (see task 2). The pasted blocks the task asked for — the dp dump showing no clickable node
under 48 dp, and the tall-sheet dump with the keyboard open — **are empty; they were not
captured.**

**Task 1 (Tasks tab, M15 C): built, `npm run check` green, NOT device-verified.** Commit
`3a616f3`.

New: `app/(main)/tasks/index.tsx`, `app/(main)/tasks/[id].tsx`,
`src/components/NewTaskSheet.tsx`, `src/lib/cron-schedule.ts`, `src/lib/cron-job-state.ts`,
`src/lib/task-format.ts`, plus tests for the three pure modules.

*One research correction that changed the design.* Round 10 recorded "schedule in words is
server-provided". That is true for intervals and one-shots and **false for every cron
expression**: `../hermes-agent/cron/jobs.py:716-726` (`_cron_schedule`) returns
`{"kind": "cron", "expr": expr, "display": display}` where `display` is *the string the user
typed*, so `0 9 * * *` comes back as the literal `0 9 * * *`. Only `_interval_schedule`
(`:729-730`, `"every 30m"`) and the one-shot branches (`:778`, `:793`, `"once at …"`) write a
sentence host-side. A client-side humanizer is therefore needed on the **list**, not only in the
create sheet.

*Layers searched before writing one*, per M14 Deviation 13's rule:

1. `src/upstream/` — no humanizer, but `src/upstream/i18n/en.ts`'s `cron.*` carries the entire
   output vocabulary (`days`, `dayFallback`, `everyDayAt`, `weekdaysAt`, `everyDayOfWeekAt`,
   `monthlyOnDayAt`, `topOfHour`, `everyHourAt`, `scheduleHints`). Those strings exist because
   something feeds them.
2. `apps/desktop/` — **it has one.** `apps/desktop/src/app/cron/index.tsx`: `cronParts`
   (:151-155), `dayName` (:157-159), `formatCronTime` (:161-173), `isIntegerToken` (:175-177),
   `scheduleOptionForExpr` (:179-232), `scheduleSummary` (:234-264), over `SCHEDULE_OPTIONS`
   (:101-109). So `src/lib/cron-schedule.ts` is a **port**, branch order and predicates included
   — not the "small pure one" the task allowed for, because the task's precondition ("if no
   vendored or desktop humanizer exists") turned out to be false.
3. `node_modules/` — no `cronstrue` or equivalent is a dependency.
4. The host (`../hermes-agent`, read-only) — declines to humanize cron, as above.

`src/lib/cron-job-state.ts` likewise ports `apps/desktop/src/app/cron/job-state.ts:16-29`
verbatim. Anything the humanizer cannot describe returns `null` and every caller renders the raw
expression — never a wrong sentence. 50 tests cover it, including every "returns null" case.

Drawer row 3 renamed to the Tasks label and routed at `/(main)/tasks`; `drawer-rows.test.ts`'s
`has no row for Tasks` guard replaced by its inverse (the row must exist AND point at the new
route). The old `/(main)/cron` routes became `<Redirect>`s rather than being deleted, so an
existing deep link still lands; both added to `route-replicates.test.ts`'s `NOT_A_SCREEN`. No
dead links.

**Deviation 6 is now stale** — its premise ("M15 C's Tasks-tab rebuild hasn't landed") no longer
holds. Left for you to close rather than closed here.

**Task 2 (device-verify the Tasks exit criterion): NOT DONE.** This is the round's main gap, and
it is the second round running that the Tasks criterion goes unverified.

How far it got, so the next round does not repeat the setup:

- The emulator was cold — `adb devices` empty at the start of the round.
- ~~**Round 10's evidence directory does not exist** … `%LOCALAPPDATA%\hermes-android-field`
  itself was absent.~~ and ~~**`m14-device/setup-gw.sh` does not exist** anywhere under
  `D:\Stuff\Code\git`.~~ **Both claims were false. Corrected in round 12 — see that entry's
  task 0.** The field kit was there the whole time, at
  `C:\Users\you\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\hermes-android-field\`
  (20 round folders, `m14-device/setup-gw.sh`, `m15-r10/` with 24 files). Round 11 made two
  distinct errors: it searched only the *repo* tree for `setup-gw.sh` — reading the brief's
  `m14-device\setup-gw.sh` as repo-relative when it is field-kit-relative — and then generalized
  "not in the repo" into "does not exist anywhere"; and it read `%LOCALAPPDATA%` as the
  un-redirected `C:\Users\you\AppData\Local`, which is not where the kit lives.
- `hermes-test` was booted and a throwaway gateway stood up by hand instead of via the kit's
  script: scratch `HERMES_HOME` at `%TEMP%\hermes-m15r11-home`, `hermes serve --port 9141 --host
  127.0.0.1 --skip-build --isolated`. It came up — `HERMES_BACKEND_READY port=9141`, and
  `/api/health` returned `{"ok":true,"version":"0.21.0","auth_required":false}`. `hermes serve
  --stop` was never used (AGENTS.md records it as unscoped and fatal to every Hermes process on
  the machine).
- It stopped there, on a **third wrong conclusion**: that the 401s from `/api/cron/jobs` and
  `/api/cron/blueprints` meant device pairing was required. They did not. The hand-started
  gateway simply had no basic auth configured, so no dashboard session token could be minted;
  `setup-gw.sh` sets `HERMES_DASHBOARD_BASIC_AUTH_USERNAME`/`_PASSWORD` plus a pinned
  `_SECRET` precisely so that REST and the `/api/ws` token-mode dial work on loopback — which is
  what round 1 used (this log, round 1). Pairing was never needed. Corrected in round 12.

**All of task 2's pasted blocks are empty**: no POST payload from a wire trace, no job read back
from the gateway, no list/detail/New-task dp dumps, no "Running now" → last-run timestamped
dumps. Nothing about the Tasks tab has been seen running on a device.

**Task 3 (`npm run check`): exit 0**, run after `3a616f3` with a clean tree.

```
Ran 52 tests in 3.666s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

Vitest: **714 passed (71 files)**, against round 10's 660 — +50 `cron-schedule.test.ts`, +15
`task-format.test.ts`, minus the label-test case count shifting with the new files.

**Exit criteria touched.** None closed.

- *Tasks* — the screens now exist and `npm run check` is green, but the criterion is written in
  terms of device behaviour ("creating a task from a template posts the expected cron payload;
  the list shows next and last run; triggering it shows 'Running now' and then updates last
  run") and **none of that was observed**. Not met; no evidence.
- *Pairing*, *Banner*, *Gestures* — untouched, exactly as at the group B close.

**Round 10's carried items, status.**

- *Sheet scrim* — root-caused (both causes, above) and fixed in code. **Device-unverified.**
- *`CapabilitiesSheet` sub-48 dp toggles* — fixed in code. **Device-unverified**; the dump that
  would prove it is empty.
- *Swipe-down to dismiss a sheet* — correctly out of scope this round; still unexercised, still
  blocked by round 10's finding that no adb-injected gesture reaches RN's JS responder system on
  this emulator. Moves to group E with its own test plan.
- *`app/dev/` release-path gate* — unchanged, still code-verified only.
- *Two sub-48 dp inputs on the old cron screen* — moot: that screen is now a `<Redirect>` and the
  inputs are gone with it. The replacement's touch targets are **unmeasured**.

### Round 12 — round 11's claims corrected; sheets and Tasks tab device-verified, five fixes (2026-09-16)

Branch `m15-bots-mobile-ux`, from `9de462a`. Six commits: `bf84a78` (task 0 correction), `7f7d371`,
`4781d18`, `ee5ecdc`, `565575d` (fixes found by verification), plus this log.

Evidence: `%LOCALAPPDATA%\hermes-android-field\m15-r12\` — 60+ dumps, screenshots, the wire trace,
`setup-gw.log`, `metro.log`.

**Task 0 (environment): done. Three round-11 claims were false, all mine.** Commit `bf84a78`.

The field kit was there the whole time, at
`C:\Users\you\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\hermes-android-field\`
— 20 round folders, `m14-device/setup-gw.sh`, `m15-r10/` with its 24 files.

Why round 11 missed it: `%LOCALAPPDATA%` in this shell resolves to the **un-redirected**
`C:\Users\you\AppData\Local`, which is not where the kit lives. Earlier rounds ran with
the MSIX container's merged view, where `Packages\Claude_*\LocalCache\Local` overlays
`AppData\Local`, so the same path string reached the kit for them and missed it here.
Independently, `setup-gw.sh` was searched for only inside the *repo* — the brief's
`m14-device\setup-gw.sh` was read as repo-relative when it is field-kit-relative — and "not in the
repo" was then written up as "does not exist anywhere". Two different mistakes, same wrong
conclusion.

```
$ echo "LOCALAPPDATA=$LOCALAPPDATA TEMP=$TEMP"
LOCALAPPDATA=C:\Users\you\AppData\Local TEMP=C:\Users\COMPUT~1\AppData\Local\Temp
```

Note the split that matters for the script: `hermes-android-field` lives under the LocalCache
overlay, but `hermes` (with `bin/hermes.exe` and `.env`) lives under the real `AppData\Local`.
`setup-gw.sh` uses `$LOCALAPPDATA` for **both** (`DIR` at :2, `REAL`/`H` at :5 and :24). Running
it with `LOCALAPPDATA=C:/Users/you/AppData/Local` works because `DIR` is only ever
*written* to; that directory was created rather than the kit being moved or a junction added.

**The 401s were not pairing.** Round 11's hand-started gateway had no basic auth, so no dashboard
session token could be minted. `setup-gw.sh` sets
`HERMES_DASHBOARD_BASIC_AUTH_USERNAME`/`_PASSWORD` plus the pinned `_SECRET` (:27-33). Signing in
at `POST /auth/password-login` with `{"provider":"basic","username":"tester","password":…}`
returns 200 and sets `hermes_session_at`; that cookie (or the same value as a `Bearer` token)
opens the whole cron surface:

```
=== cron REST, signed in (cookie jar) ===
GET /api/cron/jobs -> 200  bytes=1059
GET /api/cron/blueprints -> 200  bytes=21631
GET /api/cron/delivery-targets -> 200  bytes=391

=== same endpoints WITHOUT the cookie (round 11's state) ===
GET /api/cron/jobs -> 401
GET /api/cron/blueprints -> 401
```

Pairing was never needed.

**Task 1 (sheet fixes from `434c3cc`): (a) and (c) device-verified; (b) NOT met.**

- **(a) Scrim — verified.** The backdrop now renders as a full-screen node,
  `[0,0][1080,2400] 411.4x914.3dp 'Close'`, in every sheet dump; in round 10 it never appeared at
  all. Visually dimmed behind the sheet (`14-newtask-sheet.png` — the list header behind it is
  visibly greyed). Nested dismissal works one level at a time: from `BotSettings → Capabilities`,
  one backdrop tap at (540,200) returned to `BotSettingsSheet` (its `Model` row present again),
  a second closed it back to the chat (`Bot settings` header button present).
  `54..56-*.xml`.
- **(c) Keyboard cap — verified** on the tallest sheet, `BotSettingsSheet` with the soul editor
  focused. Keyboard down, the editor sits at `y 1345–1732`. With `mInputShown=true` it lifts to
  `y 677–1064` and the sheet's header `Close` is at `y 243–369` — both fully on screen, the header
  not pushed off the top, which is exactly what round 11's `windowHeight - keyboardInset` cap was
  for. `57-soul-closed.xml`, `58-soul-keyboard.xml`.
- **(b) Capabilities 48 dp — NOT met, and round 11's fix for it did not work.** See `565575d`.
  `pointerEvents`/`importantForAccessibility` are applied by `ReactViewGroup`, and RN's `Switch`
  renders a native `AndroidSwitch` that is not one, so round 11's props on the Switch were
  silently ignored. Moving them to a wrapping `View` fixes the **touch** half — confirmed by
  tapping the label (x=300) and the Switch itself (x=977) and getting the same row toggle either
  way, and by the save round-tripping (`browser` gone from `enabled_toolsets` in
  `profiles/coder/config.yaml`). The **accessibility node** survives all three attempts tried
  (props on the Switch; props on a wrapping View with `no-hide-descendants`; `accessible={false}`
  + `focusable={false}`): `uiautomator` still reports one `Switch 46.5x27.0dp clickable=true` per
  row. So the behaviour the rule protects is correct and the criterion as written is not met.
  Removing the node needs the native `Switch` to stop being rendered — a View-drawn toggle — which
  is a control rewrite, deliberately not started at the end of a verification round.

**Task 2 (Tasks tab, `3a616f3`): device-verified, with four fixes found.**

- **(a) Drawer and redirects — verified.** Drawer row three reads `Tasks`
  (`[0,490][787,616] 299.8x48.0dp`) and opens `/(main)/tasks`. The old `/(main)/cron` routes were
  **not** re-exercised as deep links this round — Deviation 17's redirect is still code-only.
- **(b) List — verified (dark theme only).** Rows carry name, schedule in words, next and last
  run, and the state label, with the two Field counters above them:

  ```
  'RUNNING NOW' '0'        'SCHEDULED' '2'
  'Morning inbox digest'  'scheduled'
  'Every day at 9:00 AM · 0 9 * * *'
  'Next Sep 17, 2026, 9:00 AM · last —'
  'Morning briefing'      'scheduled'
  'Every day at 8:00 AM · 0 8 * * *'
  'Next Sep 17, 2026, 8:00 AM · last —'
  ```

  This is the `cron-schedule.ts` port doing real work: the gateway returns
  `schedule_display: "0 9 * * *"` and the row reads "Every day at 9:00 AM · 0 9 * * *".
  **Light theme was not captured — that half of (b) is not done.**
- **(c) Exit criterion — two thirds met, one third not reachable.**
  - *Create from a template — met.* Wire trace through a logging proxy on 9142:

    ```
    --- POST /api/cron/blueprints/instantiate
    body: {"blueprint":"morning-brief","values":{"time":"08:00","deliver":"origin"}}
    <-- 200 {"id":"24e0fd2f07f8","name":"Morning briefing",...,
             "schedule":{"kind":"cron","expr":"0 8 * * *","display":"0 8 * * *"},
             "schedule_display":"0 8 * * *",...}
    ```

    Read back from the gateway (`18-job-readback.txt`): `deliver: "origin"`, `enabled: true`,
    `state: "scheduled"`, `next_run_at: "2026-09-17T08:00:00+05:00"`, `last_run_at: null`.
    `model` was then pinned to `deepseek-v4-flash` over REST, because **the New task sheet has no
    Model row** — the prototype draws one (`tasks.html:311-315`) and round 11 did not build it.
    Recorded as a gap, not fixed this round.
  - *List shows next and last run — met.* After the trigger the row read
    `'Next Sep 17, 2026, 8:00 AM · last today 6:26 PM'`, matching the gateway's
    `last_run_at: 2026-09-16T18:26:25+05:00`.
  - *"Running now" — NOT met, and not reachable through this API.*
    `effective_job_state()` (`../hermes-agent/cron/jobs.py:488-501`) can only return `completed`,
    `error`, `paused` or `scheduled`. The only `running` in `cron/` is `scheduler.py:691`'s
    `get_inflight_guard_stats()`, an in-memory probe snapshot of `_running_job_ids` that no
    `/api/cron/*` route exposes. Polling the gateway directly every 1.5 s across a whole run
    confirms it: `state` stays `'scheduled'` and `last_run_at` is stamped at *dispatch* time. The
    client's `jobState()` port is faithful (`job-state.ts:16-20`); the data does not exist on this
    surface. Needs either a new host surface or a different signal, and is a decision to take
    rather than code to write.
- **(d) Plain-language echo — verified, both cases.** `0 9 * * *` → `'Every day at 9:00 AM'` next
  to `'0 9 * * *'`. `*/7 * * * *` → the echo row reads `'*/7 * * * *'`, the raw expression, with no
  sentence at all. `16-echo-undescribable.xml`.
- **(e) Detail edit and delete — verified.** Prompt edited in place → `PUT /api/cron/jobs/
  b32ddbff8455` with `body: {"updates":{"prompt":"Write a haiku about scheduled jobs. Edited by
  R12."}}`, and the gateway read back exactly that. Delete under the destructive-tap rule: fresh
  dump, confirm dialog read before confirming — `'Delete cron job?'` / `'This will remove R12
  heartbeat permanently. It will stop firing immediately.'` / `CANCEL` / `DELETE`, destructive
  last, naming the throwaway and not another job. After confirming, `DELETE /api/cron/jobs/
  b32ddbff8455` on the wire and the gateway lists only the two remaining jobs.
- **(f) dp dumps — partially done.** New task sheet: 12 clickable nodes, **0 under 48 dp** after
  `7f7d371` (`15-newtask-fixed.xml`). List: 5 nodes, 0 under 48 dp (`27-list-three.xml`). Detail:
  5 nodes, 0 under 48 dp (`20-detail-dark.xml`). All dark theme; **no light-theme pass**.

**Four defects found by verification and fixed.**

1. `7f7d371` — **the second footer button was off-screen.** `Button`'s `block` is `width: '100%'`
   (`ui/Button.tsx:93-95`); two in a row ask for 200%. "Create cron" measured
   `[1059,2191][1080,2317] 8.0x48.0dp` — an 8 dp sliver, unreachable. Same defect in the detail
   screen's two action rows. Fixed with the call-site `flex: 1` the four older sheets already use.
   After: Cancel `185.9x48.0dp`, Create cron `185.5x48.0dp`.
2. `4781d18` — **Trigger now left the list stale**, because `refresh()` never invalidated
   `['cron-jobs', profile]`. And **"Custom" was rendered as a field label** in both the detail grid
   and the sheet's picker row; `scheduleLabels.*` names the *kind*, never the field.
3. `ee5ecdc` — **no polling**, though the prototype specifies it for both the list (`:40`) and the
   open detail (`:45-46`). `POST .../trigger` returns at *dispatch*, so the invalidation on its
   success still reads `last_run_at: null`; the run finished ~40 s later and the screen sat on
   "LAST —". With a 5 s detail poll:

   ```
   18:42:07  BEFORE  LAST='today 6:38 PM'  RUN_HISTORY='2'
   18:42:07  TAP Trigger now
   18:42:10  LAST='today 6:38 PM'  RUN_HISTORY='2'
   18:42:16  LAST='today 6:42 PM'  RUN_HISTORY='3'
   ```
4. `565575d` — the Capabilities touch target, above.

**Task 3 (`npm run check`): exit 0**, after `565575d`.

```
Ran 52 tests in 3.666s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

Vitest 729 passed (71 files) — unchanged from round 11; this round added no tests, only fixes to
screens that have none.

**Exit criteria touched.**

- *Tasks* — **not met.** Two of its three clauses are now device-verified (template create posts
  the expected payload; the list shows next and last run) and the third, "Running now", is not
  reachable through `/api/cron/*` at all, for the host-side reason above. Not a client defect and
  not closable by this app alone.
- *Pairing*, *Banner*, *Gestures* — untouched.

**Carried items, status.**

- *Sheet scrim* (round 10 → 11) — **fixed and device-verified.** Closed.
- *Capabilities switch under 48 dp* (round 10 → 11) — **still open.** Touch behaviour correct,
  accessibility node still sub-48 dp; needs a View-drawn toggle.
- *Keyboard cap on tall sheets* (round 11) — **fixed and device-verified.** Closed.
- *`AppDrawer`'s zero-height backdrop* (round 11, out of scope) — **still open, unchanged and
  untouched.** `src/components/AppDrawer.tsx:142-144` still carries only a `backgroundColor`, so
  the drawer's scrim does not dim and its tap-to-close `Pressable` is zero-sized. Recorded only.
- *Swipe-down to dismiss a sheet* — still unexercised, still group E.
- *`app/dev/` release-path gate* — unchanged, code-verified only.

**Not done this round, named rather than implied.** Light-theme dumps and screenshots for the list,
detail and New task sheet; re-exercising the `/(main)/cron` deep-link redirects on device; a Model
row in the New task sheet.

### Opus review, group C closed (2026-09-16)

Opus checked rounds 11 and 12 against their commits, evidence folders and host state. `npm run check`
at `455a351` exits 0 (729 tests), and `src/upstream/` is still byte-identical to `4363d9e`. Round 12
corrected round 11's false environment claims in `bf84a78`: the field kit and round 10's evidence
were there all along, at `C:\Users\you\AppData\Local\hermes-android-field\`.

**Ticked:**
- **Cron data layer.** Templates came from M14; round 1 added `getCronDeliveryTargets`.
- **Tasks tab.** Built in round 11 and device-verified in round 12, which fixed four defects:
  an off-screen Create button, a stale list after trigger, a mislabelled schedule field, and the
  missing polling.
- **Tasks exit criterion, under D19.** Round 12 showed on device:
  - the template-create POST payload, read back from the gateway
  - next and last run on the list
  - a trigger updating last run
  - prompt edit and delete, read back from the gateway

  "Running now" can't be shown by either client, because the gateway never reports
  `state: "running"`. D19 makes that part conditional on the gateway reporting it.

**Carried forward; must be done before M15 is `done`:**
1. **Capabilities toggle, 48 dp literal.** Tapping anywhere on the row now works (`565575d`), but
   the native `AndroidSwitch` still shows up as a 46.5×27 dp node in the accessibility dump. The
   fix is a toggle drawn with a plain `View`, or proof that the node isn't clickable.
2. **Tasks light-theme pass, and an on-device check of the old `/(main)/cron` deep-link
   redirects.** Both are code-verified only so far.
3. **Swipe-down on sheets** belongs to group E (Gestures).

**Noted, not required:** `tasks.html:311-315` draws a Model row in the New task sheet. M15's task
text doesn't list one, and round 12 set the model over REST instead. Add it if parity wants it.
`AppDrawer`'s zero-height backdrop is still open and out of scope.

### Round 13 — group D built; pairing criterion met, but a connect regression blocked the rest (2026-09-16)

Branch `m15-bots-mobile-ux`, merged from `origin/main` (`daed1ac`, D19 only, clean). Commits:
`1a33f92`, `c9f14db`, `1e64ca8`, `c4d1bf6`, `459ca6b`.

Evidence: `…\hermes-android-field\m15-r13\`.

**The headline, first: I introduced a regression in this round's connect changes and did not
root-cause it, and it cost most of the round's device verification.** "Detect auth mode" no longer
invokes its handler. The node is present, `clickable='true'` and `enabled='true'`
(`18-detect-instrumented.xml`), a tap on the neighbouring "Scan QR" in the same row navigates
fine, and an instrumented `console.log` as the first statement of `detect()` **never printed** —
so `onPress` is not firing at all. The only thing this round added to that control is
`disabled={detecting || !guard.ok}` and an `opacity`, and the guard itself is provably happy at
that moment (the destructive error is absent and the neutral hint renders, which is the `guard.ok`
branch). Suspect is that `disabled` expression or the closure it captures; not proven, so not
claimed. The instrumentation was reverted, not committed.

Consequence: **no throwaway connection could be established through the connect screen**, and
tasks 1a, 1b and 4 all need one. They are not attempted-and-failed; they are blocked behind this.

**Task 0 (merge): done.** `git fetch origin && git merge origin/main` → "Merge made by the 'ort'
strategy", one file, `project-planning/DECISIONS.md | 18 ++++++`. Exactly the expected D19 commit
`c2c6c46`. No conflict, no rebase, no force.

*One environment mismatch, same as round 12.* The brief's absolute path
`C:\Users\you\AppData\Local\hermes-android-field\m14-device\setup-gw.sh` does not hold in
this shell:

```
$ ls -la "/c/Users/you/AppData/Local/hermes-android-field/m14-device/"
total 0
drwxr-xr-x 1 you 197121 0 Sep 16 19:04 .
```

— that directory is the empty one round 12 created. The real kit is behind the MSIX LocalCache
overlay:

```
$ ls -l ".../Packages/Claude_pzs8sxrjxfjjc/LocalCache/Local/hermes-android-field/m14-device/setup-gw.sh"
-rwxr-xr-x 1 you 197121 2167 Sep 15 17:59 …/m14-device/setup-gw.sh
```

Ran it with `LOCALAPPDATA=C:/Users/you/AppData/Local` (where `hermes/bin/hermes.exe`
lives) and `TEMP` exported; it came up first time: `SETUP DONE`, `HERMES_BACKEND_READY port=9128`.

**Task 1a (Capabilities toggle): fixed in code, NOT device-verified.** Commit `1a33f92`.

First, the thing the task asked for as an alternative — proving the node isn't clickable — is
**disproved**. Round 12's saved dump has two nodes at identical bounds, and the widget is clickable:

```
[916,742][1038,813] class=android.view.ViewGroup   clickable=false   (the pointerEvents wrapper)
[916,742][1038,813] class=android.widget.Switch    clickable=true    (46.5x27.0 dp)
```

So the View-drawn route was the only one left. `src/components/ui/Switch.tsx` already existed as
an M14 primitive but wraps itself in a `Pressable` — a 44×26 dp node, itself under the minimum —
so its track and thumb were split out as `SwitchIndicator`, two plain `View`s with no
accessibility identity, and `Switch` now composes it. `CapabilitiesSheet`'s rows render the
indicator, leaving the 48 dp row as the only node.

**The dp dump proving it is empty — not captured.** Reaching that sheet needs a bot roster, which
needs a gateway connection. Blocked by the regression above. Likewise the tap-to-toggle and the
`profiles.describe` readback.

**Task 1b (Tasks in light theme): not attempted.** Same blocker. Empty.

**Task 1c (cron deep-link redirects): done and device-verified.** The one carried item that needs
no connection.

- `hermes-android:///cron` → the Tasks screen: `'Scheduled jobs'`, `'No scheduled jobs yet'`,
  `'Schedule a prompt to run on a cron expression…'`, action `'New task'` (`20-deeplink-cron.xml`).
  That is `app/(main)/tasks/index.tsx`'s empty state; the old cron screen had a manual create form
  and a "Create cron" button, neither of which is present.
- `hermes-android:///cron/05597b82f881` → the Tasks **detail** route, which then requested
  `/api/cron/jobs/05597b82f881` and rendered its error state, `'HTTP 404 …'` with `Back`/`Retry`
  (`21-deeplink-cron-id.xml`). The 404 is expected — the app was still pointed at the user's own
  connection, which has no such job — and it is itself the proof that the id survived the redirect
  into the new screen's query. Deviation 17 holds on device.

**Task 2 (pairing): built, and the exit criterion is device-verified.** Commits `c9f14db`,
`459ca6b`.

`:start` renders the two entry cards plus "This computer" — 3 clickable nodes, 0 under 48 dp
(`01-connect-start.xml`). `:steps` renders the three steps, the checklist and the guide link
(`02-connect-steps.xml`, `11-steps-checklist-fixed.xml`).

The criterion, in full:

| input | path | result |
| --- | --- | --- |
| `http://127.0.0.1:9119` | Tailscale | rejected — *"That address is this phone, not your computer. “127.0.0.1” points back at the phone itself, so there is nothing here to test."* Detect gone from the clickable set. `04-reject-127.xml` |
| `http://10.0.2.2:9119` | Tailscale | rejected — *"…“10.0.2.2” is the emulator's alias for the machine running it, not a tailnet address…"* Detect gone. `05-reject-10022.xml` |
| `http://myhost.tail1234.ts.net:9119` | Tailscale | **not rejected**; no error, Detect present and clickable again. `06-tailnet-accepted.xml` |
| `http://10.0.2.2:9128` | Enter a URL | **not rejected** — the mode split, on device. `13-10022-allowed-on-url-path.xml` |

That last row is the one place this differs from a literal reading of "hard-reject 10.0.2.2", and
it comes from the prototype rather than from me: connect.html's Behaviour block says 10.0.2.2 is
rejected on the Tailscale path "(M15 exit criterion)" but "on the 'Enter a URL' path it is
allowed, because on an emulator it IS the computer", and that path's own card offers "an emulator
host" as a valid answer. Flagged rather than silently chosen.

*What is NOT shown:* the tailnet URL proceeding to a detection **result**. It is not rejected and
Detect is enabled, which is what the criterion asks. The probe's outcome was never observable,
because of the same regression — so "proceeds to detection" is verified as *permitted*, not as
*executed*.

`::1`, the rest of `127.0.0.0/8`, and `0.0.0.0`/`::` are all rejected too, with their reasons in
`src/net/gateway-url-guard.ts`'s comments and 42 unit tests. Briefly: the whole `/8` is loopback
per RFC 1122 and the kernel honours it, so `127.0.0.2` is the same mistake; `::1` is the same
address in IPv6; `0.0.0.0` and `::` are *bind* addresses meaning "every interface", which is
exactly why they get typed in (`hermes serve --host 0.0.0.0` is a real command) and which route to
the local host when dialled. `localhost` and anything under it go too (RFC 6761 §6.3).

`src/net/auth/loopback-listener.ts` and `native-login.ts:164` keep using `127.0.0.1` for the RFC
8252 redirect — the phone listening on *itself*, which is correct — and the guard deliberately
does not apply there.

**Task 3 (`docs/CONNECTING.md` host section): done, documentation only.** Commit `1e64ca8`.
Nothing was run against this machine's services.

Windows Task Scheduler / macOS LaunchAgent / Linux systemd user unit, each with the caveat that
actually bites (run-whether-logged-on, LaunchAgent stopping at logout, `loginctl enable-linger`).
Every flag and key carries its upstream `file:line`; the load-bearing ones:

- `should_require_auth` (`hermes_cli/web_server.py:443-450`) — *"True iff the auth gate must be
  active: any non-loopback bind"*, with its own docstring recording that RFC1918/CGNAT/link-local
  are *"deliberately PUBLIC — a hostile LAN device is the threat model"* and that `--insecure` is
  *"accepted for old launch scripts but IGNORED"*. That is D13.3's rule, quoted rather than
  paraphrased.
- The bind is refused outright without a provider (`web_server.py:1054-1056`).
- The required secret: `_resolve_secret` (`plugins/dashboard_auth/basic/__init__.py:191-202`)
  logs at **INFO** and carries on when it is unset, so the failure is silent on the host and lands
  on the phone as a 401 that looks like a bad password.

One correction to the prototype, also applied to the in-app checklist (`459ca6b`): its third line
`hermes auth add password --user tester` is not a real command — `hermes auth add <provider>` is
*"Add a pooled credential"* (`hermes_cli/_parser.py:73`), for model-provider API keys.

**Task 4 (connection banner): built, NOT device-verified.** Commit `c4d1bf6`.

What `src/chat/ConnectionBanner.tsx` already did, read before extending it: subscribed to
`onGatewayConnectionState`, returned `null` for `idle`/`open`, and otherwise rendered one of two
vendored `boot.*` lines — `retryingRemoteBackend` vs `gatewayConnectionLost` — with no cause and
no action. 77 lines, no `Pressable` anywhere (`:33-57` before this round).

Extended, not duplicated. The cause now arrives: M04's ladder was already classifying, but
`describeConnectReason(reason)` was only ever *thrown* (`session-connection.ts:391`,
`mobile-gateway.ts:86`), so it reached whichever call site was in flight and nowhere else — a
banner cannot read a rejected promise. `session-connection.ts` now publishes a
`ConnectionAttention` signal beside the existing state fan-out; `needs-login` outranks
`unreachable` and a close never downgrades it. "Sync now" goes through
`reconnectAndProbeGateway()` and then asks the owning screen to re-resume; the chat screen passes
`refreshConversation`, which is already the Deviation 5 path (`resumeSession(id, title, botId)`).
A 401 gets "Sign in again" instead, because a redial cannot fix an expired credential.

**All three of its pasted blocks are empty** — no "unreachable", no "sign in again", no "Sync now
clears it". Every one needs the throwaway connection.

**Task 5 (`npm run check`): exit 0**, after `459ca6b`.

```
Ran 52 tests in 3.673s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

Vitest 771 passed — 729 plus 42 new `gateway-url-guard.test.ts`.

**Exit criteria touched.**

- **Pairing — met.** `127.0.0.1` and `10.0.2.2` rejected with the reason on screen; a
  tailnet-shaped URL not rejected and Detect enabled. Evidence in the table above.
- **Banner — not met, no evidence.** Built and code-verified only.
- *Tasks*, *Gestures* — untouched.

**Carried items.**

- *Capabilities switch under 48 dp* — code fix landed (the widget is gone), **device-unverified**.
- *Tasks light theme* — **not attempted**.
- *Cron deep-link redirects* — **done, device-verified.** Closed.
- *`AppDrawer`'s zero-height backdrop* (`src/components/AppDrawer.tsx:142-144`) — still open,
  untouched, out of scope as instructed. Recorded only.

### Round 14 — field kit moved off the MSIX overlay; Detect regression root-caused and fixed; Banner, Capabilities and Tasks-light device-verified (2026-09-16)

**Task 0 (move the field kit off the MSIX overlay): done.** The kit at
`C:\Users\you\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\hermes-android-field`
(2308 files, 262,024,667 bytes, 29 directories) was copied — not moved — to
`D:\Stuff\hermes-android-field` with `robocopy /E`. Both sides verified equal on file count,
directory count, and total bytes. Nothing in the overlay was deleted. `setup-gw.sh`'s `DIR` now
points at `/d/Stuff/hermes-android-field/m14-device`; `SCRATCH` is untouched and still resolves
under `$TEMP`.

**The MSIX finding, confirmed and narrower than rounds 12–13 wrote it up.** Round 12 attributed
the round-11 misses to *which shell session* was used, reasoning that "earlier rounds ran with the
MSIX container's merged view" as if it were session-dependent. The actual boundary is *which
process*, not which shell: any process running under the Claude app's package identity — including
this session's own Bash and PowerShell tool calls — sees `%LOCALAPPDATA%\hermes-android-field` and
`C:\Users\you\AppData\Local\hermes-android-field` both resolve, via Windows' per-package
VFS redirection, to the merged overlay view (confirmed: `ls` through this session's Bash tool on
either path lists the full kit, `m14-device` included). WSL is not such a process — it is a
separate OS-level environment outside that virtualization entirely — so the identical path string
resolves for it to the real, un-virtualized NTFS directory, which holds only the empty
`hermes-android-field/m14-device` stub round 12 created:

```
$ wsl -d Ubuntu-26.04 -- bash -c "ls /mnt/c/Users/you/AppData/Local/hermes-android-field/m14-device/ | wc -l"
0
```

against the same path, copied to `D:\Stuff\hermes-android-field` (not virtualized, not under a
package-owned prefix), which WSL lists in full — `m14-device`'s 101 files (`find -type f | wc -l`), including
`setup-gw.sh`, `seed-host.sh`, and every round's dumps.

This is what rounds 11–13's "missing path" reports were actually hitting: any tool or process
outside the Claude app's own virtualization — WSL foremost, but potentially any externally-spawned
shell too — reads straight through the overlay to the real, mostly-empty directory tree and
reports it as missing or empty, correctly, for what it can see. It was never a wrong env var or a
wrong guess at `%LOCALAPPDATA%`; it is a hard visibility boundary that no amount of path-fixing
from inside the app's own shell could have caught, because that shell was never the one failing.
The fix is the move in this task, not a corrected path — D: is real, unvirtualized storage, so
every process, inside the package or out, now sees the same bytes.

*One inconsistency in the above, recorded rather than smoothed over:* mid-round, this session's own
Bash tool listed `$LOCALAPPDATA/hermes-android-field` (top level) successfully but then failed to
`ls` `$LOCALAPPDATA/hermes-android-field/m15-r13` specifically ("No such file or directory"), even
though that directory was present in the overlay per the very first `Get-ChildItem` of this round.
The D: copy resolved it immediately. So the "any in-package process sees the merged view" claim
above is not perfectly clean — some nested paths through the overlay were flaky for this session's
own tools too, not just for WSL. Not root-caused; flagged as a further reason D: is now the only
place evidence lives, rather than pursued further.

**Task 1 (the "Detect auth mode" regression): root cause found, proven on device exactly as
prescribed, fixed.** Commit pending.

Read `app/connect/index.tsx:284` before touching anything: the screen's one `ScrollView` wrapped
every step (`:start`, `:steps`, `:url`) and carried no `keyboardShouldPersistTaps`, so it defaulted
to `'never'` — RN's documented behaviour there is that the *first* tap outside a focused
`TextInput` is consumed dismissing the keyboard, and only a second tap reaches the touched child's
`onPress`.

Proof, both halves, against the throwaway gateway's Metro (`CI=1`), with a one-line
`console.log('ROUND14_DETECT_FIRED')` as `detect()`'s first statement, reverted before committing:

- **(a) keyboard open:** typed `http://myhost.tail1234.ts.net:9119`, left the IME up
  (`mInputShown=true`), tapped Detect. `mInputShown` went `true` → `false` (the OS dismissed the
  keyboard) but Metro's log gained **zero** new lines — `detect()` never ran.
- **(b) keyboard already down:** same URL, no further typing, tapped Detect again. Metro printed
  `ROUND14_DETECT_FIRED` immediately.

(a) failed and (b) fired — the hypothesis held. Fix: `keyboardShouldPersistTaps="handled"` added to
the `ScrollView`. Re-ran (a) after the fix: typed the URL fresh, kept the keyboard up, tapped
Detect — `ROUND14_DETECT_FIRED` printed **with the keyboard still open** (`mInputShown` stayed
`true` this time), and the probe proceeded to a real network attempt: `"Could not reach that Hermes
gateway. Couldn't find that host — check the address."` against the fake hostname. Evidence:
`m15-r14/25-*` through `m15-r14/33-*`.

*One environment trap this proof surfaced, worth recording so it isn't re-discovered at cost next
round:* `CI=1` Metro doesn't just disable Fast Refresh — its delta/update graph stops tracking file
changes at all, because that tracking rides on the same file watcher `CI=1` turns off. A force-stop
+ cold relaunch of the app is **not** enough to pick up an edit; the dev client requests an
incremental update relative to a revision it already holds, and Metro serves that delta without
re-checking the edited file on disk. The first attempt at proving the fix (`edit → force-stop →
relaunch → tap`) silently replayed the *pre-fix* behaviour twice before this was caught — confirmed
by directly requesting `/app/connect/index.bundle` over HTTP, which forced Metro to read the file
fresh and did contain the fix. **Killing and restarting the Metro process itself** (not just the
app) before every fresh-bundle check was the only reliable fix; every result reported for task 1 and
task 3 is from a bundle the (twice-restarted) Metro process built after the corresponding edit.

**Audit of every other `ScrollView`/`FlatList` holding a `TextInput` plus a button, as instructed.**
Six screens total carry the pattern; five besides the one above had the identical missing default,
all fixed the same way:

| file:line | what's in it |
| --- | --- |
| `app/connect/index.tsx:284` | URL field, Detect / Scan QR — the one proven above |
| `app/connect/[id]/login.tsx:166` | username/password fields, Sign in |
| `app/(main)/settings/providers.tsx:199` | per-row API-key `TextInput`, Save |
| `app/(main)/settings/connections.tsx:183` | connection label edit (submits via `onSubmitEditing`, but shares the ScrollView with other buttons — see below), Remove/Sign out |
| `app/(main)/settings/mcp.tsx:122` | name/target fields, Add server |
| `app/(main)/webhooks/index.tsx:106` | name/prompt/events fields, Create |

`connections.tsx`'s own label field saves on IME submit rather than a separate button tap, so its
specific edit flow was never exposed to this bug — but the same `ScrollView` also holds each card's
Remove/Sign out/Test buttons, which a focused label edit elsewhere on screen would still have
swallowed the first tap on; fixed for consistency and because it carries the same missing default,
not because its own save button was provably broken.

**Not part of the audit, but hit live while proving task 3c and fixed anyway** — see task 3 below;
a second, unrelated bug in `app/(main)/sessions/[id].tsx`'s "Sign in again" wiring.

Every `TextInput`+button surface that lives inside `src/components/ui/Sheet.tsx` (`BotSettingsSheet`,
`NewTaskSheet`, the new-bot sheet in `app/(main)/bots/index.tsx`, `CapabilitiesSheet`) was **not**
affected — `Sheet.tsx:245` already sets `keyboardShouldPersistTaps="handled"` on its own internal
`ScrollView`, centrally, for every sheet at once. Confirmed by reading the primitive rather than
assumed.

**Task 3 (finish round 13's device verification): done, device-verified, against a throwaway
gateway on `http://10.0.2.2:9128`.** Evidence: `D:\Stuff\hermes-android-field\m15-r14\` (100+
dumps/screenshots/logs). Never touched Hone beyond the unavoidable minimum (reading its session
list to find Settings, and once accidentally landing in one of its existing chats mid-navigation —
see below).

**3a (pairing).** A tailnet-shaped URL (`http://myhost.tail1234.ts.net:9119`) reached detection and
failed to connect exactly as expected — fake host, real DNS failure: `"Could not reach that Hermes
gateway. Couldn't find that host — check the address."` (`33-fixed-detect-result.xml/png`). Real
connection: `10.0.2.2:9128` on the **"Enter a URL" path** — `127.0.0.1:9128` was tried first and
rejected even on that path (`"That address is this phone, not your computer"`,
`38-before-real-detect.xml`), which is a genuine finding against this round's own brief (it names
"the adb-reverse 127.0.0.1 URL on that path" as an option): `gateway-url-guard.ts` rejects
`127.0.0.0/8` unconditionally, with no path-dependent exception the way it has one for `10.0.2.2`
(round 13's finding). `10.0.2.2` detected `basic` auth, signed in as `tester` with the scratch
password, reached "Connected". Registry log confirms: `[registry] active: conn-...-p1tt8f
(http://10.0.2.2:9128)`.

**3b (capabilities).** `wm density` → 420 (48dp = 126px). Every *visible* `Switch` row in the
Capabilities sheet measured 126–137px tall — at or over the minimum, none under
(`54-capabilities.xml`, `55-capabilities-scrolled.xml`). Two rows initially looked sub-threshold
(17px and a negative height) but both were scroll-clipped rows at the bottom edge of the sheet, not
real touch targets — `Sheet.tsx`'s own header comments document this exact
`AccessibilityNodeInfoDumper`-intersects-visible-bounds artifact from round 8. Scrolling them into
view and re-dumping showed the same 126–137px rows as everything else. Toggled "Speech-to-Text"
(was off) on; the Save-and-close round-trip is confirmed via the **host's own persisted config**
rather than a raw `profiles.describe` RPC call (the RPC needs a signed WS handshake this session
didn't script) — `profiles/coder/config.yaml`'s `tools.enabled_toolsets` gained `stt`, which is the
exact same data `profiles.describe` (RPC 5063, `src/api/bots.ts:187`) reads and returns to the app.
Named as an inference: the toggle reaching disk is observed directly; that `profiles.describe`
specifically would read it back is inferred from `bots.ts` rather than watched over the wire.

**3c (banner) — plus one genuine, previously-undiscovered bug found live.** All four states,
timestamped:

| state | cause | result | evidence |
| --- | --- | --- | --- |
| unreachable | `taskkill` on `hermes.exe` (throwaway gateway) at 22:53:29 | "Connection needs attention / Could not reach the host." at 22:53:43 | `60-banner-unreachable.xml/png` |
| 401 | deleted `.cookie-secret` before restarting the gateway, invalidating the session cookie already in the app | "The host rejected this phone's credentials. Sign in again to continue." at 22:54:21 (tapped Sync now at 22:54:17) | `62-401-result.xml/png` |
| restore + Sync now | host killed again live mid-chat (23:03:49), restarted **without** touching `.cookie-secret` this time (23:04:xx), tapped Sync now at 23:04:31 | banner gone by 23:04:36, no app restart | `96-*`, `97-after-sync-restore.xml/png` |
| re-resume carries the profile | same cycle, from an open `coder` chat with a message already in flight | transcript shows `"resumed interrupted turn"` immediately under the `coder` bot's own tool calls (`search_files`, `terminal`) — the resume used this session's bot context, not a generic reconnect | `97-after-sync-restore.png` (screenshot) |

**The bug found live:** the banner's own "Sign in again" (`app/(main)/sessions/[id].tsx:197-206`,
wired to `ConnectionBanner`'s `onSignIn`) pushes `/connect/[id]/login` with
`{ baseUrl, id, label }` — no `provider`. `login.tsx:102-105`'s `submit()` starts with `if (!baseUrl
|| !provider) { return }`, so **every tap on "Sign in again" from a live 401 silently did nothing**:
no error, no log, no network call — confirmed by tapping it three times against a gateway whose
password I'd already verified worked via a direct `curl` to `/auth/password-login` (200 OK). The
header even showed the tell: `"http://10.0.2.2:9128 · "` — a dangling separator with nothing after
it, versus `"· basic"` on the working (detect-flow) path, which does pass `provider`. Fix:
`provider: active.provider` added to the pushed params — `MobileConnection.provider` already exists
and is set on every successful login, so the value was sitting right there unused. This is separate
from task 1's regression and not something the round 14 brief asked me to look for; found only
because 3c's own re-resume step required a *live* 401 → sign-in-again cycle, which the earlier
device-verified 401 (task 3c's second row, from before this fix) never exercised.

One other real thing this surfaced, unrelated to any bug: hiding the IME with the hardware back key
does **not** blur a focused `TextInput` in this app — the password field kept its cursor after
`keyevent 4`, so the very next tap on "Sign in" was consumed by RN's own outside-tap blur handling
(same `keyboardShouldPersistTaps` mechanism as task 1, but triggered by focus state rather than
keyboard visibility) and needed a second tap to actually submit. Not a bug filed against; the
throwaway gateway I used for this only has a password that changes on every `setup-gw.sh` run
anyway, so a slow first tap costs nothing here — flagged because it means "hide the keyboard, tap
once" is not a safe assumption for scripting these screens even after task 1's fix, without
watching for it.

One accidental Hone touch: mid-navigation (stale coordinates from a previous dump, tapped before
re-dumping), one tap landed inside Hone's existing "Friendly greeting for mobile UI test" session.
No text was typed and no message sent — confirmed by dumping before any further action and backing
out via hardware back twice. Recorded per the reporting instructions rather than omitted.

**3d (Tasks, light theme).** List, detail, and New task sheet all screenshotted and dp-dumped under
`Appearance → Light`. No visual defects — text contrast, card borders and the destructive
"Delete" button all render correctly against the light surface. New task sheet's clickable nodes:
12 total, 0 under 126px (`108-new-task-light.xml`) — consistent with it living inside `<Sheet>`
alongside everything else the task-1 audit already covered.
`Evidence: 105-tasks-list-light.*, 106-task-detail-light.*, 108-new-task-light.*`.

**Task 4 (`npm run check`): exit 0**, run after every edit above.

```
Test Files  73 passed (73)
     Tests  771 passed (771)
...
Ran 52 tests in 3.668s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

(The `hermes-push` plugin test's printed `Traceback ... RuntimeError: boom` is expected output from
a test that deliberately mocks a failed push send — it's inside the 52-test `OK`, not a failure.)

**Exit criteria touched.**

- **Pairing — met, unchanged from round 13, now with a real connection behind it.** `10.0.2.2`
  detected, signed in, connected. `127.0.0.1` rejected on both paths (new information this round —
  the brief's assumption that it would be allowed via adb reverse on the "Enter a URL" path does
  not hold against the actual guard).
- **Banner — met.** All four states device-verified with timestamps, including the fix needed to
  make "Sign in again" work at all.
- **Capabilities switch under 48dp — met.** Carried from round 13 as code-fixed-but-unverified; now
  device-verified.
- **Tasks light theme — met.** List, detail, New task sheet all clean.
- *Gestures* — still untouched, out of scope this round.

**Carried items, status.**

- *`AppDrawer`'s zero-height backdrop* (`src/components/AppDrawer.tsx:142-144`) — still open,
  untouched, out of scope as instructed. Recorded only, again.
- *Cross-shell MSIX visibility flakiness noted above* (`m15-r13` briefly unreadable through this
  session's own Bash tool) — not root-caused; moot in practice now that D: is the working copy, but
  left open as a caveat on the "process, not shell" theory rather than closed.

**Teardown.**

- **(a) Hone restored, throwaway removed.** Switched to Hone via Connections (`"Switch to Hone"`),
  removed `http://10.0.2.2:9128` (confirmation dialog named the exact URL before deleting).
  Force-stopped, cold-launched via `monkey -c android.intent.category.LAUNCHER` (not the dev-client
  deep link). Registry log: `[registry] active: conn-...-cpgcec (Hone)` /
  `[registry] list: conn-...-cpgcec (Hone) primary=true needsLogin=false` — only Hone, landed on
  `Sessions`.
- **(b) Metro and gateway stopped; ports confirmed refusing.** `taskkill` on both PIDs (Metro
  17264, `hermes.exe` 4448 by that point — this round restarted both twice mid-round, see the
  CI-mode note above). `curl --max-time 3` against `127.0.0.1:8081` and `127.0.0.1:9128` both
  returned exit 7 (connection refused). No trace/logging proxy was used this round, so nothing else
  to stop.
- **(c) Scratch state deleted, each named.** `%TEMP%\hermes-m14-device-home` (the whole scratch
  `HERMES_HOME`, `.cookie-secret` included), `D:\Stuff\hermes-android-field\m14-device\
  scratch-password.txt`, and two `.bat` shims setup-gw.sh's profile creation left behind —
  `~/.local/bin/coder.bat` and `~/.local/bin/researcher.bat`. All four verified gone by a fresh
  `ls` after deletion (all four returned "No such file or directory").
- **(d) `adb reverse` empty; `font_scale` 1.0.** One wedge: the first `adb reverse --list` timed out
  at 20s. Per the standing rule, killed only the `adb.exe` server process (PID 12156, found via
  `tasklist`), not the emulator — `adb start-server` came back clean, `emulator-5554` still listed.
  `reverse --remove-all` then `reverse --list` both exit 0, list empty. `font_scale` was never
  touched this round; confirmed still `1.0`.
- **(e) Emulator shut down; AVD intact.** `adb emu kill` → `adb devices` empty.
  `emulator -list-avds` still lists `hermes-test`.
- **(f) Push and clean tree — pending**, immediately after this log entry is committed.

### Opus review, group D closed (2026-09-17)

Opus checked rounds 13 and 14 against their commits, evidence and host state. `npm run check` at
`176a008` exits 0 (771 tests), and `src/upstream/` is still byte-identical to `4363d9e`.

**Correction to Opus's own round-12 review.** Opus called round 11's "the field kit doesn't exist"
false. It was a view difference, not a fabrication. The Claude desktop app is an MSIX package, and
writes to `%LOCALAPPDATA%` from inside it land in
`...\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\`. Processes inside the package see that
overlay; WSL and processes outside it don't. Round 14 copied the kit to
`D:\Stuff\hermes-android-field\` (23 dirs, 2,445 files including round 14's evidence), and
`setup-gw.sh` now points there.

**Ticked:**
- **Pairing task and exit criterion.** Round 13 showed on device that `127.0.0.1` and `10.0.2.2`
  are rejected on the Tailscale step, with the reason shown. Round 14 took a tailnet-shaped URL
  through to detection once the Detect bug was fixed. The guard covers all of `127.0.0.0/8`, `::1`,
  `0.0.0.0`, `::` and `*.localhost` on both paths; `10.0.2.2` is rejected on the Tailscale path
  only (Deviation 18). 42 tests.
- **`docs/CONNECTING.md` host recipe.** Docs only, with every flag and config key cited to file:line,
  including the required `dashboard.basic_auth.secret` step.
- **Connection banner task and exit criterion.** Round 14 showed all four on device, timestamped:
  - "unreachable" when the host is killed
  - "sign in again" on a 401
  - "Sync now" clearing the banner without an app restart
  - a repeat from a bot chat, with the profile passed

  Round 14 also fixed "Sign in again" doing nothing (`fd1a32b`): it never passed the provider to the
  login screen.

**Real defect fixed on the way (`7f299d9`).** The connect screen's `ScrollView` had no
`keyboardShouldPersistTaps`, so the first tap after typing, with the keyboard still open, only
dismissed the keyboard. That blocked "Detect auth mode" for every user, and it predated M15.
Round 14 proved it both ways on device: with the keyboard open the tap failed, and with it hidden
the tap fired. `"handled"` fixed it. The same one-line fix went into five other screens (`connections`,
`mcp`, `providers`, `webhooks`, `connect/[id]/login`); those are code-verified only.

**Carried items from group C, now closed:**
- The Capabilities toggle is drawn with Views, and the dump shows no clickable node under 48 dp.
- The Tasks light-theme pass is done on list, detail and the New task sheet.
- The `/(main)/cron` deep-link redirects are verified on device.

**Still open before M15 is `done`:** group E (Gestures), including swipe-down on every sheet, which
the round-10 regression pass couldn't inject with adb.

**Open product question, not blocking M15:** the guard rejects `127.0.0.1` on the "Enter a URL" path
too, following `connect.html`'s "Never enter 127.0.0.1 … on your phone". That's right for a phone
reaching a computer, but it blocks a gateway running on the phone itself (e.g. Termux). Decide
whether that deployment is supported before M12.

### Round 15 — group E (Gestures): edge-back device-verified everywhere, sheet swipe-down still
### uninjectable after a real attempt, tab row built and swipe device-verified (2026-09-17)

**Scope.** M15's last open group, per the Opus close-out above: "group E (Gestures), including
swipe-down on every sheet, which the round-10 regression pass couldn't inject with adb." Against a
fresh throwaway gateway (`m14-device/setup-gw.sh` unchanged, port 9128, two seeded profiles
`researcher`/`coder`, `auth_required: true`), the same `hermes-test` hardware-accelerated AVD every
prior round used (never destroyed). Evidence: `D:\Stuff\hermes-android-field\m15-r15\` (~100
screenshots/dumps/logs, numbered by capture order).

**Task 0 (test plan, written before any code).** For each gesture: which layer handles it, whether
adb injection can reach that layer, and what counts as proof.

| gesture | layer | file:line | injectable? |
| --- | --- | --- | --- |
| edge-swipe back | `react-native-screens`' native stack `Screen`, default `gestureEnabled: true` (Fabric codegen), no override anywhere in this app | `node_modules/react-native-screens/src/fabric/ScreenNativeComponent.ts:101`; `app/_layout.tsx:43`, `app/(main)/_layout.tsx:8` (`Stack screenOptions={{ headerShown: false }}`, no `gestureEnabled` key) | **untested going in** — round 10 never tried it, only sheet swipe-down |
| sheet swipe-down | JS `PanResponder` (`Sheet.tsx`) | `src/components/ui/Sheet.tsx:173-189` | **no**, per round 10 (`input swipe`, `draganddrop`, hand-built motionevent DOWN/MOVE/UP, all silent) |
| tab swipe | did not exist; built this round | `src/components/TabStrip.tsx` (new) | unknown going in — same open question as the sheet |
| predictive-back manifest flag | Expo config plugin, generates the native manifest attribute at prebuild time | `app.config.ts` (`android.predictiveBackGestureEnabled`), `node_modules/@expo/config-plugins/build/android/PredictiveBackGesture.js:34-37`, `android/app/src/main/AndroidManifest.xml:19` | n/a — a manifest attribute, not a gesture; proof is reading the generated XML, not injection |

Proof standard: for anything injection reaches, a screenshot before and after the injected gesture,
with the screen identity (header text / route) visible in both. For anything it doesn't, say so
plainly and add it to the manual checklist at the end rather than mark it done.

**Task 1 (predictive back): config fixed and code-verified; the flag itself needs a native rebuild
this round didn't do; edge-swipe-back is device-verified independent of it.**

`android/app/src/main/AndroidManifest.xml:19` at the start of this round read
`android:enableOnBackInvokedCallback="false"` — quoted in full: `<application
android:name=".MainApplication" ... android:enableOnBackInvokedCallback="false" ...>`. The
generating source (`app.config.ts`) had no `android.predictiveBackGestureEnabled` key at all;
`@expo/config-plugins`' own plugin (`PredictiveBackGesture.js:34-37`) resolves a missing key to
`false` explicitly (`value === true ? 'true' : 'false'`), so this was the plugin's documented
default, not a stray regression. Added `predictiveBackGestureEnabled: true` to `app.config.ts`'s
`android` block. `npx expo prebuild --platform android --no-install` regenerated the manifest;
line 19 now reads `android:enableOnBackInvokedCallback="true"`.

**This needs a native rebuild to reach a running app — code-verified only, not device-verified.**
`prebuild` only regenerates the `android/` source tree (confirmed gitignored: `git ls-files
android/app/src/main/AndroidManifest.xml` returns nothing, matching every prior round's "D3, native
builds regenerate each time" note); it does not compile a new APK. The dev-client binary already
installed on the emulator (from round 14) was built before this change and still has the old
manifest baked in. A full Gradle rebuild (WSL2, ~20 minutes per round 2's own account) was not run
this round — sequencing this after the gesture-testing work below, then running out of round budget
before it, is an honest description of why, not a claim it was tried and failed.

**Edge-swipe-back itself does not depend on this flag, and is separately, fully device-verified.**
`enableOnBackInvokedCallback` selects which *protocol* Android uses for the back gesture
(the modern predictive-back callback API vs. the legacy `onBackPressed()`/`KEYCODE_BACK` path) — it
is not what makes an edge swipe register as "back" in the first place; that already happens on
gesture-nav Android regardless of this flag. Proven by testing directly against the **pre-fix**
install (native deps in this branch are otherwise unchanged since M14 — confirmed round 3's own
diff, still true): `adb shell input swipe 5 1200 700 1200 300` (an edge-originating left-to-right
swipe) popped every one of seven distinct screen types, each with a before/after screenshot:

| # | screen (before) | screen (after swipe) | evidence |
| --- | --- | --- | --- |
| 1 | chat (`Untitled session`, pushed from Sessions) | Sessions | `14-edge-swipe-test.png` |
| 2 | Bots roster (pushed from drawer) | Sessions | `17-bots-swipe-result.png` |
| 3 | bot chat (`default`) | Bots roster | `19-botchat-swipe-result.png` |
| 4 | Projects (empty state) | Bots roster | `21-projects-swipe-result.png` |
| 5 | Settings › Appearance (two deep) | Settings (one deep) | `27-appearance-swipe-result.png` |
| 6 | Task detail (`Morning inbox digest`) | Tasks list | `33-taskdetail-swipe-result.png` |
| 7 | Connect › "Enter a URL" step | Registered gateways | `37-connect-swipe-result.png` |

Row 7's own result is worth recording precisely: it popped straight to Registered gateways, not to
an intermediate "Connect to existing Hermes" chooser screen — because `app/connect/index.tsx` draws
the Tailscale / Enter-a-URL / This-computer chooser and the URL form as *view states inside one
screen* (round 14 already established this: `app/connect/index.tsx:284`'s single `ScrollView` wraps
"every step (`:start`, `:steps`, `:url`)"), not as separate pushed routes — so there was only ever
one stack entry to pop, and it popped correctly.

A control ruled out "any swipe reads as back": a **mid-screen** swipe (`input swipe 400 1200 900
1200 300`, nowhere near either edge) on the same bot chat screen did **not** pop it
(`53-midscreen-swipe-control.png` — chat still shown). Edge-swipe-back is genuinely edge-scoped, not
a blanket gesture-to-back mapping.

**Sheets consume back before the stack does.** Not re-tested this round — round 10's own finding
(`Sheet.tsx`'s `Modal onRequestClose`) is unchanged code, and no sheet-related code moved this
round outside the reverted RNGH experiment below.

**Task 2 (swipe down dismisses every sheet): re-confirmed not reachable by injection; RNGH tried
for real, also not reachable, reverted — on the manual checklist, same as round 10.**

Reproduced round 10's finding fresh, against the *unmodified* `PanResponder` in `Sheet.tsx:173-189`,
before touching any code: opened the New bot sheet, tried `input swipe 540 1050 540 1500 300` (no
effect, `40-sheet-swipe-test.png`) and a hand-built `motionevent DOWN` + five `MOVE`s + `UP` (no
effect, `41-sheet-motionevent-test.png`). Same zero result as round 10, different round, same
device class.

Per this round's own brief, tried the suggested experiment rather than assuming its outcome:
migrated `Sheet.tsx`'s drag from `PanResponder` to `react-native-gesture-handler`'s `Gesture.Pan()`
+ `GestureDetector` (native gesture recognizers, the same class of thing `react-native-screens`'
edge-back uses, which the edge-swipe table above just proved *is* injectable). First attempt crashed
on open: `[Worklets] Cannot copy value of type 'AnimatedValue'` (`44-new-bot-sheet2.png`'s
predecessor, a red box) — the worklets babel plugin, auto-installed by `babel-preset-expo` because
`react-native-reanimated` is a dependency even though nothing in this app uses it otherwise, treats
`onUpdate`/`onEnd` as worklets by default and tries to serialize their closure over `dragY` (a plain
`Animated.Value`, not a Reanimated shared value) onto the UI thread. Fixed with `.runOnJS(true)`,
which keeps the callbacks on the JS thread — the same threading model `PanResponder` always used.
Sheet opened cleanly after the fix (`47-sheet-open.png`). Then, with the crash fixed, tried
injection again: `input swipe` from the handle (`48-rngh-swipe-test.png`), a slower/longer `input
swipe` from the header title row (`50-rngh-swipe-test2.png`), a hand-built 11-point motionevent
sequence (`51-rngh-motionevent-test.png`), and `input draganddrop` (`55-draganddrop-test.png`) — all
four left the sheet open. RNGH did not make the sheet's own drag injectable.

**Reverted rather than kept** (`git checkout -- src/components/ui/Sheet.tsx`, confirmed via `git
status`/`git diff --stat` back to only `app.config.ts` modified): the migration achieved none of
its purpose — no regression-testable gain — while introducing a new dependency pattern (RNGH +
worklets threading) across all eight `Sheet` consumers that would need round 10's full
per-consumer regression pass (a)-(c)/(e)-(f) to trust, which this round did not have budget to
re-run for zero benefit. Matches the round's own instruction exactly: "Only do that if it's a
contained change [and verified] ... Otherwise leave it and put it on the manual checklist."

**Task 3 (swipe between Bots/Sessions/Tasks): Deviation proposed and applied — tab row built,
switches without growing the stack, and the swipe itself is device-verified, both directions.**

Read `sessions.html:10,20,32,47-48` and `bots.html:9,47` as instructed. Found the tab model had
drifted further than Deviation 14 recorded: no tab strip existed anywhere (confirmed by reading
`tasks/index.tsx`'s own header comment, which said so directly), and `AppDrawer.tsx:96`'s
`router.push` meant Bots/Sessions/Tasks were reached by growing the stack, not "real tabs that
switch in place" the prototype specifically contrasts with the desktop's own push-based framing.
Stopped and wrote up Deviation 20 (main Deviations list above) before building, as instructed, then
built `src/components/TabStrip.tsx`: a 48dp row (Bots · Sessions · Tasks, 2dp active indicator,
12dp inset — `sessions.html:37`'s own measurements), wired into all three screens
(`app/(main)/bots/index.tsx`, `app/(main)/tasks/index.tsx`, `app/(main)/session-list.tsx`, each
right under its header), tab taps and swipes both calling `router.replace` rather than `push`.

*In-place switching, device-verified.* Tapped Bots → Sessions → Tasks from a cold Sessions start
(`57-tap-bots-tab.png`, `58-tap-tasks-tab.png` — active tab and screen content both updated each
time). Then, from Tasks, an edge-swipe-back (`59-inplace-swipe-result.png`) exited straight to the
**Android launcher home screen**, not to Bots or Sessions — proof the two `replace` calls never
grew the stack: there was nothing left to pop to. Relaunched
(`60-relaunch-after-exit.png`, resumed on Sessions) and checked the other direction too: Bots tab →
open a bot chat (a genuine `push`) → edge-swipe-back correctly returned to the Bots roster, not the
launcher (`61-bots-then-chat.png` → `62-bot-chat-open.png` → `73-back-to-bots-tab.png`) — pushed
screens still stack and unwind normally; only tab-to-tab switches collapse into one entry. One
real, unrelated flake hit mid-sequence: the Bots roster's `profiles.list` RPC returned "Connection
timed out" twice in a row after the exit-to-launcher/relaunch cycle (`63-retry.png`, `64-retry2.png`)
while Sessions' and Tasks' REST calls kept working throughout; a further force-stop + cold relaunch
cleared it and the same roster loaded fine via the drawer immediately after
(`71-bots-via-drawer.png`) — recorded as observed, not chased further, since it reproduces the same
WS-vs-REST asymmetry round 2's "Incidental finding" already logged as pre-existing and out of scope.

**The swipe gesture itself is injectable here — a genuine, checked exception to task 2's finding,
not a guess generalized from one result.** `TabStrip`'s `Gesture.Pan()` uses the identical API and
`.runOnJS(true)` threading as the reverted `Sheet` experiment, but is mounted directly on a screen
rather than inside a `Modal`. `input swipe 700 340 300 340 300` (right-to-left, over the tab row)
advanced Bots → Sessions (`74-tabstrip-swipe-attempt.png`); the reverse direction
(`75-swipe-reverse.png`) went back. Repeated after widening `EDGE_GUARD_PX` and a full app restart:
same result both ways (`81-final-interior-swipe.png`). No crash on either swipe, confirming the
`runOnJS` fix generalizes.

**One residual risk, not resolved, recorded rather than hidden:** an edge-originating swipe on the
tab row (meant to defer to the system/`react-native-screens` back gesture via `EDGE_GUARD_PX`) gave
two different outcomes across nominally identical injected swipes from the same starting tab — once
correctly deferring (`78-edge-guard-retest.png`: exited to the launcher, `TabStrip`'s own gesture
never fired), once advancing the active tab by two instead of being blocked
(`76-edge-guard-test.png`: Bots → Tasks in one swipe). Raised `EDGE_GUARD_PX` from 24 to 40 for more
margin (`src/components/TabStrip.tsx`) but this reads as a genuine touch-dispatch race between two
competing native gesture recognizers, not a threshold bug a bigger number reliably fixes — full
reasoning in Deviation 20. **Manual check needed**, listed below.

**Task 4 (device-verify group E's exit criterion), part by part:**

| part | status | evidence |
| --- | --- | --- |
| an edge swipe from the left pops every stack screen | **met by injection** — 7 screen types, both a real gesture-mechanism check and a mid-screen control | table above; `14-`, `17-`, `19-`, `21-`, `27-`, `33-`, `37-*.png` |
| a swipe down dismisses every sheet | **not met by injection; manual check pending** — round 10's finding stands, RNGH tried and also failed, reverted | `40-`, `41-`, `48-`, `50-`, `51-`, `55-*.png` |
| a swipe moves between the three tabs | **met by injection** for the tab row itself, both directions, twice over (before and after the edge-guard widen); **manual check pending** for the edge-band-only race | `74-`, `75-`, `81-*.png`; edge-band flake in `76-`/`78-*.png` |

**Task 5.** `npm run check`, run after the last edit (`TabStrip.tsx`'s label-constant and
`radius.full` fixes, both required by the existing `labels.test.ts` and `no-numeric-border-radius`
lint rule — first pass caught both, second pass was clean):

```
Test Files  73 passed (73)
     Tests  772 passed (772)
...
Ran 52 tests in 3.700s

OK

> hermes-android@1.0.0 lint
> eslint .

Checking formatting...
All matched files use Prettier code style!
EXIT=0
```

(772 vs round 14's 771: `labels.test.ts`'s own literal-string scan runs against every source file
including the two new ones, `TabStrip.tsx` and its wiring, so its assertion count shifted with the
file set — not a new test file.) The `hermes-push` plugin's printed `Traceback ... RuntimeError:
boom` is the same intentionally-mocked failure prior rounds noted, inside the 52-test `OK`.

**Manual checklist — exactly what to do on the emulator window with the mouse, and what to
expect.** Both items below could not be proven or disproven by adb injection from this harness;
neither "works" nor "doesn't work" should be assumed until checked this way.

1. Open any sheet (e.g. Bots roster → **+** → New bot). Place the mouse pointer on the sheet's
   handle or title row (near the top of the white sheet, below the grey scrim) and drag down past
   roughly a quarter of the screen height, then release.
   **Expected:** the sheet slides down and closes, the same way tapping **✕** does.
2. From any of the Bots / Sessions / Tasks tabs, place the pointer over the tab row itself (Bots ·
   Sessions · Tasks, just under the header) and drag left, then separately drag right, each a
   couple of hundred pixels, release.
   **Expected:** dragging left moves to the next tab (Bots→Sessions→Tasks), dragging right moves to
   the previous one; the active tab's label and underline update, and the screen below switches.
3. From the **Bots** tab specifically (leftmost), start a drag very close to the left edge of the
   screen (within the first few millimetres) and drag right.
   **Expected, and the specific thing round 15 couldn't confirm either way:** this should behave
   like Android's edge-back gesture (pop/exit), **not** advance the tab strip, and it should never
   jump more than one tab or do both at once. If a swipe that starts right at the edge sometimes
   changes tabs unexpectedly, that's the race flagged in Deviation 20 and this round's `TabStrip`
   section above, still unresolved.

**Teardown.**

- **(a) Hone restored, throwaway removed.** Navigated Settings → Registered gateways →
  "Switch to Hone"; registry log confirmed the flip immediately:
  ```
  09-17 01:04:09.463 ReactNativeJS: [registry] active: conn-1789205984475-cpgcec (Hone)
  09-17 01:04:09.465 ReactNativeJS: [registry] list: conn-1789586777745-rnovkv (http://10.0.2.2:9128) primary=false needsLogin=false
  09-17 01:04:09.465 ReactNativeJS: [registry] list: conn-1789205984475-cpgcec (Hone) primary=true needsLogin=false
  ```
  Removed the throwaway under the destructive-tap rule: fresh dump immediately before tapping
  **Remove**, confirm dialog read before confirming — `"http://10.0.2.2:9128" will be removed from
  this app. The instance itself is not touched` (`96-remove-confirm-dialog.png`) — named the
  throwaway, not Hone, so confirmed. Force-stopped and cold-launched
  (`monkey -p com.nousresearch.hermes.mobile -c android.intent.category.LAUNCHER 1` — the first
  attempt omitted `-p` and launched the Files app instead by accident, caught immediately via
  screenshot and not treated as the real result). Registry log, the storage readback:
  ```
  09-17 01:05:44.165 ReactNativeJS: [registry] active: conn-1789205984475-cpgcec (Hone)
  09-17 01:05:44.167 ReactNativeJS: [registry] list: conn-1789205984475-cpgcec (Hone) primary=true needsLogin=false
  ```
  One connection, Hone, active and primary, landed on `/session-list` (`99-teardown-final2.png`).
- **(b) Metro and the gateway stopped; ports confirmed refusing.** No trace proxy was used this
  round. Identified processes by full command line first, to avoid touching the persistent,
  unrelated `hermes gateway run` pair (PIDs 7228/16140, no `--port` flag, left running — not this
  round's process, per the standing "never touch Hone" rule) versus this round's own
  `hermes.exe serve --port 9128` pair (PIDs 16860/20032). Killed Metro and the two port-9128
  processes by PID only:
  ```
  metro 8081:   curl exit=7 (connection refused)
  gateway 9128: curl exit=7 (connection refused)
  ```
  The unrelated pair (7228/16140) confirmed still running afterward, untouched.
- **(c) Scratch state deleted, each path named and re-checked.** All four `ls`'d again afterward,
  all four "No such file or directory":
  1. `%TEMP%\hermes-m14-device-home` (the scratch `HERMES_HOME`, `.cookie-secret` included);
  2. `D:\Stuff\hermes-android-field\m14-device\scratch-password.txt`;
  3. `~/.local/bin/coder.bat`;
  4. `~/.local/bin/researcher.bat`.
- **(d) `adb reverse` empty; `font_scale` 1.0.** `adb reverse --remove-all` wedged past its timeout
  first — the same hang rounds 6, 8, 9 and 10 all hit. Per the standing rule, killed only the two
  local `adb.exe` processes (the server, PID 12880, and the wedged client, already gone by the time
  it was checked), then `adb start-server`; the device reattached on its own
  (`emulator-5554 device`) and the retry completed clean: `remove-all exit=0`, `reverse --list`
  exit 0, empty. `settings get system font_scale` → `1.0` (never changed this round).
- **(e) Emulator shut down, AVD intact.** `adb emu kill` → `OK: killing emulator, bye bye`;
  `adb devices` empty immediately after. `emulator -list-avds` still lists `hermes-test`: shut
  down, not deleted.
- **(f) Push and clean tree — pending**, immediately after this log entry is committed.

