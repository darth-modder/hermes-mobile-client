# Releasing a signed APK

Distribution is a signed release APK attached to a GitHub Release — no Play Store, no EAS Build
(decision D22.5, which amends D3 and D16.4). This doc is the user's own checklist; Sonnet writes
and verifies the tooling but never creates the keystore and never sees its real passwords
(D11.2, D22.5).

## 1. Create the signing key (once, by the user, on their own machine)

Nobody else should do this step. The key is the permanent thing about this project from here on:
Android refuses to install an update signed by a different key over an existing install, so a lost
key means every user must uninstall and lose their local data (connections, settings) to get a
future update at all.

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias hermes-mobile \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` prompts for a keystore password and a key password (they may be the same value) and some
identity fields (name, org, etc. — these end up in the certificate, not in the app; any values are
fine). **Back the resulting `release.keystore` file up in two places that don't share a single
point of failure** — for example a password manager's file storage plus an encrypted external
drive, or two different cloud accounts. Never commit it to the repository (`.gitignore` already
excludes `*.keystore` and `*.jks`).

## 2. Build

From WSL2 (decision D3 — local Gradle builds fail outright on Windows on this machine; see
`docs/CONNECTING.md`'s "Build path: WSL2, not Windows Gradle" section for why):

```bash
export HERMES_KEYSTORE_PATH=/mnt/c/path/to/release.keystore   # or wherever it lives
export HERMES_KEYSTORE_PASSWORD='...'
export HERMES_KEY_ALIAS=hermes-mobile
export HERMES_KEY_PASSWORD='...'
bash scripts/build-release-apk.sh
```

The script fails immediately with a clear message if any of the four variables is unset, or if
`HERMES_KEYSTORE_PATH` doesn't point at a real file. It prints the built APK's path and its sha256
on success. It reads the four variables at run time only — it never writes them to a file, a log,
or `android/local.properties` (the actual signing wiring is `plugins/withReleaseSigning.js`, an
Expo config plugin that bakes `System.getenv(...)` *calls* into the generated
`android/app/build.gradle`, so Gradle itself reads the real values at build time; the generated
file — like all of `android/`, D3 — is git-ignored and disposable).

Cold builds take roughly 20–32 minutes (D3); faster once `~/.gradle` is warm.

## 3. Tag and publish the GitHub Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

### Version history

`android.versionCode` (`app.config.ts`) is an integer starting at 1, raised by one for every APK
that leaves this machine — including a re-spin of the same version string. It is never reused and
never derived (D23 decision 2.2). Add a row here only when an APK actually leaves this machine.

| versionCode | version | commit | APK sha256 | date |
|---|---|---|---|---|
| — | — | — | — | — |

Then, on GitHub, create a Release from that tag with:

- The APK attached.
- Its sha256 (printed by the build script) in the release notes, so anyone can verify the download
  matches what was built.
- The known-gaps list for this version (whatever isn't finished yet — check
  `project-planning/implementation-plan/README.md`'s tracker).
- The unaffiliated statement (`src/lib/app-identity.ts`'s `UNAFFILIATED_NOTICE` — copy it verbatim):
  *"An independent, open-source client for Hermes Agent. Not affiliated with or endorsed by Nous
  Research."*
- Sideload instructions for users (below) — most people installing an APK outside the Play Store
  have never done this before.

**Every release must pass D20's readiness check for its audience before it's tagged** — a build
existing is not the same as it being ready to hand to anyone. D18's hide switch applies to a public
GitHub release exactly as it would to a store build: `APP_AUDIENCE=public` (which
`scripts/build-release-apk.sh` sets) hides the six still-inert screens.

## 4. Sideload instructions (for the release notes)

Android blocks installing APKs from outside the Play Store by default. To install:

1. Download the APK from the GitHub Release onto the phone (or `adb install app-release.apk` from
   a computer with the phone connected over USB debugging).
2. Opening the file from a browser or file manager prompts to allow installs from that app — allow
   it for this one install (Android doesn't ask again for regular Play Store apps, only for this
   kind of one-off).
3. Play Protect may warn that the app isn't recognized, since it didn't come from the Play Store.
   That warning is expected for every GitHub-distributed APK, not specific to this app.

## Updates

There is no store, so there is no auto-update. 0.1.x ships without an in-app update checker; a
check against the GitHub Releases API is a later task, not a release blocker (D22.5). Until then,
users repeat the sideload steps above for each new release — installing a new APK signed with the
same key updates the app in place and keeps its data.

## What this doc does not cover

- Push notifications stay off in APK-only releases until the user creates an Expo project
  (`eas init`) and FCM credentials (D22.5) — no Play developer account is needed for that either.
- Changing the repository's visibility to public, and creating the tag/Release itself, are the
  user's and Opus's steps after a D20 verification pass — not something this script or doc
  performs automatically.
