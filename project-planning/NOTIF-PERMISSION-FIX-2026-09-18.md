# Notification permission timing fix — report (2026-09-18)

Branch `release/0.1.0` (already open with Part B work; continued on it rather than `main`, per the
task's own instruction to check first and say which). Per D21.1, every claim below names its scope
(component / path / general) and the build it ran against.

## The bug and the fix

`useNotifications.ts` requested notification permission unconditionally at app mount
(`app/_layout.tsx`), before any gateway was connected and before the app could produce a single
notification — and push was already disabled in this build anyway (no `extra.eas.projectId`,
`usePushRegistration.ts:24-31` already short-circuits correctly).

Fix: moved the request into a new module, `src/push/notification-permission.ts`, an "ask in
context, ask once" gate. Removed the unconditional request from `useNotifications.ts`'s mount
effect entirely (the channel setup, handler, and tap-to-open logic all stay at mount — they never
prompt).

**Chosen trigger: the first `prompt.submit` any session makes** — `src/gateway/
session-connection.ts`'s `submitPrompt`, one line added at its top:
`void ensureNotificationPermissionRequested()`. Considered against the three options the task
offered:
- *First successful gateway connection* — rejected: connecting doesn't imply the user will ever
  background the app mid-turn, so it's still asking before there's a concrete reason.
- *The user enabling notifications in Settings (`$pushEnabled`)* — rejected on inspection:
  `$pushEnabled` (in `src/push/settings.ts`) governs remote push registration, which stays inert
  without an EAS project id regardless of this fix. The toggle that actually gates whether a
  notification can fire is `native-notifications.ts`'s `$nativeNotifyPrefs.enabled` — but that
  defaults to `true`, so tying the ask to an explicit toggle-on would mean almost nobody is ever
  asked (most users never touch a switch that's already on). **Deviated from the task's own
  suggestion for this reason**, not on taste.
- *First time a session starts a turn* — **chosen**. `native-notifications.ts`'s `shouldFire`
  (called from `dispatchNativeNotification`) requires an `ATTENTION_KINDS` request (`approval` or
  `input`) while the app is backgrounded or on a different session — both of which require a turn
  to already be running. `submitPrompt` is the one place that starts one, and it's also the last
  point the app is guaranteed to still be foregrounded (Android won't show the permission dialog
  from a backgrounded app), so it's the latest-and-safest moment to ask.

Whether the OS has ever been asked is persisted separately (`hermes:notification-permission-asked`,
via the existing `storedBoolean`/`persistBoolean` in `src/lib/storage.ts`) from the two existing,
on-by-default preference toggles, specifically so tying the gate to either wouldn't have worked (see
above). Android itself stops showing its own dialog after two declines regardless of what this app
does; the flag exists so the app doesn't even try a third time, not to second-guess the OS.

Settings › Notifications (`app/(main)/settings/notifications.tsx`) now shows the **live OS
permission status** (a new "System permission" row, reading `getNotificationPermissionStatus()` on
mount and on every foreground transition) with an action that requests it if `canAskAgain`, or opens
system settings (`Linking.openSettings()`) once Android has stopped asking.

## Tests

`src/push/notification-permission.test.ts`, 11 tests (mocking `expo-notifications` and
`react-native-mmkv`, same pattern as `native-notifications.test.ts`): first-call checks-and-requests;
second call makes no native call at all (ask-once); already-granted still marks asked without
requesting; the denied path resolves without throwing and still marks asked; never asks again after
a decline across further calls; a native failure is best-effort (doesn't throw, still marks asked);
the Settings screen's explicit re-request always calls through regardless of prior state; a status
read never marks asked or requests; and a source-scan regression guard asserting
`useNotifications.ts` no longer contains `requestPermissionsAsync` at all. Full suite green
afterward: **800/800** (up from 789). Typecheck, eslint, prettier all clean.

Two commits, as instructed: `2a7d2c1` (the code) and `3137e31` (the tests). Both pushed to
`origin/release/0.1.0`. `npm run check` was green before each push.

## Device verification, on the release build

All six device-verification steps were reached. (a)–(c) and the fresh-install/grant path in (f) ran
on the **true, unmodified release build** (see below); (d)/(e) and the live-model parts of (f) ran
on a **second, temporary, uncommitted build** with a narrow cleartext exception added only to reach
the plain-HTTP throwaway gateway — a real, separate finding, detailed below, not something silently
patched into the shipped pipeline. Evidence: `D:\Stuff\hermes-android-field\notif-permission\`.

### (a) Rebuild with `scripts/build-release-apk.sh` — **done, device-verified, with a named caveat**

Ran via `D:\Stuff\hermes-android-field\m14-device\run-release-verify-build.sh` (Opus's own script,
reused as-is), which generates/reuses `~/hermes-release-verify-scratch/verify-opus.keystore` — the
project's persistent throwaway verification key, not the real signing key, never for distribution —
and calls the real, unmodified `scripts/build-release-apk.sh`. Launched as a single long-lived
background command, polled only by reading its Windows-side log file (never re-invoking `wsl.exe`
while it ran — three earlier attempts this same round died silently when the WSL2 VM was torn down
mid-build by re-invoking `wsl.exe` for status checks; this is named in
`RELEASE-PREP-2026-09-18.md`'s B3 section too, since it affects that verification as much as this
one).

Result: `BUILD SUCCESSFUL in 17m 46s`. APK sha256
`5a76970aaf54d3a0a27d0a163a7aed1ce26634ef6bd83f3d1b81c1db172468a8`, copied to
`hermes-mobile-notif-fix.apk` in the evidence folder (sha256 re-verified identical after copy).

**Named caveat:** this exact APK could not be used for steps (d)–(f)'s live-gateway testing — see
"A separate finding" below. It *was* used for (b) and (c), which need no gateway connection.

### (b) Uninstall previous, install fresh — **done, device-verified**

```
adb uninstall com.symbyotic.hermes.mobile   → Success
adb shell pm list packages | grep symbyotic → (no output — confirmed gone)
adb install hermes-mobile-notif-fix.apk     → Success
```

### (c) Cold start, no permission dialog, lands on Connect — **done, device-verified**

```
adb shell am start -n com.symbyotic.hermes.mobile/.MainActivity -W
→ Status: ok / LaunchState: COLD / TotalTime: 1685
```

`uiautomator dump` immediately after: zero matches for "permission" or "notification" anywhere in
the tree (`grep -ic` → `0`). Screenshot (`coldstart-screenshot.png`) shows the Connect screen —
"Connect to existing Hermes" — as the first and only thing on screen, unaffiliated notice visible in
its footer. No dialog.

### A separate finding, discovered trying to reach (d): release builds cannot connect to any plain-HTTP gateway

Detecting the gateway (`http://10.0.2.2:9128`) on the true release build failed outright: "Could not
reach that Hermes gateway." Root cause, confirmed by inspecting the built APK
(`aapt dump xmltree app-release.apk AndroidManifest.xml | grep cleartext` — no match) and the
generated source tree: `android/app/src/debug/AndroidManifest.xml` sets
`android:usesCleartextTraffic="true"` with `tools:replace`, but that override is debug-only. The
release build has no `network_security_config.xml` and no override, so Android's own default for
`targetSdk 36` (≥28) blocks cleartext entirely. Confirmed by direct comparison: the identical
gateway, unchanged, was reachable moments later from the same emulator once the override existed
(below) — isolating the cause to the manifest, not the network or the gateway.

This is pre-existing template behavior, not introduced by this fix, and it would block **any**
feature's release-build verification against a plain-HTTP LAN/emulator gateway — including the
"Enter a URL" screen's own advertised use case ("a LAN address, a reverse proxy, or an emulator
host"). **Not fixed here** — a real product/security question (should release builds permit
cleartext to some safe, narrow subset of addresses?) for the user or Opus to decide. Reported, not
silently patched.

To still complete (d)–(f), a **second, temporary, uncommitted** build was made: a
`network_security_config.xml` permitting cleartext to `10.0.2.2` only (the emulator-host alias,
meaningless outside an emulator) was added locally under `android/app/src/main/res/xml/`
(`android/` is git-ignored, regenerated by every `expo prebuild`; this file and the one manifest
attribute line were deleted from the working tree immediately after use and never committed).
Rebuilt with `./gradlew assembleRelease` directly (skipping `expo prebuild --clean`, which would
have wiped the manual edit) against the same `verify-opus` keystore: `BUILD SUCCESSFUL in 5m 15s`
(warm cache), sha256 `ee0e167e4ece4551665e9162545efad2acde6ad1c31b43dcc79af89c4f8086c2`. **This
second APK is not representative of the real release build** and was built purely to unblock (d)–
(f); its own cold start was independently re-checked and also showed no permission dialog
(`coldstart2-screenshot.png`), confirming the fix's behavior doesn't depend on the network config
either way.

### (d) Connect and drive to the trigger — **done, device-verified**

Connected to the throwaway gateway (`setup-gw.sh`, `Enter a URL`, `http://10.0.2.2:9128`, basic-auth
sign-in as `tester`), created a new session (model `mimo-v2.5`, per the standing test-model pin),
sent the first message. `content-desc="Send"` tapped; a screenshot taken ~2s later
(`trigger-dialog.png`) shows the system dialog: **"Allow Hermes Mobile to send you
notifications?"** — appearing exactly at the chosen trigger, on the very first `prompt.submit`, with
nothing sent or received from the model yet.

### (e) Decline, re-run the trigger twice, confirm no further dialog — **done, device-verified**

Tapped "Don't allow" (exact bounds from `uiautomator dump`, not a guess — the dialog is a system
`com.google.android.permissioncontroller` window). Confirmed dismissal (dump shows only
`com.symbyotic.hermes.mobile` in the tree afterward). Sent two more messages in the same session
(fresh `prompt.submit` each time, once mid-turn resolved so `Send` was enabled again both times):
each was confirmed via `uiautomator dump` immediately after tapping Send — **zero** occurrences of
`com.google.android.permissioncontroller` either time. Evidence:
`after-decline-confirmed.png`, `after-two-more-triggers-final.png`.

Settings › Notifications was then opened and screenshotted
(`settings-notifications-denied.png`): **"System permission — Not granted"** with an "Enable
notifications" action (not "Open system settings" — Android's own two-decline cutoff hadn't been
reached yet after a single decline, so `canAskAgain` was still `true`; the UI correctly reflects
that distinction rather than hard-coding one wording).

### (f) Grant on a fresh install, confirm a real notification arrives — **done, device-verified**

Fresh install (uninstall + install of the second, cleartext-patched build), cold start (again no
dialog), reconnected, new session. Asked the model to run `echo hello` via its terminal tool — it
ran without needing approval (this gateway's actual approval gating turned out to be
narrower/different from what a "manual" mode name suggested; not investigated further, out of
scope). Asked it to run `rm -rf /tmp/test-notif-verify` instead: an "Approval required" card
appeared. Tapped **Allow** on the permission dialog that this same first-turn trigger produced again
(this was a fresh install, so `hasRequestedNotificationPermission()` was false again) —
`uiautomator dump` confirmed the dialog dismissed and permission granted.

A first approval request that arrived *while still foregrounded* does not produce a notification by
design (`shouldFire`'s `ATTENTION_KINDS` gate needs the app backgrounded, or a different session —
neither was true yet, so nothing should fire, and nothing did). To exercise the real path: sent a
second risky command (`rm -rf /tmp/test-notif-verify2`) and pressed **HOME immediately** after
tapping Send, backgrounding the app before the approval request could arrive while still
foregrounded. ~5 seconds later, expanded the notification shade and screenshotted
(`real-notification-final.png`): a real system notification, **"Hermes Mobile • now — Approval
needed — rm -rf /tmp/test-notif-verify2"**, with the app's own bell icon — `dispatchNativeNotification`
firing for real, exactly as M11's local-notification path is supposed to.

## Incidental finding, not investigated further

While working through (f), an approval card's on-screen layout looked visually glitched after
scrolling and reopening a session — a red-outlined element rendered partially off-screen to the
right, a stale-frame-looking artifact. `uiautomator dump` showed the actual button bounds were
correct and on-screen the whole time (tapping the dumped coordinates worked), so this reads as a
paint/rendering glitch, not a real layout bug — but it resembles the kind of thing `D21.2`/the
approval-path fix round has been chasing. Not investigated further: out of scope for this task, and
not reproduced deliberately (found once, mid-navigation, not deliberately triggered). Named here so
it isn't lost.

## Teardown

- Deleted the temporary `network_security_config.xml` and reverted the one manifest attribute line
  (both under git-ignored `android/`, never committed) — confirmed gone.
- Killed the throwaway gateway process, deleted its `HERMES_HOME` and the field kit's
  `scratch-password.txt` — confirmed gone via failed `ls`.
- Left `verify-opus.keystore`/`.pw` in place — this is the project's own persistent, reusable
  verification keystore (Opus's script explicitly reuses it across rounds if present), not a
  per-round scratch file; deleting it would make the next verification round regenerate it for no
  reason.
- Did not uninstall `com.symbyotic.hermes.mobile` at the end — left installed (fresh, permission
  granted) in case the next session wants to pick up from a known state. Left the emulator running.
- Never touched the "Hone"/Home connection (`https://gateway.example.org`) — it lives under the
  old package id (`com.nousresearch.hermes.mobile`), an entirely separate Android app-data sandbox
  from anything this round touched.

## Honesty checklist (D21.1)

1. **Finished vs part-done.** Finished: the code fix, both commits, the full test suite, and all
   six device-verification steps (a)–(f). Nothing is part-done. The one open item is a decision, not
   an unfinished task: what (if anything) to do about release builds being unable to reach
   plain-HTTP gateways.
2. **Inert/stubbed/unverified, named.** Nothing in the shipped code is stubbed. The second
   (cleartext-patched) APK used for (d)–(f) is explicitly not representative of the real release
   build — named at every place it's cited as evidence, not just once. The approval-card rendering
   glitch was observed, not investigated or fixed.
3. **Personally verified vs taken on trust.** Personally verified, this round, with pasted
   command/screenshot evidence: the entire fix, all 11 new tests, the full 800-test suite, both
   release builds (real and cleartext-patched), and all six device-verification steps. Taken on
   trust: the WSL2-VM-teardown root cause for the three earlier failed build attempts (inferred from
   `ps aux` showing nothing running, not from a definitive OS-level trace); `run-release-verify-build.sh`'s
   own claim that its keystore is a genuine throwaway (read the script, didn't independently audit
   the resulting cert).
4. **Closed / open-with-a-named-gap / open.** The fix itself, its tests, and all of (a)-(f): **closed**,
   path scope (real device, both builds named per-claim). The cleartext gap: **open**, named,
   explicitly not decided here. The approval-card rendering glitch: **open**, named, not reproduced
   deliberately.
5. **Deviations and why.** (a) Chose "first turn starts" over the task's own suggested `$pushEnabled`
   toggle, because that toggle governs push registration (inert without EAS) and the toggle that
   actually matters (`$nativeNotifyPrefs.enabled`) defaults to `true`, making a toggle-based trigger
   fire for almost nobody. (b) Built a second, temporary, uncommitted APK with a narrow cleartext
   exception to complete (d)–(f), after discovering the true release build can't reach any
   plain-HTTP gateway at all — a pre-existing, unrelated finding, not silently fixed. (c) Did not
   investigate why the `echo hello` command needed no approval on this gateway before `rm -rf` did —
   out of scope, noted rather than chased.
