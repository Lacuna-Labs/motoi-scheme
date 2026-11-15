"""ARRIVALS — what happens is written into Lacuna's graph cortex as it happens (CORTEX-ENGINEERING §24.1: "arrival is the
cortex's act"; the owner, 2026-10-18: "roll up everything … about the cortex and Lacuna"). Before tonight the graph held
189 nodes and almost nothing wrote to it; the brain read and remembered instead. Now:

  a cart run ends       → an EPISODE `in` the cart (its outcome, its reason, its minds, its brain-seconds)
  a mind climbs         → a LESSON about the mind's job (what it said, what was right, why it climbed)
  the owner presses     → a DECISION (who, yes or no, to what, why) about the card it came from
  an alert is raised    → a FACT that SUPERSEDES the last one of its kind, so the newest wins with its trail
Every write is on its own thread through the broker (lacuna_cortex.py): nothing on a hot path waits on the cortex, and a
cortex that is down costs a line in the audit, never a failure. Vectors are filled by the cortex's reindex (EmbeddingGemma).
"""
from __future__ import annotations

import threading
import re
import time

from .core import audit

_last_alert: dict[str, str] = {}


def _later(fn, *a, **k) -> None:
    import os
    if "PYTEST_CURRENT_TEST" in os.environ and getattr(fn, "__module__", "") == "lacuna_api.control.lacuna_cortex":
        return                         # a test never writes the real cortex (only a test's stand-in receives arrivals)

    def run():
        try:
            r = fn(*a, **k)
            if isinstance(r, dict) and r.get("ok") is False:
                audit("lacuna", "arrival.refused", what=fn.__name__, why=str(r.get("error") or r.get("why"))[:200])
        except Exception as e:  # noqa: BLE001
            audit("lacuna", "arrival.failed", what=fn.__name__, error=e.__class__.__name__)
    threading.Thread(target=run, name="cortex-arrival", daemon=True).start()


def run_ended(cart: str, run_id: str, rec: dict) -> None:
    from . import lacuna_cortex as c
    out = rec.get("outcome") or {}
    is_ = out.get("is") if isinstance(out, dict) else out
    reason = out.get("reason") if isinstance(out, dict) else rec.get("reason")
    _later(c.episode, f"cart:{cart}", str(run_id), {"text": f"the cart {cart} ended {is_ or '?'}: {str(reason or '')[:300]}",
                                                   "verdict": is_, "minds": rec.get("minds"), "brain_seconds": rec.get("brain_seconds")})


def climbed(record: dict) -> None:
    from . import lacuna_cortex as c
    rungs = record.get("rungs") or []
    if not rungs:
        return
    job, cart = record.get("job") or "?", record.get("cart") or "?"
    wrong = "; ".join(f"{x.get('model')} said {x.get('answer')}" for x in rungs[:-1])
    why = next((x.get("climbed") for x in rungs if x.get("climbed")), "")
    inp = record.get("input") or {}
    line = (inp.get("line") if isinstance(inp, dict) else inp) or ""
    key = f"climb-{cart}-{job}-{int(time.time() * 1000)}"
    _later(c.remember, "lesson", key, {"text": f"{cart}'s {job} mind climbed on: {str(line)[:240]} — {wrong}; the {rungs[-1].get('model')} answered {rungs[-1].get('answer')}",
                                        "why": why, "topic": f"{cart}/{job}"}, about=[f"thing/mind:{cart}/{job}", f"card/cart:{cart}"])


def pressed(pid: str, action: str, approve: bool, who: str, reason: str = "", card: str | None = None) -> None:
    from . import lacuna_cortex as c
    _later(c.remember, "decision", f"press-{pid}", {"text": f"{who} said {'yes' if approve else 'no'} to {action}", "why": str(reason or "")[:400],
                                                    "action": action, "approve": bool(approve)}, about=[f"card/{card or action}"])


def _alert_context(key: str, level: str, title: str, body: str) -> dict:
    """What Lacuna needs the moment this alert is read, gathered when it is raised (2026-10-19, the owner: "when the
    dashboard notifies me let it be ready via the cortex to grab the context"): the words, the service's last log lines
    and the playbooks that match — so `cortex recall <alert>` or `cortex show fact/notice-<key>` is the whole picture."""
    ctx = {"text": f"{level}: {title} — {str(body)[:600]}", "level": level, "alert": key, "title": title,
           "at": time.strftime("%Y-%m-%d %H:%M")}
    try:
        from pathlib import Path
        stem = re.sub(r"[^a-z0-9-]", "", key.split(":")[0].split(".")[-1].lower())
        for p in (Path.home() / ".lacuna" / "logs").glob(f"*{stem}*.log") if stem else []:
            ctx["log"] = f"{p.name} (last lines):\n" + "\n".join(p.read_text(errors="replace").splitlines()[-8:])[-900:]
            break
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import rag
        books = [h for h in rag.search(f"{title} {body}"[:400], k=8, min_score=0.55) if h["src"].startswith(("lacuna/", "skill/"))]
        ctx["playbooks"] = sorted({h["src"] for h in books})[:3]
    except Exception:  # noqa: BLE001
        pass
    return ctx


def alerted(key: str, level: str, title: str, body: str) -> None:
    from . import lacuna_cortex as c
    k = f"alert-{key}-{int(time.time())}".replace(" ", "-")[:120]
    prev = _last_alert.get(key)
    _last_alert[key] = k

    def write():
        ctx = _alert_context(key, level, title, body)
        c.remember("fact", k, ctx, about=[f"thing/{key.split(':')[0]}"], supersedes=prev)
        c.remember("fact", "notice-" + re.sub(r"[^a-z0-9-]+", "-", key.lower())[:80], ctx, about=["thing/notices"])   # the newest, by a name Lacuna can guess
    _later(write)
