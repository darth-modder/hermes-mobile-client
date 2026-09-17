#!/bin/bash
# Builds a signed release APK. Run from WSL2 (decision D3: local Gradle
# builds fail outright on this Windows machine, independent of JDK choice —
# see docs/CONNECTING.md's "Build path: WSL2, not Windows Gradle" section).
#
# Reads the keystore path and passwords from the environment at run time and
# never writes them anywhere (not to a file, not to a log, not to
# android/local.properties or any other generated file) -- D22.5 / D11.2:
# Sonnet writes this script but never creates the keystore and never sees
# its real passwords. The actual signing wiring lives in
# plugins/withReleaseSigning.js, an Expo config plugin that bakes
# `System.getenv(...)` calls (not values) into the generated
# android/app/build.gradle at prebuild time, so the real secrets are read
# once, by Gradle, at build time.
#
# Usage (from WSL2, repo root):
#   HERMES_KEYSTORE_PATH=/mnt/c/path/to/release.keystore \
#   HERMES_KEYSTORE_PASSWORD=... \
#   HERMES_KEY_ALIAS=... \
#   HERMES_KEY_PASSWORD=... \
#   bash scripts/build-release-apk.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

for var in HERMES_KEYSTORE_PATH HERMES_KEYSTORE_PASSWORD HERMES_KEY_ALIAS HERMES_KEY_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "build-release-apk: \$$var is not set. All four of HERMES_KEYSTORE_PATH," >&2
    echo "HERMES_KEYSTORE_PASSWORD, HERMES_KEY_ALIAS and HERMES_KEY_PASSWORD must be" >&2
    echo "exported before running this script. See docs/RELEASING.md." >&2
    exit 1
  fi
done

if [ ! -f "$HERMES_KEYSTORE_PATH" ]; then
  echo "build-release-apk: no file at \$HERMES_KEYSTORE_PATH ($HERMES_KEYSTORE_PATH)." >&2
  exit 1
fi

# D18: a distributed release is a public build (D20.4's gate applies to it
# exactly as to a store build).
export APP_AUDIENCE=public

echo "build-release-apk: prebuilding (APP_AUDIENCE=public)…"
npx expo prebuild --platform android --clean

# `expo prebuild`'s `android/local.properties` points at whichever SDK the
# invoking shell's $ANDROID_HOME resolves to; docs/CONNECTING.md's WSL2
# section says this must be the Linux-native SDK, not the Windows one, and
# names its default install path on this machine.
echo "sdk.dir=${ANDROID_HOME:-$HOME/Android/Sdk}" > android/local.properties

echo "build-release-apk: assembleRelease (this takes ~20-32 min cold, per D3)…"
(cd android && ./gradlew assembleRelease --no-daemon)

APK_PATH="$REPO_ROOT/android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APK_PATH" ]; then
  echo "build-release-apk: assembleRelease reported success but $APK_PATH is missing." >&2
  exit 1
fi

SHA256="$(sha256sum "$APK_PATH" | cut -d' ' -f1)"

echo ""
echo "build-release-apk: done."
echo "  APK:    $APK_PATH"
echo "  sha256: $SHA256"
