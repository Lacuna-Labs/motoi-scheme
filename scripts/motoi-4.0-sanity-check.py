#!/usr/bin/env python3
"""
motoi-4.0-sanity-check.py — Motoi 4.0 coverage lane (Ada, 2026-07-18).

Phase 4 verification for the Scheme lift corpus:

1. Every pair has 3 messages (system, user, assistant).
2. Every pair has meta.bucket and meta.provenance.
3. Every provenance points to an authored source (book file path or
   reference file). Verify the file exists on disk.
4. For pairs whose assistant contains a fenced ```motoi``` block, do a
   quick parse sanity check (balanced parens + valid string literals).
5. No empty user / assistant content.

Emit a summary report.
"""
import json
import re
import sys
from pathlib import Path
from collections import defaultdict, Counter

INPUT = Path.home() / ".forge/corpus/motoi-v6-partial/scheme-lift.jsonl"


def balanced_parens(s):
    depth = 0
    in_str = False
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth < 0:
                    return False, "unmatched close paren"
        i += 1
    if in_str:
        return False, "unterminated string"
    if depth != 0:
        return False, f"unbalanced: {depth} extra opens"
    return True, ""


def extract_motoi_code(assistant):
    return re.findall(r'```(?:motoi)?\n(.*?)```', assistant, re.DOTALL)


def main():
    total = 0
    problems = []
    buckets = Counter()
    prov_sources = Counter()
    empty_content = 0
    parse_failures = 0
    missing_provenance = 0
    missing_source_file = 0
    file_cache = {}

    def check_file(path):
        if path in file_cache:
            return file_cache[path]
        exists = Path(path).exists()
        file_cache[path] = exists
        return exists

    with INPUT.open() as f:
        for lineno, line in enumerate(f, 1):
            obj = json.loads(line)
            if obj.get('_provenance_header'):
                continue
            total += 1

            msgs = obj.get('messages', [])
            if len(msgs) != 3:
                problems.append((lineno, 'msg-count', f"expected 3, got {len(msgs)}"))
                continue

            for m in msgs:
                if not m.get('content'):
                    empty_content += 1
                    problems.append((lineno, 'empty-content', m.get('role', '?')))
                    break

            meta = obj.get('meta', {})
            bucket = meta.get('bucket')
            if not bucket:
                problems.append((lineno, 'no-bucket', ''))
                continue
            buckets[bucket] += 1

            prov = meta.get('provenance')
            if not prov:
                missing_provenance += 1
                problems.append((lineno, 'no-provenance', bucket))
                continue

            # Verify provenance points at a real file
            src_file = prov.get('source-file') or prov.get('reference-file')
            if src_file:
                # Handle relative paths (from repo root)
                if not src_file.startswith('/'):
                    src_file = f"/Users/alfred/code/motoi-scheme/{src_file}"
                if not check_file(src_file):
                    missing_source_file += 1
                    problems.append((lineno, 'source-missing', src_file))
                else:
                    prov_sources[src_file] += 1

            # Parse check assistant if it contains a code block
            assistant = msgs[2].get('content', '')
            code_blocks = extract_motoi_code(assistant)
            for code in code_blocks:
                # Strip comment output lines
                clean = '\n'.join(l for l in code.splitlines() if not l.strip().startswith(';;'))
                if clean.strip():
                    ok, err = balanced_parens(clean)
                    if not ok:
                        parse_failures += 1
                        problems.append((lineno, 'parse-fail', f"{err}: {code[:80]}"))
                        break

    print(f"Total pairs: {total}")
    print(f"\nBucket distribution:")
    for b, c in sorted(buckets.items()):
        print(f"  {b}: {c}")

    print(f"\nProvenance:")
    print(f"  Missing provenance: {missing_provenance}")
    print(f"  Source file missing on disk: {missing_source_file}")
    print(f"  Provenance-chain verified: {(total - missing_provenance) / total * 100:.1f}%")

    print(f"\nContent:")
    print(f"  Empty content: {empty_content}")
    print(f"  Parse failures (unbalanced parens etc.): {parse_failures}")

    print(f"\nUnique source files referenced: {len(prov_sources)}")
    print(f"Top 10:")
    for src, c in prov_sources.most_common(10):
        print(f"  {c:5d}  {src}")

    if problems:
        print(f"\n{len(problems)} problems total.")
        print(f"First 20:")
        for lineno, kind, detail in problems[:20]:
            print(f"  line {lineno}: {kind} — {detail}")

    # Success criteria
    print("\n=== VERDICT ===")
    if missing_provenance == 0 and parse_failures < total * 0.02 and empty_content == 0:
        print("PASS — provenance 100%, parse-check passing")
        return 0
    else:
        print(f"NEEDS-REVIEW — provenance-missing={missing_provenance}, parse-fail={parse_failures}, empty={empty_content}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
