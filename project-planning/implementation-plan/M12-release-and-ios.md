# M12 — Release hardening + iOS

**Status:** in-progress (release/0.1.0: identity, signing pipeline, cleartext config and tester docs landed 2026-09-18; D20 readiness 1 of 6 met — see docs/D20-READINESS-0.1.0.md on that branch)
**Depends on:** M08, M09, M10, M11
**Goal:** Signed Android release on the Play internal track; iOS build from the same code.

## Tasks

- [ ] Release builds via **EAS Build** (decision D3): `eas.json` with `development`, `preview`, and `production` profiles; signing credentials managed by EAS, never stored in the repo or on one machine; version and build-number scheme. `apk:release` via local Gradle (WSL2) stays as an optional fallback only.
- [ ] Privacy policy and Play data-safety form (the client collects nothing); app icon and splash
  - **Flag from M14 (2026-09-12):** `app/(main)/settings/billing.tsx` is informational-only today
    (no billing/credits API exists on mobile — see M14 Deviations), but if a future milestone adds a
    "manage plan" action that leaves the app for checkout, Google Play's external-payment-link
    policy needs a look before that build goes to any track. Informational copy alone isn't a
    concern; a live payment/checkout link would be. Not a decision for M14 to make — a reminder for
    whoever picks up this task.
- [ ] Memory and performance pass: under 300 MB, 60 fps transcript scroll on a mid-range device
- [ ] Crash reporting decision (opt-in only)
- [ ] `expo prebuild --platform ios`; verify the SocketRocket subprotocol handshake against the server's `hermes-gateway-v1` echo; Keychain via SecureStore; APNs through Expo Push (same code); sessions send `source: 'ios'`
- [ ] Loopback listener module built for iOS

## Deliverables

- Signed AAB/APK on the Play internal track; iOS build that streams a turn

## Exit criteria

- The internal-track build installs from Play and completes M03's on-device checks.
- An iOS simulator build streams a turn end to end.
