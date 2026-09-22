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

# ABI guard (Part 3 / D26): expo prebuild's generated gradle.properties lists
# all four ABIs by default, but a build run under
# ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64 (this project's own
# faster-evidence-build convention for emulator-only device passes) narrows
# the APK to that one ABI — fine for an emulator, unusable on the user's real
# (arm64) phone. Prints the APK's actual lib/ ABI list and fails unless
# arm64-v8a is present, so a narrowed build can never leave this script
# silently believing it produced something installable on real hardware.
# `ALLOW_EMULATOR_ONLY_ABI=1` opts out for a deliberate emulator-only
# evidence build (never for anything meant to ship).
#
# Every `lib/` entry in the APK zip, one per line — tries `unzip`, then
# Python's zipfile module, then the JDK's own `jar` (guaranteed present:
# this script already requires a JDK for the Gradle build itself). Prints
# nothing and returns non-zero only when none of the three exist, so a
# missing lister can never be silently read as "no lib/ entries" (which
# check_apk_has_arm64 would otherwise treat the same as a genuinely
# ABI-less APK and fail the build on a false premise — found live: this
# WSL2 image has no `unzip`, which turned a real, correctly-built APK into
# a reported build failure).
list_apk_lib_entries() {
  local apk_path="$1"

  if command -v unzip >/dev/null 2>&1; then
    unzip -l "$apk_path" | grep 'lib/' || true

    return 0
  fi

  # `command -v python3` alone isn't enough of a check: some environments
  # (this repo's own git-bash on Windows, for one) put a non-functional
  # Microsoft Store shortcut on PATH under that name, which exits without
  # ever running Python — `import zipfile` is a real functional probe, not
  # just a presence check. Tries `python` too (this codebase's own other
  # scripts already do, for exactly this reason) for a plain `python3`-less
  # interpreter.
  local py
  for py in python3 python; do
    if command -v "$py" >/dev/null 2>&1 && "$py" -c "import zipfile" >/dev/null 2>&1; then
      "$py" -c "
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    for name in z.namelist():
        if name.startswith('lib/'):
            print(name)
" "$apk_path" || true

      return 0
    fi
  done

  if command -v jar >/dev/null 2>&1; then
    jar tf "$apk_path" | grep '^lib/' || true

    return 0
  fi

  return 1
}

# Extracted as its own function so it can be exercised directly against a
# fake APK zip (no Gradle build needed) — see
# scripts/test-abi-guard.sh, which builds two throwaway zips (one with
# lib/arm64-v8a/, one without) and asserts this function passes one and
# fails the other, plus the ALLOW_EMULATOR_ONLY_ABI=1 override.
check_apk_has_arm64() {
  local apk_path="$1"
  local abi_list

  if ! abi_list="$(list_apk_lib_entries "$apk_path")"; then
    echo "build-release-apk: no zip lister available (checked unzip, python3, jar) —" >&2
    echo "cannot verify $apk_path's ABI contents. Install unzip (simplest:" >&2
    echo "apt-get install unzip / apk add unzip) and re-run — this check refuses to" >&2
    echo "silently pass an unverified APK rather than guess." >&2

    return 2
  fi

  echo "build-release-apk: ABI list in $apk_path:"
  if [ -n "$abi_list" ]; then
    echo "$abi_list"
  else
    echo "  (no lib/ entries at all)"
  fi

  if echo "$abi_list" | grep -q 'lib/arm64-v8a/'; then
    return 0
  fi

  if [ "${ALLOW_EMULATOR_ONLY_ABI:-}" = "1" ]; then
    echo "build-release-apk: lib/arm64-v8a/ missing, but ALLOW_EMULATOR_ONLY_ABI=1 — allowing." >&2

    return 0
  fi

  echo "build-release-apk: lib/arm64-v8a/ missing from $apk_path." >&2
  echo "This APK cannot install on the user's phone (arm64). If this was a deliberate" >&2
  echo "emulator-only evidence build (e.g. ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64)," >&2
  echo "set ALLOW_EMULATOR_ONLY_ABI=1 and re-run. Otherwise, rebuild without narrowing" >&2
  echo "reactNativeArchitectures." >&2

  return 1
}

# Sourced by the test harness to exercise check_apk_has_arm64 alone, without
# running the rest of this script (the keystore env-var checks below would
# otherwise fire first).
if [ "${BUILD_RELEASE_APK_SOURCE_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

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
check_apk_has_arm64 "$APK_PATH"

echo ""
echo "build-release-apk: done."
echo "  APK:    $APK_PATH"
echo "  sha256: $SHA256"
