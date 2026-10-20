#!/usr/bin/env python3
"""Prove the local repair pipeline cannot call a paid API or spawn an agent.

Static half: every script in the pipeline is scanned for the ways a Python file
can reach a billed service — the vendor SDKs, the HTTP clients, and shelling out
to a CLI that is itself an agent (`claude`, `gh`, `curl`, `codex`, …). A hit is a
FAIL naming the file and line, not a warning.

Runtime half: `offline_guard` is exercised for real. It has to actually block a
connection to a vendor endpoint, or this reports FAIL.

  python3 scratch/no-phone-home.py
"""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Every file that runs as part of the local repair pipeline.
PIPELINE = [
    'offline_guard.py',
    'no-phone-home.py',
    'audit-books-values.py',
    'audit-ref.py',
    'audit-books-v2.py',
    'verify-reference-notes.py',
    'stale-prepass.py',
    'repair_local.py',
    'screen_clauses.py',
    'corpus-provenance-census.py',
    'verify-fold.py',
    'anchor_repairs.py',
    'repair_reproduce.py',
    'book_value_repairs.py',
    'apply_repairs.py',
    # The forge emitters. These shelled out to a metered CLI once per call —
    # they are why offline_guard now guards `subprocess` as well as `socket`,
    # and they are scanned here so the flip back cannot happen quietly.
    '~/code/forge/scratch/sft-plans/local_llm.py',
    '~/code/forge/scratch/sft-plans/revoice_book.py',
    '~/code/forge/scratch/sft-plans/revoice_batched.py',
    '~/code/forge/scratch/sft-plans/revoice_graph.py',
    '~/code/forge/scratch/sft-plans/module_qa_batched.py',
    '~/code/forge/scratch/sft-plans/wordbook_dialogue_batched.py',
    '~/code/forge/scratch/sft-plans/emit_staging_fill.py',
    '~/code/forge/forge/synthesis/explode.py',
]

BANNED_IMPORTS = [
    'anthropic', 'openai', 'google.generativeai', 'vertexai', 'cohere',
    'replicate', 'together', 'groq', 'litellm', 'langchain',
    'requests', 'httpx', 'aiohttp', 'urllib.request', 'urllib3', 'http.client',
]

# Binaries that are themselves billed agents or network fetchers.
BANNED_BINARIES = [
    'claude', 'codex', 'gh', 'curl', 'wget', 'aws', 'gcloud', 'ollama serve',
    'httpie', 'openai',
]

IMPORT_RE = re.compile(r'^\s*(?:from\s+([\w.]+)|import\s+([\w.]+))', re.M)
STRING_BIN_RE = re.compile(r'["\']([a-z][\w./-]*)["\']')
API_KEY_RE = re.compile(r'(ANTHROPIC|OPENAI|GEMINI|COHERE|GROQ)_API_KEY')


def scan(path: Path):
    """(failures, checked?) — failures are (line_no, why)."""
    if not path.exists():
        return [], False
    src = path.read_text()
    fails = []
    lines = src.splitlines()

    for m in IMPORT_RE.finditer(src):
        mod = (m.group(1) or m.group(2) or '').split(' ')[0]
        root = mod.split('.')[0]
        for bad in BANNED_IMPORTS:
            if mod == bad or root == bad.split('.')[0] and bad.count('.') == 0:
                if root == bad:
                    fails.append((src[:m.start()].count('\n') + 1, f'imports {mod}'))
                    break

    for i, ln in enumerate(lines, 1):
        if ln.lstrip().startswith('#'):
            continue
        # The guard's own selftest has to try the thing it forbids, or it would
        # be proving nothing. That one line is the only sanctioned exception.
        if 'GUARD-SELFTEST' in ln:
            continue
        if API_KEY_RE.search(ln):
            fails.append((i, 'references an API key'))
        if 'subprocess' in ln or 'Popen' in ln or 'os.system' in ln or 'run([' in ln:
            for tok in STRING_BIN_RE.findall(ln):
                base = tok.rsplit('/', 1)[-1]
                if base in BANNED_BINARIES:
                    fails.append((i, f'shells out to `{base}`'))
        for bad in BANNED_BINARIES:
            if re.search(rf'\bbinary\s*=\s*["\']{re.escape(bad)}["\']', ln):
                fails.append((i, f'default binary is `{bad}`'))
    return fails, True


def main():
    ok = True
    print('== static scan ==')
    for name in PIPELINE:
        p = (Path(name).expanduser() if name.startswith('~') else HERE / name)
        label = name if not name.startswith('~') else '/'.join(name.split('/')[-2:])
        fails, checked = scan(p)
        if not checked:
            print(f'  {label:<34s} (not written yet)')
            continue
        if fails:
            ok = False
            print(f'  {label:<34s} FAIL')
            for ln, why in fails:
                print(f'      line {ln}: {why}')
        else:
            print(f'  {label:<34s} clean')

    print('\n== runtime guard ==')
    r = subprocess.run([sys.executable, str(HERE / 'offline_guard.py')],
                       capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()))
    if r.returncode != 0:
        ok = False

    print('\nNO-PHONE-HOME:', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
