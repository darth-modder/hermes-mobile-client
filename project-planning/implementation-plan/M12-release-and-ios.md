# M12 — Release hardening + iOS

**Status:** todo
**Depends on:** M08, M09, M10, M11
**Goal:** Signed Android release on the Play internal track; iOS build from the same code.

## Tasks

- [ ] Release builds via **EAS Build** (decision D3): `eas.json` with `development`, `preview`, and `production` profiles; signing credentials managed by EAS, never stored in the repo or on one machine; version and build-number scheme. `apk:release` via local Gradle (WSL2) stays as an optional fallback only.
- [ ] Privacy policy and Play data-safety form (the client collects nothing); app icon and splash
- [ ] Memory and performance pass: under 300 MB, 60 fps transcript scroll on a mid-range device
- [ ] Crash reporting decision (opt-in only)
- [ ] `expo prebuild --platform ios`; verify the SocketRocket subprotocol handshake against the server's `hermes-gateway-v1` echo; Keychain via SecureStore; APNs through Expo Push (same code); sessions send `source: 'ios'`
- [ ] Loopback listener module built for iOS

## Deliverables

- Signed AAB/APK on the Play internal track; iOS build that streams a turn

## Exit criteria

- The internal-track build installs from Play and completes M03's on-device checks.
- An iOS simulator build streams a turn end to end.
