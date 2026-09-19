# D20 readiness check — release/0.1.0, closed-test audience (2026-09-18)

> **Main is UNVERIFIED from `2a5424f` onwards (D28.4, 2026-09-19).** The D23/D24/D25/D26/D27 fixes are merged
> and unit-tested (887 tests), but their device acceptance runs in one sitting on merged main that
> has not happened yet. Until it passes: no tag, no real-key APK, nothing leaves the machine.

Run against `project-planning/DECISIONS.md`'s D20 checklist, for the "closed test" audience
(D20.4: named people, a signed build, items 1/3/4/5/6 met, physical rows may be waived). Per D21.1,
every verdict below names its evidence and scope. **Several items are not met** — reported as such,
not smoothed over. Waiving anything is Fable's/Opus's call (D21.3.6 assigns the D20 closed-test
check itself to Opus), not mine; I report the state, I don't waive it.

## 1. An installable non-dev build exists: signed, tagged, cold-started once, no dev-client overlay

**Partly met.** Signed: yes — the release build (this round, sha256 in §6 below) is signed with
`enableV2Signing`/`enableV3Signing`/`enableV4Signing` all `true` (this round's item 2), using a
verification keystore. **Not the real signing key** — that key is the user's to create (D11.2,
D22.5), and hasn't been. Cold-started: yes, multiple times, `LaunchState: COLD` (§6). No dev-client
overlay: yes, a release build has none. **Tagged: no** — no git tag exists on this branch or
anywhere in the repo for 0.1.0; tagging is explicitly the user's/Opus's step after verification
(D21.3.6, and this round's own instructions: "don't merge, don't tag").

**Verdict: not met.** The blocking piece (a tag, and the real signing key it should point at) is the
user's, named as such rather than worked around.

## 2. No open `[physical]` register rows, or each waived for this audience

**Not met, and not waived here.** `project-planning/implementation-plan/README.md`'s deferred
criteria register currently lists seven open `[physical]` rows: M04 (cookie persistence), M06
(2,000-message frame rate), M07 ×3 (airplane mode, doze, Wi-Fi→cellular), M08 (Portal OAuth via
Custom Tabs), M11 (backgrounded push approval). The register's own text says "M12 does not ship
with an open `[physical]` row" and that unwaived rows return to Fable as a policy escalation if no
device is attached by 2026-10-31 — neither has happened yet as of this check.

D21.3.6 assigns waiving physical rows, by name, for named testers, to **Opus**, as part of Opus's
own D20 closed-test pass — not to this round. **Verdict: not met, pending that waiver decision.**

## 3. Identity reviewed: app name, package id, unaffiliated notice

**Met.** Name: "Hermes Mobile" (`src/lib/app-identity.ts`). Package id / iOS bundle id:
`com.symbyotic.hermes.mobile` (`app.config.ts`, confirmed in the built APK's manifest, §6).
Unaffiliated notice — *"An independent, open-source client for Hermes Agent. Not affiliated with or
endorsed by Nous Research."* — renders on the About screen and the connect screen footer (device-
confirmed, `project-planning/RELEASE-PREP-2026-09-18.md`'s B1) and opens `README.md`'s first
paragraph. D20's own disqualifying example — `name: 'Hermes'` with `com.nousresearch.hermes.mobile`
— does not apply; neither string appears anywhere in shipped code (D22.1 grep, same report).

**Verdict: met.**

## 4. The tracker README and the root README match the milestone files

**Not met.** `project-planning/implementation-plan/README.md`'s milestone table currently shows
M13 `in-progress`, M14 `todo`, M15 `todo` — but `DECISIONS.md` D15 (M13 close-out), and the merge
commit `5d4871f`/`ff1d8c7` ("decide(M15): close M15 — group E ticked, status done") both record all
three as closed and merged to `main`. The root `README.md`'s "Status" line still reads "Milestones
M00–M03 and M05 are complete" — written before M04, M06 through M11 (partly), M13, M14, and M15 all
progressed; it names none of them.

D20.3 is explicit that only Opus edits the tracker on a milestone close ("handover rule 5 stands").
This is a real, visible gap, not something to quietly fix in this round by editing a file I don't
own the write authority for. **Verdict: not met — named as Opus's fix, per the task's own framing,
not attempted here.**

## 5. Every feature named in the claim seen end to end on a build of merged `main`, with a real model on the wire, since the last change to its screen

**Not met, on the letter of it — but the underlying verifications are real and recent.**
`docs/RELEASE-NOTES-0.1.0.md`'s claim list (connect-by-URL + password sign-in, chat with a real
model, approval Run/Reject, the background notification) was verified this round, on real hardware,
with real models (`mimo-v2.5`, `deepseek-v4-flash` — the latter's session is §6d below) — **but on
`release/0.1.0`, not a build of merged `main`.** None of this branch's commits (D22 identity onward)
have been merged. D21.3.3 assigns exactly that merge-and-full-pass to Opus, and it hasn't happened
yet.

Per-claim, since each screen's own last change:
- Connect screen: last changed by Opus's cleartext round (`381f11e`/`fb12304`, hiding Tailscale and
  adding the unencrypted warning) and this round's hint fix (`c78b2c3`) — verified after both, on
  this branch.
- Composer / approval card: last changed by this round's own polish fixes and the
  notification-permission fix — verified after, on this branch.

**Verdict: not met** (branch, not merged `main`) — the individual claims have real, dated, on-device
evidence; the specific gate this item names has not been passed.

## 6. No known defect in the approval, sudo or secret path open without a root cause

**Not met.** `project-planning/FIX-APPROVAL-PATH-2026-09-18.md` §6 records a real, unresolved doubt:
a prior session's own evidence (read this round, not generated) showed a second approval card's
buttons absent from the accessibility tree 40–104 seconds after the server sent it, on a build
already carrying the scroll-to-bottom fix. That report's own words: the fix "should be treated as
proposed, not confirmed closed." Sudo and secret have no live verification at all this round or
recorded recently — `FIX-APPROVAL-PATH-2026-09-18.md` §3 is a code-level "the mechanism is shared"
argument, not a device observation of either card.

This round's own approval testing (`NOTIF-PERMISSION-FIX-2026-09-18.md`) drove Run and Reject
successfully and saw a real background notification fire — genuine new evidence the mechanism
works in at least those cases — but does not touch the specific stranded-card doubt above, which is
about a *second* approval arriving in the *same* session.

**Verdict: not met** — a named, real doubt about the approval path's root cause is still open;
sudo/secret have no recent device evidence either way.

## Summary

| # | Item | Verdict |
|---|---|---|
| 1 | Installable signed build, cold-started, no dev overlay | Partly met — tag and real key are the user's |
| 2 | No open `[physical]` rows, or waived | Not met — 7 open rows, waiver is Opus's call |
| 3 | Identity reviewed | **Met** |
| 4 | Tracker/root README match milestone files | Not met — Opus's fix |
| 5 | Every claimed feature seen on merged `main` with a real model | Not met — verified on the branch, not merged `main` |
| 6 | No open approval/sudo/secret defect without root cause | Not met — a named, real doubt is open |

**This branch does not pass D20 for any audience yet.** One item (identity) is clean. The rest name
real, specific gaps — a tag and signing key only the user can produce, a tracker edit only Opus
makes, a merge-to-`main` pass D21.3.3 already assigns to Opus, and a genuinely open approval-path
question that the next live pass should target directly rather than assume closed. Nothing here was
softened to make the count look better.

## Opus update — 2026-09-19 (items 4, 5, 6)

Run by Opus on emulator-5554 (Android, API 36), throwaway gateway `http://10.0.2.2:9128`, model
`mimo-v2.5`. Evidence: `D:\Stuff\hermes-android-field\opus-approval-live\` (outside the repo).
Nothing here is from a physical phone.

**Item 4 — met.** Tracker and root README corrected on `main` in `7f9a108` (M12 in-progress; M13,
M14, M15 done; root status paragraph rewritten).

**Item 5 — met (emulator).** `release/0.1.0` and `fix/upstream-repin` merged into `main` (`ab98e6e`).
On that tree: `npm run check` green (77 files / 822 vitest, 52 plugin tests, lint, prettier);
`sync-upstream.mjs` re-run gave no diff. Release APK built from `main` `2eb0b36` (code identical to
`ab98e6e`) with the throwaway verification key, sha256
`9a4c2f645b9c322cb3613f0b3641eb9a5fa6f04cd05d781700294e5f3383e200`, installed as
`com.symbyotic.hermes.mobile`. On that APK, each claim end to end:

| Claim | Result |
|---|---|
| Connect by URL + password sign-in | Pass — Add connection → Enter a URL → Detect auth mode ("Gated backend — password sign-in") → Sign in → Connected |
| Chat with a real model | Pass — mimo-v2.5 replies streamed in a new session |
| Approval Run / Reject | Pass — Run deleted the scratch dir; Reject blocked it (dir still on disk, model reported the block). Both cards visible without scrolling this run |
| Background notification | Pass — app backgrounded mid-turn; "Approval needed · rm -rf …" posted within seconds; tapping it opened the session with the card visible |

**Item 6 — not met.** `fix/approval-path` was **not** merged. With it applied (dev client, JS from
`release/0.1.0` + `ffa268e`), 3 of 6 approval cards stayed off-screen with no scrolling — first and
second approvals alike; one sat pending until the gateway timed the command out at 300 s. Root cause,
measured with temporary logging: both `scrollToOffset(0)` calls fire (the request effect, then the
header-`onLayout` correction), but the inserted header card makes `maintainVisibleContentPosition`
shift the inverted list's offset away from the tail (onScroll y 69 → 366), overriding them. The root
cause is now known, but the defect is open and hits a claimed feature intermittently (the release-APK
run above happened to show all three cards), so this is not counted as met. Sudo and secret cards
still have no device evidence. Next step is a fix round (card outside the list, or neutralising
`maintainVisibleContentPosition` while a blocking card is pending), then a no-scroll pass of at least
8 approvals.

**Found on the way — not D20 items, but a tester would hit them:**
- **Sign-out dead end.** After Sign out, Registered gateways shows "needs sign-in" with no Sign in
  button, and Sessions shows "Authentication failed — check the password." with only Retry. The only
  way back is Remove and re-add. (The session banner's "Sign in again" did not appear.)
- **Version string.** `app.config.ts` and `package.json` say `1.0.0`; the APK reports
  `versionName 1.0.0`. The release is called 0.1.0.
- **Tailscale still suggested.** The Gateway URL placeholder is `https://your-pc.tailnet.ts.net:9119`.
- **Desktop copy on mobile.** Connect screen: "Hermes Desktop will detect whether it needs a token or
  browser sign-in."
- **History drops an approved tool call.** Reopening a session renders the `ls` tool card but not the
  approved `rm -rf` one. Identical on a pre-repin build, so not from the re-pin.
- Cosmetic: the assistant bubble shrinks to short tool cards and wraps the reply narrowly (not A/B
  tested; the re-pin touches no layout code); the notification small icon is a plain ring.

| # | Item | Verdict (2026-09-19) |
|---|---|---|
| 1 | Installable signed build, tagged | Partly met — real key and tag are the user's; version string wrong |
| 2 | `[physical]` rows | Not met — waiver needs named testers first |
| 3 | Identity | Met |
| 4 | Tracker/README | **Met** |
| 5 | Claimed features on merged `main` | **Met (emulator)** |
| 6 | Approval path | Not met — root-caused, not fixed |
