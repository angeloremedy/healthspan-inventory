#!/usr/bin/env bash
# The HQ gate — the one definition of "this change is safe to merge", used by the
# loop's Judge, the loop's final gate, the nightly observer, and anyone by hand:
#
#     bash tools/loop/gate.sh            → exit 0 only if every step passes
#     KEEP_MANUALS=1 bash tools/loop/gate.sh   → also leaves the rebuilt manuals in place
#
# Steps (same as CLAUDE.md "Definition of done", minus docs and SQL):
#   tests    TZ=Asia/Manila npm test
#   build    npm run build + node --check on the bundle
#   manuals  directory → compose → pagecheck → coverage (all nine role PDFs)
#
# Logs go to $GATE_OUT (default: a fresh temp dir, never inside the repo tree).
# The manuals step regenerates tools/manuals/content/_directory.json (a protected,
# generated file). Unless KEEP_MANUALS=1 it is put back afterwards, so running the
# gate never leaves a change behind for the loop's protected-path guard to trip on.
set -u
cd "$(dirname "$0")/../.."
OUT="${GATE_OUT:-$(mktemp -d)}"
mkdir -p "$OUT"
fail=0
results=()

step() {
  local name="$1"; shift
  local t0=$SECONDS
  if "$@" >"$OUT/$name.log" 2>&1; then
    results+=("PASS $name ($((SECONDS - t0))s)")
  else
    results+=("FAIL $name ($((SECONDS - t0))s) — log: $OUT/$name.log")
    fail=1
  fi
}

run_tests() { TZ=Asia/Manila npm test; }

run_build() {
  rm -rf dist
  npm run build && node --check dist/app.*.js
  local rc=$?
  rm -rf dist
  return $rc
}

run_manuals() {
  rm -rf manuals-new
  node tools/manuals/directory.js || return 1
  (cd tools/manuals && python3 compose.py ../../manuals-new && python3 pagecheck.py ../../manuals-new) || return 1
  node tools/manuals/coverage.js
}

step tests run_tests
step build run_build
step manuals run_manuals

if [ "${KEEP_MANUALS:-0}" = "1" ] && [ -d manuals-new ]; then
  cp manuals-new/*.pdf manuals/
else
  git checkout -q -- tools/manuals/content/_directory.json 2>/dev/null || true
fi
rm -rf manuals-new

echo "== HQ gate"
for r in "${results[@]}"; do echo "$r"; done
for f in tests manuals; do
  if grep -q "FAIL" "$OUT/$f.log" 2>/dev/null || grep -q "missing: [^—]" "$OUT/$f.log" 2>/dev/null; then
    echo "-- $f: failing lines"
    grep -E "^FAIL |FAILED|missing: [^—]|pagecheck: [^c]|Error" "$OUT/$f.log" | head -40
  fi
done
if [ "$fail" = "0" ]; then echo "GATE: PASS"; else echo "GATE: FAIL"; fi
exit $fail
