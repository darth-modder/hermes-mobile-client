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
# Uses Python's zipfile (no `zip` binary in this Git-Bash environment; WSL2
# has the reverse gap — `python3` but no plain `python`, no `unzip` at all —
# so this tries both names rather than assuming either is the one present).
make_fake_apk() {
  local out_path="$1"
  shift
  local py
  py="$(command -v python3 || command -v python)"
  "$py" -c "
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

# --- portable-lister fallbacks (found live: a WSL2 image with no `unzip`
# turned a real, correctly-built APK into a false build failure) ----------

# A PATH with only `grep` (list_apk_lib_entries's own listing commands pipe
# through it, and check_apk_has_arm64 greps the result afterward — a
# realistic restriction leaves standard POSIX utilities in place) plus
# whichever target binaries are passed, aliased under the given name — so
# `command -v` genuinely can't find anything else the fallback chain isn't
# meant to use. A tiny exec wrapper rather than a symlink: some of these
# binaries resolve to a Windows execution-alias stub that plain `ln -s`/`ln`
# can't target, and aliasing under a different name (real "python" made
# reachable as "python3") needs a wrapper regardless.
#
# Args: bin_dir suffix, then any number of "alias_name=real_command" pairs.
restricted_path_with() {
  local bin_dir="$WORK_DIR/bin-$1"
  mkdir -p "$bin_dir"
  shift

  local real_path
  real_path="$(command -v grep)"
  printf '#!/bin/bash\nexec "%s" "$@"\n' "$real_path" > "$bin_dir/grep"
  chmod +x "$bin_dir/grep"

  for pair in "$@"; do
    local alias_name="${pair%%=*}"
    local real_cmd="${pair#*=}"
    real_path="$(command -v "$real_cmd")"
    printf '#!/bin/bash\nexec "%s" "$@"\n' "$real_path" > "$bin_dir/$alias_name"
    chmod +x "$bin_dir/$alias_name"
  done
  echo "$bin_dir"
}

# `command -v python3` alone isn't a reliable "this actually runs Python"
# signal — this repo's own git-bash on Windows puts a non-functional
# Microsoft Store shortcut on PATH under that name. Probe for a real
# interpreter the same functional way build-release-apk.sh's own fallback
# does (`import zipfile`), and alias whichever one actually works under the
# name "python3" so the restricted-PATH test below exercises the SAME
# functional-fallback logic the production code runs, rather than the
# environment's own quirk of which name happens to work here.
WORKING_PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import zipfile" >/dev/null 2>&1; then
    WORKING_PY="$candidate"
    break
  fi
done

if [ -z "$WORKING_PY" ]; then
  echo "test-abi-guard: no working Python interpreter found on this machine — cannot exercise the python fallback, skipping" >&2
else
  set +e
  PY_ONLY_DIR="$(restricted_path_with py3only "python3=$WORKING_PY")"
  PATH="$PY_ONLY_DIR" check_apk_has_arm64 "$ARM64_APK" >"$WORK_DIR/out4.log" 2>&1
  status=$?
  set -e
  cat "$WORK_DIR/out4.log"
  assert "unzip absent, python3 fallback reads the ABI list correctly" pass "$status"
fi

set +e
JAR_BIN="$(command -v jar || true)"
if [ -n "$JAR_BIN" ]; then
  JAR_ONLY_DIR="$(restricted_path_with jaronly "jar=jar")"
  PATH="$JAR_ONLY_DIR" check_apk_has_arm64 "$ARM64_APK" >"$WORK_DIR/out5.log" 2>&1
  status=$?
  cat "$WORK_DIR/out5.log"
  assert "unzip and python3 both absent, jar fallback reads the ABI list correctly" pass "$status"
else
  echo "skip - jar fallback (no jar on this machine to test with)"
fi
set -e

set +e
EMPTY_DIR="$WORK_DIR/bin-empty"
mkdir -p "$EMPTY_DIR"
PATH="$EMPTY_DIR" check_apk_has_arm64 "$ARM64_APK" >"$WORK_DIR/out6.log" 2>&1
status=$?
set -e
cat "$WORK_DIR/out6.log"
assert "no zip lister at all: fails with a clear message rather than silently passing" fail "$status"
if ! grep -q "no zip lister available" "$WORK_DIR/out6.log"; then
  echo "FAIL - the no-lister case's error message doesn't say so"
  fail_count=$((fail_count + 1))
fi

echo ""
echo "test-abi-guard: $pass_count passed, $fail_count failed."

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
