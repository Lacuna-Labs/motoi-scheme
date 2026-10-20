#!/usr/bin/env bash
# Test harness for the reference-lane prototype shapes R1-R6.
# Extracts every code_block from prototype-shapes-0-5.jsonl and runs each through
# ./bin/motoi run /dev/stdin, reporting PASS/FAIL per block plus a final tally.
#
# A block passes if:
#   - it is NOT expected to error and the interpreter exits 0, OR
#   - it IS expected to error (listed in the pair's "expected_error_idx") and the
#     interpreter exits non-zero.
#
# Run from the repo root (or anywhere; paths are resolved relative to this script).

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
JSONL="$SCRIPT_DIR/prototype-shapes-0-5.jsonl"
MOTOI="$REPO_ROOT/bin/motoi"

cd "$REPO_ROOT" || exit 2

pass=0
fail=0
declare -a FAILURES=()

# Emit one line per code block: "<shape>\t<block_idx>\t<expected_error 0|1>\t<base64-code>"
# (base64 keeps embedded newlines/quotes intact across the shell boundary.)
while IFS=$'\t' read -r shape idx expect_err b64; do
    code="$(printf '%s' "$b64" | base64 --decode)"
    out="$(printf '%s' "$code" | "$MOTOI" run /dev/stdin 2>&1)"
    rc=$?
    if [ "$expect_err" = "1" ]; then
        if [ "$rc" -ne 0 ]; then
            printf 'PASS  %-3s #%s  (expected-error)  %s\n' "$shape" "$idx" "$(printf '%s' "$code" | tr '\n' ' ' | cut -c1-70)"
            pass=$((pass+1))
        else
            printf 'FAIL  %-3s #%s  (expected error but exited 0)  %s\n' "$shape" "$idx" "$(printf '%s' "$code" | tr '\n' ' ' | cut -c1-70)"
            fail=$((fail+1)); FAILURES+=("$shape #$idx expected-error-but-passed")
        fi
    else
        if [ "$rc" -eq 0 ]; then
            printf 'PASS  %-3s #%s  %s\n' "$shape" "$idx" "$(printf '%s' "$code" | tr '\n' ' ' | cut -c1-70)"
            pass=$((pass+1))
        else
            printf 'FAIL  %-3s #%s  rc=%s  %s\n' "$shape" "$idx" "$rc" "$(printf '%s' "$code" | tr '\n' ' ' | cut -c1-70)"
            printf '        -> %s\n' "$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-120)"
            fail=$((fail+1)); FAILURES+=("$shape #$idx -> $out")
        fi
    fi
done < <(python3 - "$JSONL" <<'PY'
import json, sys, base64
path = sys.argv[1]
with open(path) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        shape = rec["shape"]
        exp = set(rec.get("expected_error_idx", []))
        for i, code in enumerate(rec["code_blocks"]):
            expect = "1" if i in exp else "0"
            b64 = base64.b64encode(code.encode()).decode()
            print(f"{shape}\t{i}\t{expect}\t{b64}")
PY
)

echo "----------------------------------------------------------------------"
total=$((pass+fail))
printf 'TOTAL: %d blocks | PASS: %d | FAIL: %d\n' "$total" "$pass" "$fail"
if [ "$fail" -ne 0 ]; then
    echo "FAILURES:"
    for f in "${FAILURES[@]}"; do echo "  - $f"; done
    exit 1
fi
echo "ALL BLOCKS OK (100%)"
exit 0
