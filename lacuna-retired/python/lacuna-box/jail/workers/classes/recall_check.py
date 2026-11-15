"""recall-check — prove the cortex gives a worker's report back when asked by meaning (LACUNA-1.3-DESIGN B3; the
exam's E5).

Every worker's report is filed as a cortex episode when it retires (run.py's file_report). This worker checks that the
memory really answers: it takes one report (the one named, or the newest finished report that is not its own), files it
as an episode if the cortex does not have it yet (asked by its id first), embeds what is waiting (`cortex reindex`),
then asks `cortex recall` in words drawn from what the report SAID — never its id — and looks for the report's worker
id (or report id) in what comes back. Done or failed, with the evidence: the question asked, the line that answered,
and whether the recall used meaning (vectors) or fell back to words.

  inputs:  worker (a worker id, e.g. "w-docs-1018-052311"; optional — the newest finished report otherwise) · k (8)
"""
from __future__ import annotations

import json
import os
import re
import subprocess

HOME = os.path.expanduser("~")
TOOLS = f"{HOME}/lacuna-world/tools"
STOP = {"the", "and", "for", "with", "that", "this", "from", "into", "after", "before", "its", "was", "are", "has", "have",
        "not", "but", "all", "one", "two", "worker", "report", "said", "nothing", "round", "rounds"}


def sh(args, timeout=120):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout} s"


# ── the pure parts (tested) ───────────────────────────────────────────────────────────────────────────────────────
def ids_of(rep: dict) -> list[str]:
    """The names a recall may answer with: the worker's id and the report's id."""
    out = [str(rep.get("worker") or ""), str(rep.get("id") or "")]
    return [x for x in out if x]


def found(output: str, ids: list[str]) -> str | None:
    """The recalled line that carries one of the ids, or None."""
    for line in (output or "").splitlines():
        if any(i and i in line for i in ids):
            return line.strip()
    return None


def meaning_query(rep: dict, n: int = 9) -> str:
    """Words for the recall from what the report said and its class — ids, hashes, paths and numbers left out, so a
    hit comes from meaning, not from an id the question carried."""
    text = f"{rep.get('class') or ''} {rep.get('said') or ''}"
    text = re.sub(r"\b[wr]-[a-z0-9-]+\b", " ", text)                  # worker and report ids
    text = re.sub(r"\S*[/\\]\S*|\b[0-9a-f]{7,}\b|\d[\d,.:]*", " ", text)   # paths, shas, numbers
    words, seen = [], set()
    for w in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text):
        lw = w.lower()
        if lw in STOP or lw in seen:
            continue
        seen.add(lw)
        words.append(lw)
        if len(words) >= n:
            break
    return " ".join(words)


def newest_report(jobs: str, me: str) -> dict | None:
    best, best_t = None, -1.0
    try:
        names = os.listdir(jobs)
    except OSError:
        return None
    for n in names:
        if not n.startswith("w-") or n == me or n.startswith("w-recall-check"):
            continue
        p = os.path.join(jobs, n, "report.json")
        try:
            t = os.path.getmtime(p)
            if t > best_t:
                rep = json.load(open(p))
                if rep.get("said"):
                    best, best_t = rep, t
        except (OSError, ValueError):
            continue
    return best


def run(w):
    jobs = os.environ.get("LACUNA_JOBS", f"{HOME}/lacuna-world/jobs")
    want = str(w.inputs.get("worker") or "").strip()
    w.skills = ["lacuna-foremen"]
    if want:
        if not re.fullmatch(r"w-[a-z0-9-]+", want):
            return {"ok": False, "said": f"{want!r} is not a worker id", "outputs": []}
        try:
            rep = json.load(open(os.path.join(jobs, want, "report.json")))
        except (OSError, ValueError):
            return {"ok": False, "said": f"the worker {want} left no report", "outputs": []}
    else:
        rep = newest_report(jobs, w.id)
        if not rep:
            return {"ok": False, "said": "no finished worker has a report to look for", "outputs": []}
    wid, ids = str(rep.get("worker")), ids_of(rep)
    w.progress(f"the report of {wid}: is it in the cortex?")
    _, by_id = sh([f"{TOOLS}/cortex", "recall", wid, "--kind", "episode", "--k", "20"], timeout=90)
    filed = "already filed"
    if not found(by_id, ids):
        text = f"{rep.get('class')} worker {wid}: {rep.get('said', '')}"[:1500]
        _, out = sh([f"{TOOLS}/cortex", "episode", rep.get("card") or wid, f"report-{wid}",
                     json.dumps({"text": text, "class": rep.get("class"), "ok": rep.get("ok"), "source": "worker report",
                                 "by": wid, "filed_by": w.id}, ensure_ascii=False)], timeout=90)
        filed = "filed now" if '"ok": true' in out else f"could not be filed: {out.strip()[-160:]}"
        w.progress(f"it was not there — {filed}")
        if not filed.startswith("filed"):
            return {"ok": False, "said": f"{wid}'s report {filed}", "outputs": []}
    w.progress("embedding what waits (cortex reindex), so recall can use meaning")
    _, rx = sh([f"{TOOLS}/cortex", "reindex"], timeout=900)
    _, emb = sh([f"{TOOLS}/cortex", "embedder"], timeout=30)
    try:
        meaning = bool(json.loads(emb).get("meaning_in_recall"))
    except ValueError:
        meaning = False
    q = meaning_query(rep)
    if not q:
        return {"ok": False, "said": f"{wid}'s report says too little to ask about by meaning", "outputs": []}
    k = str(int(w.inputs.get("k", 8)))
    w.progress(f"recall by meaning: \"{q}\"")
    _, out = sh([f"{TOOLS}/cortex", "recall", q, "--kind", "episode", "--k", k], timeout=90)
    line = found(out, ids)
    how = "by meaning (vectors)" if meaning else "by words (the vectors sit out until the embedder and the index agree)"
    if line:
        return {"ok": True, "said": f"cortex recall answered with {wid}'s report {how} — asked \"{q}\"; the report was {filed}",
                "evidence": {"query": q, "line": line, "meaning": meaning, "filed": filed, "reindex": rx.strip()[:200]},
                "outputs": [], "confidence": 0.9 if meaning else 0.6, "handoff": {"next": None},
                "anti_taxonomy": ["changed no code", "wrote only the one episode, if it was missing"]}
    return {"ok": False, "said": f"cortex recall did not answer with {wid}'s report {how} — asked \"{q}\"",
            "evidence": {"query": q, "answered": out.strip()[:800], "meaning": meaning, "filed": filed,
                         "reindex": rx.strip()[:200]},
            "outputs": [], "confidence": 0.8, "handoff": {"next": "the owner", "reason": "recall misses a filed report"},
            "anti_taxonomy": ["changed no code"]}
