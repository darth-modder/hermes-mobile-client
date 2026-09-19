#!/bin/bash
# Exercises check_apk_has_arm64 (build-release-apk.sh's ABI guard, Part 3 /
# D26) against fake APK zips — no Gradle build needed. Run:
#   bash scripts/test-abi-guard.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

export BUILD_RELEASE_APK_SOURCE_ONLY=1
# shellcheck source=./build-release-apk.sh
source "$REPO_ROOT/scripts/build-release-apk.sh"
unset BUILD_RELEASE_APK_SOURCE_ONLY

pass_count=0
fail_count=0

assert() {
  local description="$1"
  local expected="$2" # "pass" or "fail"
  local actual_status="$3"

  if { [ "$expected" = "pass" ] && [ "$actual_status" -eq 0 ]; } ||
    { [ "$expected" = "fail" ] && [ "$actual_status" -ne 0 ]; }; then
    echo "ok   - $description"
    pass_count=$((pass_count + 1))
  else
    echo "FAIL - $description (expected $expected, got exit $actual_status)"
    fail_count=$((fail_count + 1))
  fi
}

# Builds a fake APK zip with the given lib/<abi>/libhermes.so entries.
# Uses Python's zipfile (no `zip` binary in this Git-Bash environment;
# `unzip`, which the guard itself uses to read the list back, is present).
make_fake_apk() {
  local out_path="$1"
  shift
  python -c "
import sys, zipfile
out_path = sys.argv[1]
abis = sys.argv[2:]
with zipfile.ZipFile(out_path, 'w') as zf:
    for abi in abis:
        zf.writestr(f'lib/{abi}/libhermes.so', b'fake')
" "$out_path" "$@"
}

# --- fake APK with arm64-v8a present -----------------------------------
ARM64_APK="$WORK_DIR/with-arm64.apk"
make_fake_apk "$ARM64_APK" arm64-v8a x86_64

set +e
check_apk_has_arm64 "$ARM64_APK" >"$WORK_DIR/out1.log" 2>&1
status=$?
set -e
cat "$WORK_DIR/out1.log"
assert "an APK with lib/arm64-v8a/ passes with no override needed" pass "$status"

# --- fake APK with only x86_64 (emulator-narrowed build) ---------------
X64_APK="$WORK_DIR/x86-only.apk"
make_fake_apk "$X64_APK" x86_64

set +e
unset ALLOW_EMULATOR_ONLY_ABI
check_apk_has_arm64 "$X64_APK" >"$WORK_DIR/out2.log" 2>&1
status=$?
set -e
cat "$WORK_DIR/out2.log"
assert "an x86_64-only APK fails without the override" fail "$status"

set +e
ALLOW_EMULATOR_ONLY_ABI=1 check_apk_has_arm64 "$X64_APK" >"$WORK_DIR/out3.log" 2>&1
status=$?
set -e
cat "$WORK_DIR/out3.log"
assert "the same x86_64-only APK passes with ALLOW_EMULATOR_ONLY_ABI=1" pass "$status"

echo ""
echo "test-abi-guard: $pass_count passed, $fail_count failed."

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
