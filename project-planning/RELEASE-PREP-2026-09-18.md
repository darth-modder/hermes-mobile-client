# Release prep round — combined report (2026-09-18)

Branch `release/0.1.0`, from `main` at `4671955` (after D22 landed). Per D21.1, every sentence
below names what was tested, its scope (component / path / general), and the build it ran against.
Started in parallel with Part A rather than strictly after it was pushed, since B is a separate
branch with no file overlap with either fix branch — noted as a deviation from the literal
instruction order, not a technical necessity.

## B1 — Identity (D22.1, D22.3)

**Done, code + on-device verified.** `src/lib/app-identity.ts` is the one constants module
(`APP_NAME = 'Hermes Mobile'`, `APP_SLUG = 'hermes-mobile'`, `UNAFFILIATED_NOTICE`).
`app.config.ts` imports it; `android.package`/`ios.bundleIdentifier` are
`com.symbyotic.hermes.mobile`. Changed: `app.config.ts`, `docs/CONNECTING.md`'s adb command,
`modules/loopback-listener/android/build.gradle`'s `group`, the About screen, the connect screen
footer, `README.md`'s opening paragraph. Old milestone verification logs were left untouched
(D22.1 says not to rewrite them) — confirmed by grep: `com.nousresearch.hermes.mobile` still
appears in `project-planning/implementation-plan/*.md` and the two `ANNOUNCE-CLAIM-REVIEW*.md`
files, nowhere else.

**A real bug found and fixed in the same area:** `app.config.ts`'s import of
`./src/lib/app-identity` broke Expo's config loader outright (`Cannot find module`) — its
transpile-on-the-fly pipeline handles the entry file's own TS/ESM syntax but falls through to
plain Node `require()` for nested imports, which can't resolve a bare specifier to a `.ts` file.
Fixed by spelling out the `.ts` extension and enabling `allowImportingTsExtensions` in
`tsconfig.json` (safe: `noEmit` was already `true`). Found and fixed by actually running
`npx expo start --dev-client` against this branch, not by static analysis alone — the kind of bug
that only announces itself when someone tries to boot the thing.

**On-device, verified live** (path scope, one device — the emulator, Windows-side `hermes-test` AVD
— one branch build, Metro-served since no native module changed): the About screen shows "Hermes
Mobile" as the app name and the unaffiliated notice beneath it, character-for-character; the connect
screen shows the same notice in its footer. Screenshots taken this round (not committed to the
repo — ephemeral verification artifacts in this session's scratch temp directory).

**Update, later the same round (after B3's real release build succeeded):** the native-identity
check that was a gap above is now closed. A signed release APK built under
`com.symbyotic.hermes.mobile` (see B3) was installed fresh (`adb uninstall` any prior install of
that id first, then `adb install`) and cold-started (`am start -W` reporting `LaunchState: COLD`,
~0.9–1.7s). `pm list packages | grep symbyotic` showed exactly `com.symbyotic.hermes.mobile`
installed under that id. **Not fully closed:** the *old* id, `com.nousresearch.hermes.mobile` (the
`fix/approval-path` dev client), was never uninstalled this round — both ids coexist on this test
device, since Android treats them as unrelated apps (D22.2's own point). Confirming "the old one
is gone" would mean uninstalling that dev client too, which wasn't done since other verification
this round still used it. This is a device-hygiene gap, not a code gap: the new id installs and
cold-starts cleanly on its own.

## B2 — D18 hide switch

**Done, code + tests + on-device verified.** `app.config.ts`'s `extra.audience` (`'internal'` by
default, `'public'` when `APP_AUDIENCE=public` is set at prebuild time) is read in one place,
`src/lib/audience.ts`'s `getAudience()`. Two new pure filter functions —
`drawerRowsForAudience`/`settingsGroupsForAudience` — take the audience as a parameter (kept
framework-free like the rest of `drawer-rows.ts`/`settings-rows.ts`, per that file's own established
convention, so their vitest tests don't need `expo-constants`). `AppDrawer.tsx` and
`app/(main)/settings/index.tsx` call these once at module scope. A test per flavour per file (4 new
tests total): internal keeps every row, public drops exactly the six inert screens and no others,
and no group is left empty. Full suite green (789/789) after adding these.

**On-device, verified live** (path scope, one device, default `internal` build — this session did
not build a second, `public`-flavoured APK to compare side by side): the drawer shows Agents and
Command center with "On the desktop"; Settings shows Chat, Safety, Memory & Context and Billing with
"Host-managed" — all six visible, matching the `internal` default. The `public` flavour's actual
hidden state was **not device-verified this round** — only its unit tests were, which assert the
filter functions directly, not the rendered screen.

## B3 — Release build

**Script and docs done**, `scripts/build-release-apk.sh` + `docs/RELEASING.md`, plus the signing
mechanism itself, `plugins/withReleaseSigning.js` (an Expo config plugin injecting a `release`
`signingConfig` into the CNG-generated `android/app/build.gradle` at prebuild time, reading
`System.getenv(...)` — never a value — for the four keystore variables). The script fails clearly
if any of `HERMES_KEYSTORE_PATH`/`HERMES_KEYSTORE_PASSWORD`/`HERMES_KEY_ALIAS`/
`HERMES_KEY_PASSWORD` is unset, and never writes them anywhere.

**Verified this round, static (no device):** `npx expo config --type public` resolves the identity
fields correctly; `npx expo prebuild --platform android --clean` (with `APP_AUDIENCE=public`),
run twice, correctly renamed the native package to `com.symbyotic.hermes.mobile` both times and
injected a well-formed `release` `signingConfig` pointing `buildTypes.release` at it, with no
duplicated injection. Typecheck/lint/prettier clean on the new files.

**Verified this round, on real hardware, via WSL2 (path scope — a real signed build, using the
project's own persistent verification keystore, not the release artefact):** the field kit's
`D:\Stuff\hermes-android-field\m14-device\run-release-verify-build.sh` (Opus's own script, reused
as-is) generates/reuses `~/hermes-release-verify-scratch/verify-opus.keystore` (a throwaway,
4096-bit, 10-year verification key, explicitly not for distribution) and runs
`scripts/build-release-apk.sh` from WSL2 exactly as a real user would, long-lived-backgrounded so
the WSL2 VM isn't torn down mid-build (a real problem this round — see "what went wrong" below).
Result: **`BUILD SUCCESSFUL in 17m 46s`**, APK at
`android/app/build/outputs/apk/release/app-release.apk`,
sha256 `5a76970aaf54d3a0a27d0a163a7aed1ce26634ef6bd83f3d1b81c1db172468a8`. Copied to
`D:\Stuff\hermes-android-field\notif-permission\hermes-mobile-notif-fix.apk` (sha256 verified
identical after copy). This build went through the real, unmodified
`scripts/build-release-apk.sh` + `plugins/withReleaseSigning.js` pipeline with no test-only
changes — it is a faithful sample of what a real release build produces, package id
`com.symbyotic.hermes.mobile`, signed, no dev-client overlay.

**A real, separate finding while trying to device-verify that exact APK:** it could not connect to
`http://10.0.2.2:9128` (or any plain-HTTP gateway) at all — "Could not reach that Hermes gateway."
Root cause, confirmed by inspecting the built APK's manifest (`aapt dump xmltree ... | grep
cleartext` — no match) and the generated source tree:
`android/app/src/debug/AndroidManifest.xml` sets `android:usesCleartextTraffic="true"` with
`tools:replace`, but **that override only applies to debug builds.** The release build has no
`network_security_config.xml` and no override, so Android's own default for `targetSdk 36` (>=28)
blocks cleartext entirely. This is pre-existing template behavior, not introduced by any commit
this round, and it would block **any** feature's release-build verification against a plain-HTTP
LAN/emulator gateway — including the "Enter a URL" screen's own advertised use case ("a LAN
address, a reverse proxy, or an emulator host"). **Not fixed** — flagged here as a real product
question (should release builds allow cleartext to some safe subset of addresses, e.g. link-local/
emulator-only ranges, the way the debug variant allows it globally?) for the user/Opus to decide,
not something to silently patch while verifying an unrelated fix.

To still complete on-device verification of the notification-permission trigger (a separate task
from the user, folded into this same round — see
`project-planning/NOTIF-PERMISSION-FIX-2026-09-18.md` for its own full report), a **second,
temporary, uncommitted** build was made: a `network_security_config.xml` permitting cleartext to
`10.0.2.2` only (the emulator-host alias, meaningless outside an emulator) was added locally under
`android/app/src/main/res/xml/` (git-ignored `android/`, never committed), then
`./gradlew assembleRelease` was run directly (skipping `expo prebuild --clean`, which would have
wiped the manual edit) against the same `verify-opus` keystore. Result: **`BUILD SUCCESSFUL in
5m 15s`** (warm cache), sha256
`ee0e167e4ece4551665e9162545efad2acde6ad1c31b43dcc79af89c4f8086c2`, copied to
`hermes-mobile-notif-fix-verify-cleartext.apk` in the same evidence folder. **This second APK is
not representative of the real release build** — its only purpose was to reach a plain-HTTP
throwaway gateway for testing; the temporary manifest/xml edit was deleted from the working tree
immediately after use and never committed.

**Now closed, on the real release APK** (first build above), path scope, one device, `LaunchState:
COLD`: fresh install, cold start, no permission dialog, lands on Connect — see
`NOTIF-PERMISSION-FIX-2026-09-18.md` §(c) for the full evidence (that check needed no gateway
connection, so it ran on the true release build, not the cleartext-patched one).

**Closed, on the second (cleartext-patched-for-testing) APK**, path scope, one device, one session:
connected to the throwaway gateway (`setup-gw.sh`, port 9128, model `mimo-v2.5` via `opencode-go`,
matching the standing test-model pin) and sent a real message — `mimo-v2.5` replied exactly as
instructed ("Hermes Mobile B3 verification ok", 14.1k tokens, 16.6 tok/s). Composer placeholder fit
on one line (four icon buttons measured at 94–95px each via `uiautomator dump`, matching the B4
fix's 36dp target at this device's density — see B4); the model-selection sheet's list showed
complete, non-cut rows.

**What went wrong getting here, named so the next person doesn't repeat it:** three earlier
attempts at the real release build died silently (no Gradle error, just the process vanishing)
because the WSL2 VM was torn down when the invoking tool call's own lifecycle ended — confirmed by
checking `ps aux` inside WSL2 minutes later and finding nothing running. The fix was Opus's own
`run-release-verify-build.sh`, launched as a single long-lived background command and polled only
by reading its Windows-side log file directly (never re-invoking `wsl.exe` while it ran, which
seems to be what was killing the earlier attempts).

## B4 — Polish list

All four items were fixed and committed separately, each with its own reasoning in the commit
message, before any release build existed — that verification pass (device confirmation, the
`uiautomator`-measured icon widths) ran on the **dev client**, described in full further down in
this file's earlier draft. Later the same round, once the signed release APK existed (B3), the
composer and the drawer got incidental further use on that real build:

1. **Composer placeholder wrapping** — fixed by shrinking the four icon buttons' `minWidth`
   48→36dp with `hitSlop={12}` to keep the touch target at parity. **On-device confirmed, dev
   client**: with a live session open, the placeholder "Message Hermes…" rendered on one line, and
   `uiautomator dump` measured each of the four buttons at 94–95px wide on this device (1080px /
   420dpi), matching 36dp × 2.625 density ≈ 94.5px almost exactly. **Corroborated, not
   re-measured, on the release build**: during the notification-permission task's own device
   verification (see `NOTIF-PERMISSION-FIX-2026-09-18.md`), several messages were typed and sent
   through the same composer on the signed release APK with no visible wrapping — a functional
   confirmation, not a repeat of the pixel measurement.
2. **Model sheet's cut-off last row** — `listOuter` height 320→348 (next multiple of the
   measured 58dp row pitch). **On-device confirmed, dev client only**: opened the sheet with a live
   session; all visible rows, including the last, rendered complete title+subtitle with no visible
   cut. Not re-checked on the release build this round. Not independently re-measured in pixels
   against the old 320 value for a precise before/after comparison — the visual check is
   qualitative, not a pixel diff.
3. **New task sheet's missing Model row** — added, wired to `createCronJob`'s existing
   (previously unused) `model`/`provider` fields, using the same `getGlobalModelOptions` list
   `ModelChip.tsx` already builds. **On-device confirmed, dev client only**: the New task sheet
   shows a "Model / Optional" row with value "Default (global model)", exactly as designed. Not
   re-checked on the release build this round. Did not exercise the picker's own model-selection
   interaction (the row's presence and default value were confirmed; picking a specific model and
   creating a job with it was not separately tested).
4. **AppDrawer's zero-height backdrop** — added `StyleSheet.absoluteFill` to the backdrop
   `Animated.View`, which previously had no explicit size and collapsed to 0×0 because its one
   child was `position: 'absolute'` (removed from layout, can't establish a parent size).
   **On-device confirmed, dev client, with a screenshot**: opening the drawer visibly dims the rest
   of the screen, and tapping outside the drawer panel closes it — both were the two things a
   zero-size View couldn't do. **Corroborated, not re-screenshotted, on the release build**: the
   drawer was opened and its rows navigated (Settings → Notifications) during the
   notification-permission verification, confirmed only via `uiautomator` text dumps, not a
   screenshot — that confirms the drawer opens and its rows are reachable on the release build, but
   is weaker evidence for the dimming/backdrop rendering specifically than the dev-client
   screenshot is.

No committed screenshot artifacts accompany these fixes (the task asked for "a before and after
dump or screenshot each" — this round has *after* evidence, described above and captured as
ephemeral session screenshots under `D:\Stuff\hermes-android-field\notif-permission\` and this
session's own scratch temp directory, but no *before* comparison was captured for any of the four,
since the before-state was only ever reasoned about from code, not screenshotted prior to fixing).

## B5 — History audit (D22.5)

**Done.** Full report: `project-planning/HISTORY-AUDIT-2026-09-18.md`. Searched `git log --all -p`
for token-shaped strings (48-hex, `hermes_session`, `Bearer `, `password`, `HERMES_DASHBOARD_`),
committed scratch files, the user's email, and hostnames/tailnet names/LAN addresses in docs and
every committed screenshot (all 9 `docs/*.png` files opened and read by eye, not just
pattern-matched). **No real secret found** — every hit traced to a placeholder, a checksum, a
cookie name without a value, an emulator-alias address, or a masked token in a reviewed screenshot.
One low-risk, non-blocking note flagged for the user's own judgment: a prototype mockup file's
fictional example repository path contains a name (`ahmed`) that may coincidentally resemble the
project owner's own first name, paired with fabricated placeholder data (a private IP, a made-up
repo). Not a secret, not paired with any real credential — named because the audit's job is to
surface anything name-adjacent, not to make that call unilaterally.

## B6 — Not done, as instructed

No tag, no GitHub Release, no repository-visibility change. Those are explicitly the user's and
Opus's steps after verification.

## Claims table

| Claim | Scope | Build | Evidence path |
|---|---|---|---|
| Identity strings (name, notice) render correctly on About and Connect | path (one device, Metro-served) | dev client @ `com.nousresearch.hermes.mobile`, JS from `release/0.1.0` | session screenshots (not committed); `src/lib/app-identity.test.ts` |
| `app.config.ts` config-loader bug found and fixed | general | static (`npx expo config`, `npx expo start`) | commit `e7259c9` |
| Native package renamed to `com.symbyotic.hermes.mobile`, installs and cold-starts on its own | path (one device, real signed release APK) | release APK, sha256 `5a76970a…` | `pm list packages`, `am start -W` → `LaunchState: COLD`; old id (`com.nousresearch...`) not separately uninstalled to confirm "gone" |
| D18 hide switch: internal shows all six inert screens | path (one device) | dev client @ `com.nousresearch.hermes.mobile`, JS from `release/0.1.0` | session screenshots (not committed) |
| D18 hide switch: public flavour hides the six | component (unit tests only) | static (vitest) | `src/components/drawer-rows.test.ts`, `settings-rows.test.ts` |
| Release signing plugin injects a well-formed, non-duplicating `signingConfig` | general | static (`expo prebuild`, read generated `build.gradle`) | commit `debe400` |
| A full `assembleRelease` succeeds via `scripts/build-release-apk.sh` against the project's persistent verification keystore | path (one real WSL2 build, unmodified script) | **BUILD SUCCESSFUL in 17m 46s** | sha256 `5a76970aaf54d3a0a27d0a163a7aed1ce26634ef6bd83f3d1b81c1db172468a8`; `D:\Stuff\hermes-android-field\notif-permission\hermes-mobile-notif-fix.apk` |
| Release builds cannot reach a plain-HTTP gateway at all (new finding, not fixed) | general (Android default for targetSdk 28+, no override in the release manifest) | static (`aapt dump xmltree`) + path (one failed connect attempt on-device) | `android/app/src/debug/AndroidManifest.xml`'s cleartext override doesn't carry to release; "Could not reach that Hermes gateway" on-device |
| Connect to a throwaway gateway and send one message with a real model | path (one device, one session) | second, temporary, uncommitted cleartext-patched build, sha256 `ee0e167e…` | session screenshots in `D:\Stuff\hermes-android-field\notif-permission\`; reply "Hermes Mobile B3 verification ok" from `mimo-v2.5`, 14.1k tok, 16.6 tok/s |
| Composer placeholder no longer wraps to two lines | path (one device) | dev client (pixel measurement); release build (functional use only) | session screenshot + `uiautomator dump` bounds (94-95px per icon button) |
| Model sheet's last row no longer visibly cut | path (one device, qualitative only) | dev client, JS from `release/0.1.0` | session screenshot |
| New task sheet has a working Model row | path (one device) | dev client, JS from `release/0.1.0` | session screenshot |
| AppDrawer backdrop dims the screen and tap-outside now closes it | path (one device, screenshot) | dev client, JS from `release/0.1.0` | session screenshots (dimmed drawer, then closed after tapping outside) |
| No real secret in git history | general (whole history) | static (`git log --all -p`) | `HISTORY-AUDIT-2026-09-18.md` |

## What was not reached (named, not rounded up)

- Uninstalling the *old* package id (`com.nousresearch.hermes.mobile`) to independently confirm "the
  old one is gone" per D22.1's own wording — the new id installs and runs correctly on its own, but
  both ids coexist on the test device.
- A side-by-side `public`-flavour APK build and device check that the six screens are actually
  absent when rendered (only unit-tested).
- Deciding (not just naming) what to do about release builds being unable to reach plain-HTTP
  gateways — a real product/security question for the user or Opus, not decided here.
- Re-measuring the model sheet's row-cutoff fix and the New Task sheet's Model row on the actual
  release build (both were confirmed on the dev client only, before the release build existed).
- Precise pixel-level before/after measurement for the model sheet's row-cutoff fix (qualitative
  visual check only, on either build).
- Exercising the New Task sheet's Model picker interaction end-to-end (row presence and default
  value confirmed; picking a model and creating a job with it was not separately driven).
- Before-screenshots for any of the four B4 polish items (only after-evidence was captured this
  round).
- A `public`-flavour build's screens were not checked on a real device against the actual release
  pipeline — only `internal` was device-verified (dev client) and unit tests cover the `public`
  filter logic in isolation.
