# Field test — Hermes Mobile v0.1.1 (CodeUpdaterBot), 2026-09-12

Observation-only field test of the competitor Android client, run against a throwaway Hermes gateway
on the `hermes-test` emulator (`emulator-5554`, Android 16 / API 36, 412×915 dp, dpr 2.625).
Boundary: D16.3 — the app was installed and used; its repository, source and assets were not opened.
Everything below comes from using the app, from screenshots, and from measuring the rendered UI.

Screenshots (48 of theirs, 9 of ours) are outside the repo, in
`%LOCALAPPDATA%\hermes-android-field\` (`hermes-mobile-app\`, `ours\`). No image of their app is
committed.

---

## 1. Setup: what connected and what did not

**Artifact.** `Hermes-Mobile-Android-arm64-release.apk`, v0.1.1 (versionCode 1001), from the GitHub
release page, `sha256 f8a576b2c4d16d9898b2ecc64321f50461855974eaa151ce77223100e53a392d` (matches the
release digest). 25.9 MB. Package `com.hermesagent.mobile`, targetSdk 36. The emulator is x86_64 with
arm64 translation, so the arm64-only APK installs and runs.

**Permissions requested (whole app):** `INTERNET`, `RECORD_AUDIO`, and a dynamic-receiver permission.
There is **no `POST_NOTIFICATIONS`**, no camera, no media permission.

**The app is a WebView.** `uiautomator dump` returns exactly six nodes ending in a single
`android.webkit.WebView` filling 1080×2400; the page is `http://tauri.localhost/` — a Tauri shell
around a web UI. Consequences: no native accessibility tree (nothing for a screen reader or for
`uiautomator` to see), and the OS text-selection menu appears on message long-press. Because the dump
exposes no controls, every measurement below was taken from the rendered document geometry (CSS px,
which equal dp at this dpr) rather than from `uiautomator`.

**Throwaway host.** `HERMES_HOME=%TEMP%\hermes-field-home`, its own `config.yaml` (model `mimo-v2.5`
via opencode-go, `approvals.mode: manual`), two profiles with different models and souls
(`researcher` → mimo-v2.5 "Research Lead", `coder` → deepseek-v4-flash "Code Reviewer") and one cron
job ("Morning inbox digest", `0 9 * * *`). The user's own `hermes serve` was not running at any point
and was never touched; the user's `HERMES_HOME` was read once, to copy the opencode-go key into the
scratch home.

**Token mode could not be used, and that is the server's rule, not the app's.** Starting
`hermes serve --host 0.0.0.0 --port 9126` with `HERMES_DASHBOARD_SESSION_TOKEN` is refused:

> Refusing to bind dashboard to 0.0.0.0 — the auth gate engages on non-loopback binds (0.0.0.0), but
> no auth providers are registered.

So the gated run used the M04 password provider (`HERMES_DASHBOARD_BASIC_AUTH_USERNAME=tester`,
`…_PASSWORD=<scratch>`), which reports `{"ok":true,"version":"0.21.0","auth_required":true}` and 401s
an unauthenticated `GET /api/profiles`. **Their app offers no session-token field at all** — the only
sign-in it exposes is gateway username + password — so a loopback/token deployment (the first row of
our README auth matrix) has no path into their client.

**What connected.** `http://10.0.2.2:9126` was accepted (their guard rejects only `127.0.0.1` and
`localhost`, and 10.0.2.2 is the emulator's alias for the host). "Test gateway" returned:

> Hermes 0.21.0 is reachable. Authentication is required. Secure device sign-in is available.

Sign-in with `tester` + password then reported **Connected**, `10.0.2.2:9126`, "3 Bots · 1 Sessions".

**What broke, repeatedly.** Their stored credential does not survive a gateway restart, and did not
survive ~20 minutes of ordinary use either:

> Hermes session refresh failed: Refresh token expired or invalid; start a new sign-in.

The banner's only action is "Try again", which cannot fix what the banner describes; recovery needs
Settings → Security & pairing → Test gateway → retype username and password → Sign in. I had to do
this three times in one session. While in that state an already-open chat renders **empty**, and both
"Refresh conversation" and leaving/re-entering the chat fail with "Could not load this Hermes
conversation." The host still had every message throughout (`hermes sessions list` showed the session
and `state.db` held the rows); after a manual re-sign-in the transcript came back in full.

---

## 2. Screen by screen

Measurements are CSS px = dp. Their controls cluster at **26–45 dp**, below Android's 48 dp minimum;
ours are 75–107 dp (M13 criterion 6).

### Bots (default tab, `Bots · Sessions · Tasks`)

Large "Bots" title, a status line under it (green dot + "Hermes Desktop"; red dot + "Hermes
unavailable" when down), circular Search and Settings buttons top-right (44×44). Tab row (each tab
h=38) — but the tabs **push screens**: opening Tasks or Sessions replaces the tab row with a "Back to
Bots" control, so it is a stack, not a tab bar. Roster rows are 77 dp: generated blob avatar, bot
name, then description or last-message preview. Bottom: "New group" (secondary) and "+ New Bot"
(primary, white).

**Tapping a bot row does nothing.** No navigation, no network request, no console output — with 0
sessions, with 1 session on the host, connected, and when the row's own click handler is invoked
directly. The Sessions tab has no "new session" action either, so **in v0.1.1 there is no way to start
a conversation from the app**; a session must already exist on the host.

### New Bot (4-step wizard)

✕ top-left, four progress dots, "Who is this bot?" / "Name it and give it a job." Archetype tiles in a
2-column grid — Researcher, Coder, Writer, Analyst, Custom — and **picking one prefills the handle and
the job description** ("Coder" → name `patch`, "Writes, reviews, and ships code."). NAME field with
hint "Lowercase profile handle, for example research-rabbit.", "WHAT SHOULD IT DO?" field, Cancel /
Continue.

### Sessions

Rows show title, `Profile · first-message preview`, and a relative age ("4m"). No search, no pin, no
per-row model, no create action, no swipe actions.

### Tasks (list + detail)

Header counters "Running now 0 / Scheduled 1", then "SCHEDULED JOBS 1". A job card carries name, state
chip, the prompt, and a labelled grid: SCHEDULE `0 9 * * *`, NEXT `Sep 13, 2026, 9:00 AM`, LAST `—`,
DELIVER `local`, MODEL `mimo-v2.5`, with **Pause** and **Trigger now** on the card. Detail adds
"Prompt" and "RUN HISTORY · 0 — No completed runs yet." A "New task" action sits in the header.

### Settings (Connection)

"● Connected / Your Hermes host / 10.0.2.2:9126", counts (3 Bots, 0 Sessions), "Sync now". Rows
(53 dp): Notifications ›, Appearance (value shown: "OLED dark") ›, Security & pairing (value:
"Connected"; red "Disconnected" when down) ›, About Hermes Mobile (value: 0.1.1) ›. Footer line: "The
host owns models, credentials, tools, memory, skills, and approvals. This client is the control
surface." **Notifications is a dead row** — chevron, no handler (consistent with the APK requesting no
notification permission). Appearance expands inline into four in-app themes with one-line
descriptions: OLED dark ("Deep black with violet accents"), Light ("Cool, layered blue-gray
surfaces"), Graphite, Aurora. These are their own palettes, unrelated to the desktop's skins.

### Security & pairing

The best screen in the app. "RECOMMENDED / Pair over Tailscale", explaining that the phone joins the
Tailnet "instead of exposing port 9119 to the public internet". Then a verify card: GATEWAY URL
(placeholder `https://your-pc.tailnet.ts.net:9119`), **Test gateway**, and the guard line "Never enter
`127.0.0.1` or `localhost` on your phone—those point back to the phone itself." Username, password and
"Sign in & connect" **appear only after the probe succeeds** (progressive disclosure). Under it, "PAIR
A PHONE" lists three steps (Join the same Tailnet / Run a reachable Hermes gateway / Authenticate
inside Hermes Mobile), plus "Copy setup checklist" and a "Gateway connection guide" link. Copy is
explicit that the password is exchanged for revocable tokens kept in OS-backed storage and is not
saved.

### About

Product story, version, and a plain statement of the host-owns-everything model.

### Chat

See §3. Header: back (40×40), bot avatar, title, subtitle `title · model` (becomes `· Working` during
a turn), "Refresh conversation" (40×40).

---

## 3. Chat deep-dive: theirs vs ours

Six scenarios, same host, same prompts, same emulator. Ours is the current `main` dev client
(pre-M13/M14 styling, Expo dev client on Metro).

| # | Observation | Theirs (v0.1.1) | Ours (main today) | Verdict |
|---|---|---|---|---|
| 1 | User turn | Right-aligned bubble, `rgb(45,46,49)`, radius 17/17/5, padding 10×14, 16 px text | Right-aligned blue bubble, ~16 dp radius, 16 px | keep ours (M14 sets the desktop radius scale) |
| 2 | Assistant turn | **No bubble** — avatar in a left gutter (x≈53), prose full width, 16 px | Grey card containing the reasoning toggle and text | **adopt** unbubbled assistant + avatar |
| 3 | Turn separation | Turn gap ~24 dp; avatar only on assistant; timestamp separators ("3:08 PM") between turn groups | No timestamps, no avatars | **adopt** timestamp separators |
| 4 | Reasoning | Collapsed "Thinking" card, lightbulb icon, **one-line preview of the reasoning text**, chevron | "▸ Reasoning" label only, no preview | **adopt** the preview line |
| 5 | Tool call, running | Full-width card: `⋯ terminal · running…` | Not surfaced separately in this build | **adopt** |
| 6 | Tool call, finished | `✓ terminal · done · 1.0s` (green check, mono name, duration right-aligned), collapsed, output hidden | — | **adopt** name + state + duration |
| 7 | Tool call after reload | Renders differently from live: wrench icon, "Completed", green ✓, **no duration** | — | keep ours (be consistent; desktop parity decides the anatomy) |
| 8 | Stats after settle | Under the message: `mimo-v2.5 · Σ 14K tok · 3.9 tok/s`, arriving with the final delta | Header shows `13.1k tok · 1% ctx` for the session | **adopt** per-message stats (M15 B); keep our header context % |
| 9 | Message actions | **Copy** under every message, **Edit** under user messages, always visible, 54×26 / 31×26 dp | None | **adopt** (at 48 dp) |
| 10 | Long-press on text | OS WebView selection menu (Copy/Share/Select all/Web search); it **persisted across navigations** | Native selection | keep ours |
| 11 | Composer, left→right | Attach (32) · model chip `mimo-v2.5 ⌄` (80×30) · effort chip `Mediu… ⌄` (85×30, **label truncated**) · mic (32) · send (30, disabled when empty) | 🖼️ 📄 🎤 🔊 emoji buttons (92×107) · input (508×96) · "Send" pill (153×94) | **adopt** chips; keep our sizes |
| 12 | Composer placeholder | "Ask anything…  /commands" — advertises the palette | "Message Hermes…" | **adopt** |
| 13 | Input height | 29 dp at rest in a one-row composer | 96 dp | keep ours |
| 14 | Streaming control | Send becomes **"Stop Hermes"**; header subtitle becomes `· Working` | **Stop** and **Steer** | keep ours (Steer is ours alone); **adopt** the header working state |
| 15 | Slash palette | Card above the composer, "HERMES SKILLS & COMMANDS", rows `/name` + description, first row highlighted | Not surfaced in this build | adopt the shape, **not** the contents (§5) |
| 16 | Jump to latest | Pill above the composer, 77×34, radius full, 11 px, `↓ Latest`, and **`Latest · N`** with a count while a turn streams | None | **adopt** (M15 B) |
| 17 | Scroll up during a stream | Auto-follow stops; the pill appears; tapping it returns to the tail | Auto-follow only | **adopt** |
| 18 | Dictation | Mic label is literally "Record voice. Hold for 2.5 seconds to auto-send"; recording replaces the composer with `✕ ● 0:00 Listening…` and a finish arrow | Mic button, M11 path | **adopt** the 2.5 s hold and the recording strip |
| 19 | Attachment | Opens the **system file picker** (`documentsui`); chip shows the filename; upload failed with **"session not found"**, yet Send stayed enabled and the message went without the image ("I don't see any image attached") | Not exercised (buttons present) | **adopt neither** — use the Add-context sheet (§5) |
| 20 | Approval, `approvals.mode: manual` | **Executed `rm -rf /tmp/hermes-field-target` with no prompt; the file was deleted** | File **not** deleted, but no card either — the turn hangs (>50 s) | **NEW task**: neither is right; ours must show a card |
| 21 | Clarify | Tool chip sits at `⋯ clarify · running…` indefinitely; no card, no way to answer; Stop is the only exit | Not exercised (same gateway path) | **NEW task** |
| 22 | Stop mid-turn | Thread went **blank** (auth had lapsed); "Operation interrupted." appears in the transcript after re-auth | Stop works, transcript intact | keep ours |
| 23 | Background 25 s mid-turn | Returned with the full reply and its stats — survived | M07 verified; not re-run today | tie |
| 24 | Header | back · avatar · title · `title · model` · refresh | back · title · `provider · model` · tokens · % ctx · Compress | keep ours; **adopt** the avatar |
| 25 | Long list rendering | Numbered lines collapse into one run-on paragraph (markdown single-newline behaviour) | Same class of renderer | tie |

### Chat UX delta (what changes in our chat)

- Assistant turns lose the bubble; avatar in a left gutter, prose full width — **M14** (thread anatomy).
- Timestamp separator between turn groups — **M14**.
- Reasoning card shows a one-line preview of the reasoning text — **M15 B**.
- Tool calls render as one-line cards: icon, mono name, state, duration; collapsed — **M15 B (NEW sub-item)**.
- Per-message stats line under settled assistant turns (`model · Σ tok · tok/s`) — **M15 B** (exists).
- Copy on every message; Edit on user messages; always visible; 48 dp targets — **M15 B** (Edit exists; Copy is NEW).
- Composer model and effort chips whose label is the current value; **never truncate the effort label** — **M15 B**.
- Composer placeholder advertises the palette: "Ask anything…  /commands" — **M15 B (NEW)**.
- Jump-to-latest pill with a count — **M15 B** (exists; the count is confirmed worth it).
- Hold-to-dictate 2.5 s with a `✕ ● 0:00 Listening…` strip — **M15 B** (exists).
- Header subtitle shows a working state during a turn — **M14 (NEW sub-item)**.
- Approval and clarify cards in the thread — **NEW, and the highest-value item in this test**.

---

## 4. Worth adopting

- **Test-gateway-before-sign-in with progressive disclosure** · their probe reports version, whether
  auth is required and which method is available, and only then reveals the credential fields, so you
  cannot type a password at an unreachable host · **M15 D**.
- **The wrong-address guard as literal copy** · "Never enter `127.0.0.1` or `localhost` on your
  phone—those point back to the phone itself" states the reason, not just the rule; our
  add-connection form still *placeholders* `http://127.0.0.1:9119` · **M15 D**.
- **"Copy setup checklist" plus a linked connection guide on the pairing screen** · turns a
  multi-machine setup into something you can paste into a terminal on the host · **M15 D**.
- **Bot archetypes that prefill handle and description** · Researcher/Coder/Writer/Analyst/Custom makes
  the empty "new bot" form answerable in one tap · **M15 A**.
- **Per-message stats line** (`model · Σ tok · tok/s`) under the settled reply · **M15 B**.
- **Jump-to-latest pill with a count** (`Latest · 13`) · the count tells you whether returning is worth
  it; a bare "Latest" does not · **M15 B**.
- **Composer model and effort chips whose label is the current value** · you read the model without
  opening anything · **M15 B**.
- **Placeholder that advertises the slash palette** ("Ask anything…  /commands") · discoverability for
  a feature that is otherwise invisible on a phone · **M15 B (NEW)**.
- **Copy under every message, Edit under user messages, always visible** · no long-press to discover;
  matches M14's rule that nothing may exist only on hover · **M15 B (Copy is NEW)**.
- **Unbubbled assistant prose with an avatar gutter** · gives long replies the full width and reads
  like the desktop transcript · **M14**.
- **Reasoning preview line inside the collapsed card** · you can tell whether the thinking is worth
  expanding · **M15 B**.
- **Tool call as a one-line card with duration** (`✓ terminal · done · 1.0s`) · **M15 B (NEW sub-item)**.
- **Timestamp separators between turn groups** · **M14**.
- **A mic label that states the gesture** ("Hold for 2.5 seconds to auto-send") · the affordance is
  otherwise undiscoverable · **M15 B**.
- **Host-authority framing in copy** ("The host owns models, credentials, tools, memory, skills, and
  approvals. This client is the control surface.") · sets expectations before the first failure ·
  **M15 D / M09 copy**.
- **Task card with Pause and Trigger now on the row, plus a labelled schedule grid** · **M15 C**.

## 5. Not worth adopting

- **The WebView shell itself.** No accessibility tree, OS selection menus over app content (one stayed
  on screen across navigations), and no native gesture behaviour. Ours is native RN; keep it.
- **Their four in-app themes.** D14 vendors the desktop's 11 skins so the two surfaces cannot drift;
  inventing mobile-only palettes is exactly the divergence that decision forbids.
- **Passing the host's slash commands through unfiltered.** Their palette lists `/redraw` ("recovers
  from terminal drift") and `/prompt` ("compose in $EDITOR") on a phone. PARITY already says we
  classify unavailable commands; keep classifying.
- **Tabs that are really a stack** ("Back to Bots" replacing the tab row). M15 E wants real tab
  switching with swipe.
- **Their control sizes.** 26–32 dp actions fail M13 criterion 6.
- **The raw system file picker for attachments.** Superseded by the user's direction below.
- **A "Try again" action that cannot fix the error it is attached to.** Our banner (M15 D) should offer
  the action that actually recovers — re-sign-in — when the cause is an invalid refresh token.

**User direction, 2026-09-12 (supersedes both apps' attachment UI):** the attach control opens a bottom
sheet titled **"Add context"** — ✕ at the left of the title row, drag handle, three equal square tiles
in one row (**Camera**, **Photos**, **Files**; icon above label), and a secondary list row beneath
("Permission · Auto", chevron). Reference: the Claude Code Android app's own sheet. Drawn in the mobile
chat prototype.

## 6. Where they are behind us

- **Approvals.** With `approvals.mode: manual` on the host, their app **ran a risk-flagged `rm -rf` and
  deleted the file with no prompt**. `hermes approvals test` confirms the command matches "delete in
  root path" and "would raise an interactive approval prompt". Ours refused to execute the same
  command — but showed no card either, so both need work; theirs is the unsafe half.
- **Clarify.** Unanswerable: the chip sits at "running…" until you Stop the turn.
- **Attachments.** Broken in the case tested: "session not found", the chip shows an error, Send stays
  enabled, and the message is sent without the file.
- **Auth recovery.** Their token refresh failed three times in one session and every recovery is a
  manual retype of username and password. Ours holds a connection registry with Test / Sign out /
  Delete per connection, keeps several hosts, and re-dials (M04/M08).
- **No token auth.** Username and password only; a loopback-token gateway cannot be used at all.
- **Starting a conversation.** No new-session action anywhere, and bot rows are dead taps; the app can
  only open sessions that already exist on the host. Ours has "+ New" plus a searchable, pinnable
  session list with per-row model.
- **Notifications.** A settings row that does nothing, and no notification permission in the manifest;
  we have the M11 push pipeline.
- **Settings breadth.** Theirs: Notifications, Appearance, Security & pairing, About. Ours:
  Connections, Profiles, Providers, Models, MCP, Appearance, Skills and more.
- **Resilience of an open chat.** When their auth lapses the open transcript renders empty and neither
  Refresh nor re-entry recovers it, though the host has every message.
- **Accessibility.** No accessibility tree at all; 26–32 dp touch targets.
- **Transport.** Ours is verified across M03–M11 on device: WS ticket dial, resume and backfill,
  reconnect, background survival, push and voice.

## 7. Proposed changes to M15 (proposals only — for a D-entry, not edited into the milestone)

1. **New group F, "Approvals and mid-turn input" (highest value).** Approval card and clarify card
   rendered in the thread and answerable, with the desktop's button labels; the sudo/secret prompt
   reuses the same card. Today the same host hangs our turn with no card. Exit criterion: with
   `approvals.mode: manual`, a risk-flagged command produces a card; Approve runs it, Deny reports the
   denial in the transcript, and a clarify question can be answered without stopping the turn.
2. **M15 B additions:** tool-call cards (icon, mono name, state, duration, collapsed); Copy on every
   message; the reasoning preview line; a composer placeholder advertising `/commands`; a header
   working state during a turn. Exit criterion for the effort chip: the label shows the current value
   **in full** at 360 dp width (theirs truncates to "Mediu…").
3. **M15 A addition:** archetype presets in the New Bot sheet that prefill handle and description. Exit
   criterion: choosing "Coder" fills both fields; the handle stays editable and lowercase-validated.
4. **M15 D additions:** (a) reuse their guard sentence, including the reason, and stop placeholdering
   `127.0.0.1` in the add-connection form; (b) "Copy setup checklist" on the pairing screen; (c) the
   connection banner offers the action that actually recovers — re-sign-in on an invalid refresh token,
   retry on unreachable. Exit criterion: a 401 produces a banner whose primary action opens sign-in for
   that connection.
5. **M14 additions:** unbubbled assistant turn with an avatar gutter; timestamp separators between turn
   groups.
6. **Regression guard worth keeping:** opening a session that was created outside the app (by the CLI)
   left our client streaming with no reply, while the same prompt in an app-created session answered
   normally, and the host recorded the user message with no turn started. Worth a test before M15
   closes.

---

## Appendix: teardown

The APK was uninstalled, the throwaway gateway stopped, and the scratch `HERMES_HOME`, password and
token files deleted at the end of the round. The `field-test` connection added to our dev client was
removed and the user's own connection left as it was. See the commit message for the teardown log.
