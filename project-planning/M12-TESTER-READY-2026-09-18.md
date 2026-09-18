# M12 tester-readiness pass — release/0.1.0 (2026-09-18)

Six items, worked on `release/0.1.0` starting from HEAD `7fced63`. Not merged, not tagged, per the
round's own instructions. Per D21.1, every claim below names its scope (component/path/general),
the build it was checked against, and whether it was device-verified or code-verified only.
"Not attempted" is reported as such, not smoothed over.

## Item 1 — stale `CONNECT_URL_HINT_TAILSCALE` text

**Done, device-verified.** Renamed `CONNECT_URL_HINT_TAILSCALE` → `CONNECT_URL_HINT` in
[`src/lib/strings.mobile.ts`](../src/lib/strings.mobile.ts), rewrote the copy to match what
`checkGatewayUrl`'s `'url'` mode actually allows (`10.0.2.2` accepted, `127.0.0.1`/`localhost`
rejected — the old text said the opposite about `10.0.2.2`). Updated the one call site
([`app/connect/index.tsx`](../app/connect/index.tsx)). Guard rejection strings
(`connectRejectedLoopback`/`EmulatorHost`/`Unspecified`) left untouched as instructed. No test
referenced the old constant name, so none needed updating (`npm run check` confirms). Committed
`c78b2c3`. Device-verified this round on the signed build (§6c below,
`tester-build/url-hint-text.png`) — the new text renders correctly on the "Enter a URL" screen.

## Item 2 — v3/v4 APK signing

**Done, device-verified for v2/v3 as scoped; v4 attempted with an open, named anomaly.** Added
`enableV3Signing true` and `enableV4Signing true` to
[`plugins/withReleaseSigning.js`](../plugins/withReleaseSigning.js) (v2 was already explicit).
Committed `ea1404c`. Built via `run-release-verify-build.sh`, verified with `apksigner verify
--verbose` against the built APK (sha256 `c2024d62698d1bbf833c170d83f3815f3d7fee177b08475fbaeb9c4fb2dca433`)
with its `.apk.idsig` sidecar present:

```
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Verified using v4 scheme (APK Signature Scheme v4): false
```

v2 and v3 both `true` — the task's explicit requirement — met and evidenced
(`tester-build/inspect-apk-output.txt`). v4: the `.apk.idsig` sidecar file exists (AGP did generate
it) and `adb install` reported "Performing Incremental Install" (a behavior gated on v4/idsig
metadata being recognized), but `apksigner verify`'s own summary line reports v4 `false`.
**Inferred, not confirmed:** this is plausibly because `minSdkVersion` is 24, below the API-30
threshold v4/incremental-install targets — not investigated further since v4 wasn't part of the
task's stated pass/fail bar.

## Item 3 — CONNECTING.md Tailscale-pairing note

**Done.** Added one line to [`docs/CONNECTING.md`](../docs/CONNECTING.md) before "Find your
tailnet address," stating the in-app Tailscale pairing card is not in 0.1.0 and that host-side
guidance below it still applies via manual URL entry. Committed `f68916a`. This is a docs-only
change; no device verification applicable beyond item 6c's confirmation that `SHOW_TAILSCALE_PAIRING`
is in fact off on the built APK (no Tailscale entry point visible).

## Item 4 — RELEASE-NOTES-0.1.0.md

**Done.** Wrote [`docs/RELEASE-NOTES-0.1.0.md`](../docs/RELEASE-NOTES-0.1.0.md): what the app is,
what was verified this round on a signed build (connect-by-URL, chat with a real model, Run/Reject
approvals, the background notification), what's explicitly not in this build (in-app Tailscale
pairing, push, the six D18-hidden screens), the `http://` tradeoff, the never-tested-on-physical-
hardware caveat, and a 5-step install/connect flow. Calibrated against
`an internal review note (not published)` §3's standard — claims are scoped to what this round actually
saw, not what the app is supposed to do. Committed `53d9fad`.

## Item 5 — D20 readiness check

**Done.** Ran all six D20 items against this branch with evidence and named verdicts in
[`docs/D20-READINESS-0.1.0.md`](../docs/D20-READINESS-0.1.0.md). Summary: only item 3 (identity)
is met; items 1, 2, 4, 5, 6 are not met, each for a real, named reason (tag/key are the user's;
`[physical]` waivers are Opus's; the tracker edit is Opus's; the merge-to-`main` pass is Opus's per
D21.3.3; a genuine open doubt about a second approval card exists). Committed `66da449`. Nothing
here was softened to raise the count — the report explicitly says "this branch does not pass D20
for any audience yet."

## Item 6 — rebuild and device-verify

### 6a — build

**Done, device-verified.** Built via `run-release-verify-build.sh` as a single long-lived
background `wsl.exe` call, polled only via reading the Windows-side log file
(`release-build6.log`) — this pattern avoided the VM-teardown problem seen earlier in the session.
`BUILD SUCCESSFUL`. Output: `hermes-mobile-0.1.0-verify.apk` (148 MB) + `.apk.idsig` sidecar, both
in `D:\Stuff\hermes-android-field\tester-build\`.

**sha256 of this APK, named behind every claim below:**
`c2024d62698d1bbf833c170d83f3815f3d7fee177b08475fbaeb9c4fb2dca433`

### 6b — inspect built APK

**Done, device-verified.** `inspect-apk.sh` output (`tester-build/inspect-apk-output.txt`):

- Identity: `package: com.symbyotic.hermes.mobile`, `application-label: 'Hermes Mobile'`,
  `minSdkVersion 24` / `targetSdkVersion 36`.
- Signer: `CN=Hermes Android release-pipeline verification, O=throwaway` — the verification
  keystore, **not** the real signing key.
- Schemes: v2 `true`, v3 `true`, v4 `false` (see item 2's named anomaly).
- `debuggable`: absent (correct for release).
- `networkSecurityConfig`: present, resolves to a real resource (Opus's `withCleartextTraffic.js`
  round).
- Dev-launcher classes: 0.

### 6c — install, cold start, hint text

**Done, device-verified.** `adb uninstall` (removed any prior install) → install → cold start.
`coldstart.png` shows a clean launch; the "Enter a URL" screen's hint text matches item 1's new
`CONNECT_URL_HINT` copy exactly (`url-hint-text.png`).

### 6d — connect and chat turn with deepseek-v4-flash

**Done, device-verified, with pasted evidence.** Connected to `http://10.0.2.2:9128` (the reused
gateway already running on that port, per the standing rule — not restarted, not reconfigured).
Detected auth mode (basic), signed in as `tester`. Created a new session, switched its model from
the default `mimo-v2.5` to `deepseek-v4-flash` via the model picker, sent "Say the word ready if
you can hear me.", got back "Ready." (12.9k tok, 6.4 tok/s). The gateway's own `agent.log`
independently confirms the same turn:

```
2026-09-18 22:05:12,450 ... conversation turn: session=20260918_220219_4bdcae model=deepseek-v4-flash
  provider=opencode-go platform=android history=1 msg='Say the word ready if you can hear me.'
2026-09-18 22:05:16,700 ... API call #1: model=deepseek-v4-flash provider=opencode-go in=12900
  out=27 total=12927 latency=4.2s cache=1536/12900 (12%)
2026-09-18 22:05:17,504 ... Turn ended: reason=text_response(finish_reason=stop)
  model=deepseek-v4-flash api_calls=1/40 budget=1/40 tool_turns=0 last_msg_role=assistant
  response_len=6 session=20260918_220219_4bdcae
```

Full excerpt: `tester-build/6d-gateway-log.txt`. Screenshots and UI dumps for every step:
`tester-build/{url6,url7}.xml`, `connected-screen.png`, `after-done.png`,
`{new1,model1,model2,model3,model4}.xml`, `composer*.{xml,png}`, `chat-sent*.png`, `perm1.xml`,
`chat-reply*.png`.

**Notable side observation, not asked for but worth recording:** sending this message triggered
the OS notification-permission dialog ("Allow Hermes Mobile to send you notifications?") — Task
B's ask-once-on-first-message fix, seen firing correctly and unprompted in the wild, not staged.
Tapped Allow to let the turn proceed.

**Note on method, not a product defect:** `adb shell input text` silently drops literal spaces
when passed through this shell; the first attempt to type the message left only "Say" in the
composer. Fixed by escaping spaces as `%s` on retry (`tester-build/composer-check2.png` shows the
corrected full text before sending).

### 6e — upgrade-install check

**Done, device-verified.** `adb install -r` with the **same** APK (same sha256 as above) over the
already-installed copy: `Success` (adb also printed "Performing Incremental Install" ahead of the
streamed install). `am force-stop` + relaunch: app opened directly to the Sessions list showing
the "Test audio connection" session from 6d, no re-login prompted —
connection/session state survived the reinstall (`tester-build/6e-after-upgrade-coldstart.png`).
Logcat around the relaunch shows a clean `ActivityTaskManager: Displayed
com.symbyotic.hermes.mobile/.MainActivity ... +1s657ms` with no `FATAL`/`AndroidRuntime` lines.

**Not tested, and not testable here:** installing a *differently-signed* build over this one.
Android refuses cross-signature upgrades at the OS level — this is stated as a fact about Android,
not demonstrated, since demonstrating it would require producing a second, differently-signed
build. **Real testers will need to uninstall this verification build once the real signing key
ships** — named explicitly so it isn't discovered the hard way later.

## What was not touched

Per the standing rules: the user's own `hone`/Home connection was not touched; the `hermes`
gateway process already running on port 9128 (PID observed at `03:32:45` this session) was reused
as-is, not restarted or reconfigured; `timeout 20` (or longer, explicitly, for the one 60s install
call) was used on adb calls; every tap was preceded by a fresh `uiautomator dump` once a coordinate
mismatch was suspected, per the round's own rule.

## Verification gate before push

`npm run check` (typecheck, vitest — 822 passed, plugin unittest — 52 passed, eslint, prettier)
run clean on the final tree before this doc was committed.

## Evidence index

Full file-by-file breakdown: `D:\Stuff\hermes-android-field\tester-build\INDEX.md`.
