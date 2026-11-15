#!/usr/bin/env python3
"""Loads Lacuna's understanding into its cortex so recall finds it (the owner, 2026-10-19: "load a lot of its understanding in the RAG from the
cortex with things that are alike"). Each skill → one `fact` node `know-skill-<name>` (what it is, the breadcrumbs); each GOTCHA → a `lesson` node
`gotcha-<skill>-<n>` that re-centers her; each playbook → `know-playbook-<name>` (its BLUF). Every node is `about` the topic tags it shares with its
kin, so `cortex like` and `recall` bring alike things together. Idempotent: the same key is a new version, never a duplicate.
    cd ~/code/lacuna/lacuna-api && ../.venv/bin/python ../lacuna-box/jail/seed_cortex_knowledge.py
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lacuna-api"))
from lacuna_api.control import lacuna_cortex as cx  # noqa: E402

SK = Path.home() / "code/lacuna/lacuna-box/pi-agent/skills"
PB = Path.home() / "lacuna-world/playbooks"
TAGS = {
    "stuck-card-triage": ["carts", "cards", "lease", "stuck", "repair"], "cart-anatomy": ["carts", "scheme", "strict", "repair"],
    "mock-shop-and-gaps": ["carts", "mock-shop", "fixtures", "strict"], "forge-small-minds": ["forge", "small-minds", "training", "gemma"],
    "dev-qa-world": ["dev", "qa", "release", "ports", "owner-press"], "workshop-branches": ["branches", "workshop", "carts", "code"],
    "lease-and-gpu": ["lease", "gpu", "cards", "forge", "memory"], "brain-and-context-budget": ["brain", "context", "speed", "chat"],
    "cortex-and-memory-habits": ["cortex", "memory", "recall"], "escalation-and-farming": ["cloud", "plan", "farm", "escalation"],
}


def ptags(stem: str) -> list[str]:
    t = ["playbooks"]
    for key, tag in (("CART", "carts"), ("MOCK", "mock-shop"), ("FORGE", "forge"), ("MINDS", "small-minds"), ("RELEASE", "release"), ("DEV-QA", "dev"), ("QA", "qa"), ("ROLLBACK", "release"),
                     ("PROMOTE", "release"), ("CLOUD", "cloud"), ("CORTEX", "cortex"), ("STUCK", "stuck"), ("LEASE", "lease"), ("BRAIN", "brain"), ("IPAD", "ipad"), ("MONITOR", "monitors"),
                     ("CODE", "code"), ("UI", "ui"), ("METHOD", "method"), ("DISK", "memory"), ("RESOURCES", "memory")):
        if key in stem:
            t.append(tag)
    return sorted(set(t))


def main():
    n = 0
    for name, tags in TAGS.items():
        f = SK / name / "SKILL.md"
        if not f.exists():
            continue
        t = f.read_text()
        desc = (re.search(r"^description:\s*(.+)$", t, re.M) or [None, ""])[1]
        crumbs = (re.search(r"## BREADCRUMBS\n(.+?)(?:\n\n|\Z)", t, re.S) or [None, ""])[1].strip()
        about = [f"thing/{x}" for x in tags]
        cx.remember("fact", f"know-skill-{name}", {"text": f"SKILL {name}: {desc} | breadcrumbs: {crumbs}", "file": str(f)}, about + [f"thing/{name}"]); n += 1
        gotchas = re.search(r"## GOTCHAS[^\n]*\n(.+?)(?:\n## |\Z)", t, re.S)
        for i, g in enumerate(re.findall(r"^- (.+)$", gotchas.group(1), re.M) if gotchas else [], 1):
            cx.remember("lesson", f"gotcha-{name}-{i}", {"text": f"GOTCHA ({name}): {g}", "skill": name}, about + [f"thing/{name}"]); n += 1
    for f in sorted(PB.glob("*.md")):
        if f.stem in ("README", "SKILLS-INDEX", "CODEBASE"):
            continue
        t = f.read_text()
        bluf = (re.search(r"^BLUF:\s*(.+)$", t, re.M) or [None, f.stem])[1][:420]
        cx.remember("fact", f"know-playbook-{f.stem.lower()}", {"text": f"PLAYBOOK {f.stem}: {bluf}", "file": str(f)}, [f"thing/{x}" for x in ptags(f.stem)]); n += 1
    print("cortex nodes written:", n, "| counts:", cx.counts())


if __name__ == "__main__":
    main()
