#!/usr/bin/env python3
"""audit-secrets.py — scan a git range for key-shaped strings.

Reads the FULL CONTENT of every file in every commit in the range and
matches it against a small regex catalogue of secret-shaped patterns.
A key-shaped string introduced and later removed will still be flagged,
because git history preserves it.

Usage:
    scripts/audit-secrets.py                    # scan unpushed (origin/<branch>..HEAD)
    scripts/audit-secrets.py --all              # scan every commit reachable from HEAD
    scripts/audit-secrets.py <from> [<to>]      # explicit range (from..to)
    scripts/audit-secrets.py --staged           # staged but not committed

Exit codes:
    0  clean
    1  one or more commits contain secret-shaped strings
    2  internal error

Used by: install as a pre-push hook (see SECURITY.md), or run by hand.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


# Files exempted because they discuss secrets in documentation form (regex
# patterns, redaction templates, this script itself, etc.).
EXEMPT = {
    "scripts/audit-secrets.py",
    "scripts/audit-secrets.sh",
    "SECURITY.md",
}

# Patterns adapted from common open-source secret scanners.
# Each entry: (label, regex). Add to this list as new sources of leaks
# are discovered.
PATTERNS = [
    ("api-key-equals", re.compile(r"[A-Z][A-Z0-9_]+_API_KEY\s*[=:]\s*[^\s'\"]{8,}")),
    ("client-secret",  re.compile(r"[A-Z][A-Z0-9_]+_CLIENT_SECRET\s*[=:]\s*[^\s'\"]{8,}")),
    ("openai-sk",      re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("bearer-token",   re.compile(r"Bearer\s+[A-Za-z0-9_\-\.]{20,}")),
    ("aws-secret",     re.compile(r"\baws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{20,}", re.I)),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github-pat",     re.compile(r"\bghp_[A-Za-z0-9]{36,}\b")),
    ("github-fine-pat",re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b")),
    ("private-key",    re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----")),
]


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()


def scan_blob(content: str) -> list[tuple[str, str]]:
    """Return list of (label, snippet) hits."""
    hits = []
    for label, pat in PATTERNS:
        for m in pat.finditer(content):
            snippet = m.group(0)
            if len(snippet) > 60:
                snippet = snippet[:60] + "…"
            hits.append((label, snippet))
    return hits


def scan_commit(commit_sha: str) -> list[tuple[str, str, str]]:
    """Scan all blobs in a commit; return (file, label, snippet) hits."""
    files = run(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", commit_sha]).split("\n")
    out = []
    for f in files:
        if not f or f in EXEMPT:
            continue
        try:
            content = run(["git", "show", f"{commit_sha}:{f}"])
        except subprocess.CalledProcessError:
            continue
        for label, snippet in scan_blob(content):
            out.append((f, label, snippet))
    return out


def scan_staged() -> list[tuple[str, str, str]]:
    files = run(["git", "diff", "--cached", "--name-only", "--diff-filter=AM"]).split("\n")
    out = []
    for f in files:
        if not f or f in EXEMPT:
            continue
        p = Path(f)
        if not p.exists():
            continue
        try:
            content = p.read_text(errors="replace")
        except OSError:
            continue
        for label, snippet in scan_blob(content):
            out.append((f, label, snippet))
    return out


def main(argv: list[str]) -> int:
    if argv == ["--staged"]:
        print("[audit-secrets] scanning staged content...")
        hits = scan_staged()
        if hits:
            for f, label, snippet in hits:
                print(f"  ✗ staged: {f}  [{label}]  {snippet!r}")
            print("\n✗ secret-shaped content found.")
            return 1
        print("✓ [audit-secrets] staged content clean")
        return 0

    if argv == ["--all"]:
        rng = "HEAD"
        print("[audit-secrets] scanning every commit reachable from HEAD...")
    elif len(argv) >= 1:
        rng_from = argv[0]
        rng_to = argv[1] if len(argv) > 1 else "HEAD"
        rng = f"{rng_from}..{rng_to}"
    else:
        try:
            branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
            origin = f"origin/{branch}"
            try:
                run(["git", "rev-parse", "--verify", origin])
                rng = f"{origin}..HEAD"
            except subprocess.CalledProcessError:
                rng = "HEAD"
        except subprocess.CalledProcessError:
            print("ERROR: not a git repo", file=sys.stderr)
            return 2

    if argv != ["--all"]:
        print(f"[audit-secrets] scanning {rng}...")
    try:
        commits = run(["git", "rev-list", rng]).split("\n")
    except subprocess.CalledProcessError:
        print(f"ERROR: invalid range {rng!r}", file=sys.stderr)
        return 2

    commits = [c for c in commits if c]
    fail = []
    blobs = 0
    for c in commits:
        for f, label, snippet in scan_commit(c):
            fail.append((c, f, label, snippet))
        blobs += len(run(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", c]).split("\n"))

    if fail:
        for c, f, label, snippet in fail:
            print(f"  ✗ {c[:12]}  {f}  [{label}]  {snippet!r}")
        print("\n✗ [audit-secrets] secret-shaped content found.")
        print("  • If real, rotate the credential.")
        print("  • If a stub, rewrite history (`git rebase -i`) and replace")
        print("    the literal with a short obviously-fake stub.")
        print("  • If a false positive, add the file to EXEMPT in this script.")
        return 1

    print(f"✓ [audit-secrets] {len(commits)} commit(s), {blobs} blob(s) clean")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
