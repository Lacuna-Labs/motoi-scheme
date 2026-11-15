"""THE CLOUD SEAT'S FOUR KINDS OF WORK (cloud.py) — each payload built by code from local reads, each answer checked here.

  cart_draft(name, words, problems)   the 26B's three tries failed → a draft from Flash → the foreman's trial decides
  second_opinion(question, facts, local)
                                      the local judge split → Gemma 4 31B, one answer → it may only CONFIRM the local
                                      majority; a disagreement or no answer leaves the question with the owner
  review(cart)                        a cart's program + its run record → faults named          (a hand: cloud-review)
  plan(path, goal)                    a file's outline + a goal → numbered steps (never code)   (a hand: cloud-plan)
"""
from __future__ import annotations

import re

from . import cloud

CART_HEAD = None


def _cart_head() -> str:
    """the fixed head for every cart draft: what a cart is, its verbs, its reads — byte-identical call to call (cached)"""
    global CART_HEAD
    if CART_HEAD is None:
        from . import cart_gen
        CART_HEAD = ("You write Lacuna carts: Sakura Scheme programs a foreman runs. Answer with ONE program in a ```scheme block "
                     "and nothing else.\n\n" + cart_gen.brief(""))
    return CART_HEAD


def cart_draft(name: str, words: str, problems: list) -> dict:
    body = (f"Write the cart '{name}'. What it should do, in the owner's words:\n{words[:1500]}\n\n"
            "The local model's last try was refused by the foreman's trial for:\n- " + "\n- ".join(map(str, problems[:8])))
    r = cloud.ask("cart-draft", _cart_head(), body, max_out=3000)
    if not r.get("ok"):
        return r
    from . import cart_gen
    program, trial = cart_gen._tried(r["text"], name)         # the trial decides, never the cloud
    return {"ok": bool(trial.get("ok")), "program": program, "trial": trial, "model": r["model"], "cached": r.get("cached")}


SECOND_HEAD = ("You give a second opinion on one yes-or-no question asked by an automated release system. Answer with one "
               "word first, yes or no, then one sentence: why. Judge only from the facts and the laws in the question.")


def second_opinion(question: str, facts, local_yes: bool) -> dict:
    r = cloud.ask("second-opinion", SECOND_HEAD, f"Facts: {facts}\n\nQuestion: {question}", max_out=200, temperature=0)
    if not r.get("ok"):
        return {"confirmed": False, "why": r.get("why")}
    first = (r["text"].strip().split(None, 1) or [""])[0].lower().strip(".,:")
    yes = True if first == "yes" else False if first == "no" else None
    return {"confirmed": yes is not None and yes == local_yes, "yes": yes, "why": r["text"].strip()[:300], "model": r["model"]}


REVIEW_HEAD = ("You review one Lacuna cart (a Sakura Scheme program a foreman runs) with its run record. Name each fault as one "
               "line: the form, what is wrong, the smallest fix. Name nothing that is fine. At most ten lines.")


def review(cart: str) -> dict:
    from pathlib import Path
    from . import graphctx
    if not re.fullmatch(r"[a-z0-9-]{1,40}", cart or ""):
        raise ValueError("a cart's name")
    p = Path.home() / "lacuna-world" / "carts" / f"{cart}.sks"
    if not p.exists():
        raise ValueError(f"there is no cart {cart}")
    rec = graphctx.cart_record(cart)
    body = f"THE CART {cart}:\n{p.read_text()[:12000]}\n\nITS RUNS: {rec.get('runs')} · done {rec.get('done')} · stopped {rec.get('stopped')} · last: {(rec.get('last') or {}).get('said', '')[:200]}"
    r = cloud.ask("review", REVIEW_HEAD, body, max_out=1200)
    return {"cart": cart, **({"faults": r["text"].strip(), "model": r["model"]} if r.get("ok") else {"why": r.get("why"), "resting": r.get("resting")})}


PLAN_HEAD = ("You plan work on one source file from its outline (definitions and their lines, never the whole text). Answer with "
             "numbered steps a careful engineer would take, each naming the definitions it touches and the test that proves it. "
             "No code. At most twelve steps.")


def plan(path: str, goal: str = "split this file along its seams into modules under 500 lines, behaviour unchanged") -> dict:
    from . import graphctx
    o = graphctx.outline(path)
    if not o.get("ok"):
        raise ValueError(o.get("why"))
    body = f"FILE {o['file']} ({o['lines']} lines). ITS DEFINITIONS:\n" + "\n".join(o["defs"]) + f"\n\nGOAL: {goal[:400]}"
    r = cloud.ask("plan", PLAN_HEAD, body, max_out=2500)
    return {"file": o["file"], **({"plan": r["text"].strip(), "model": r["model"]} if r.get("ok") else {"why": r.get("why"), "resting": r.get("resting")})}


PRIMER = ("WHAT LACUNA IS (from its design and today's handoff): Lacuna is an office of AI minds on Alfred's Mac Studio (32 GB). The minds "
          "are Gemma models: the E4B holds the desk, the 12B codes, the 26B and 31B plan and program, small 1B and 270M sentries watch. The "
          "foreman (Node, lacuna-foreman) runs every job as a run with a contract; carts (.sks, Sakura Scheme) are packaged automations; "
          "cards are UI; acts are effects pressed by Alfred; hands (lacuna-executor) run reads and acts in a jail. The door (lacuna-node, :1138) "
          "is the API; the desk (lacuna-home) is the screen; the brain runs on the LME, our own Metal engine. "
          "There are 3 chat surfaces: the Chat card (s-chat/s-claude), the Floor/Agent room (AgentCard, session agents-card), and the upper-right Cloud seat. "
          "Operator has a broken keyboard and relies on hands-free voice STT with 1.8s silence auto-send, voice macros (HALT, APPROVE, STATUS, RETRY), and tactile triage chips. "
          "Laws: the brain never executes (it emits an intent); one envelope (slat); a claim is not a record; nothing prints a token or key; never talk in the "
          "owner's chat as him (tests use eval: sessions); dev never reaches production; one try against outside sites; the SRE book "
          "binds every design. Code lives in ~/code/lacuna (lacuna-node, lacuna-home, lacuna-foreman, lacuna-executor, lacuna-api, lme, "
          "docs); the world in ~/lacuna-world (carts, runs, outputs, playbooks). ")
CHAT_HEAD = PRIMER + ("You are Cloud Lacuna: the cloud seat of Lacuna, the operator of one Mac studio that runs a small business's shops. "
             "The owner asked you directly. Answer plainly and briefly, in the system's words. You hold no shell and no tools: you "
             "advise, and the box's own minds act through their playbooks and the owner's press. Below the question you may get "
             "views of the box the owner switched on in Settings; use only them, and say when you would need a view you were "
             "not given. Never invent numbers or names. YOU CAN COMMAND THE MINDS: to have one fix or make something, put a line in your "
             "answer exactly as `ORDER e4b: <goal>` (small fixes, tests, a cart step, a page) or `ORDER 12b: <goal>` (deep code work); the "
             "box files it as a work order for that mind (its own branch, tests, a commit; Alfred presses to ship) and tells you the id. "
             "Write the goal so a small model can do it alone: the file(s), what is wrong, the test that proves it fixed. One order per "
             "line, at most three in an answer. Read CLOUD-LACUNA.md (your notes) for where the books are.")

SIGHT_FILE = "cloud-sight.json"   # the owner's switches (lacuna-node/frontend/settings.mjs SIGHTS); every view off when absent


def sight_block(home: str | None = None, read_floor=None, question: str = "") -> str:
    """THE VIEWS THE OWNER ALLOWS (2026-10-27: "she should be able to see the system that I allow"): each switch on adds one view,
    read now from the box's own records; never a customer's words (the seat's scrub still runs on the whole call)."""
    import json
    import os
    from pathlib import Path
    h = Path(home or os.path.expanduser("~/.lacuna"))
    try:
        on = json.loads((h / SIGHT_FILE).read_text())
    except (OSError, ValueError):
        return ""
    out = []
    if on.get("floor") is True:
        f = (read_floor or _read_floor)()
        if f:
            minds = ", ".join(f"{m.get('id')} ({m.get('office') or ('lit' if m.get('holds') else 'asleep')})" for m in f.get("minds") or [])
            runs = "; ".join(f"{w.get('name') or w.get('id')}: {str((w.get('panel') or {}).get('state') or w.get('class') or '')[:40]}" for w in (f.get("workers") or [])[:12])
            fm = f.get("foreman") or {}
            out.append(f"THE FLOOR: minds {minds or 'none'}; foreman lag {fm.get('lag_ms')} ms, {fm.get('living')} living; runs: {runs or 'none'}")
    if on.get("inbox") is True:
        a = (_read_json("http://127.0.0.1:1138/api/home") or {}).get("alerts") or []
        out.append("THE INBOX (titles): " + ("; ".join(f"{x.get('level')}: {x.get('title')}" for x in a[:10]) or "empty"))
    if on.get("playbooks") is True:
        pb = Path.home() / "lacuna-world" / "playbooks"
        names = sorted(p.name for p in pb.glob("*"))[:40] if pb.is_dir() else []
        out.append("THE PLAYBOOKS: " + (", ".join(names) or "none on file"))
    if on.get("rulings") is True:
        r = Path.home() / "code" / "lacuna" / "docs" / "RULINGS.slat"
        try:
            import re
            texts = re.findall(r'\(text "([^"]{1,400})"\)', r.read_text())
            out.append("THE OWNER'S RULINGS: " + " | ".join(texts[:30]))
        except OSError:
            pass
    import re as _re0
    d = str(on.get("dir") or "~/code/lacuna")
    if not _re0.match(r"^~/code(/[\w.-]{1,60}){0,4}$", d) or ".." in d:   # the owner's work folder, under ~/code only (settings.mjs dirOk)
        d = "~/code/lacuna"
    repo = Path(os.path.expanduser(d))
    gm = Path.home() / "code" / "lacuna" / "CLOUD-LACUNA.md"   # its own brief, always (the owner, 2026-10-27: "make sure Gemini has full context")
    if gm.exists():
        out.append("YOUR NOTES (CLOUD-LACUNA.md):\n" + gm.read_text(errors="replace")[:16000])   # whole (it outgrew 4,000 characters, 2026-10-27)
    sre_bp = repo / "docs" / "architecture" / "SRE-RETROSPECTIVE-AND-BLUEPRINT.md"
    if sre_bp.exists():
        out.append("SRE RETROSPECTIVE AND BLUEPRINT (Lacuna 2.0):\n" + sre_bp.read_text(errors="replace")[:12000])
    if on.get("handoff") is True:
        hs = sorted((repo / "docs" / "eng").glob("HANDOFF-*.md"))
        if hs:
            h = hs[-1].read_text(errors="replace")   # its head (what works, the owed list) and its tail (the newest sections are appended at the end)
            out.append(f"THE NEWEST HANDOFF ({hs[-1].name}):\n" + (h if len(h) <= 20000 else h[:8000] + "\n…\n" + h[-12000:]))
    if on.get("code") is True:
        import re as _re
        import subprocess
        try:
            tree = subprocess.run(["git", "-C", str(repo), "ls-files"], capture_output=True, text=True, timeout=10).stdout.splitlines()
        except Exception:  # noqa: BLE001 — no tree: the view is left out
            tree = []
        dirs = sorted({t.split("/")[0] for t in tree if "/" in t})
        if not tree:   # a folder that is not a git tree: its files by walking, 2,000 at most
            tree = [str(p.relative_to(repo)) for p in list(repo.rglob("*"))[:2000] if p.is_file() and "node_modules" not in p.parts and ".git" not in p.parts]
            dirs = sorted({t.split("/")[0] for t in tree if "/" in t})
        out.append(f"THE CODE ({d}, your work folder, {len(tree)} files): top folders {', '.join(dirs)}")
        asked = set(_re.findall(r"[\w./-]+\.(?:mjs|js|jsx|py|md|slat|sks|cpp|hpp|metal|css|json|sh)\b", question or ""))
        for a in list(asked)[:3]:
            hit = next((t for t in tree if t == a or t.endswith("/" + a)), None)
            if hit and not _re.search(r"secret|token|\.env|key", hit, _re.I):
                out.append(f"FILE {hit}:\n" + (repo / hit).read_text(errors="replace")[:16000])
    # THE VIEWS ARE OUR OWN RECORDS (2026-10-27: the seat refused every call once the handoff rode, since our docs say "never a customer's
    # words"): any line of a view that names the customer words or an e-mail is left out of the view, so the scrub refuses only the
    # owner's own words when they name customer data, never our documents
    from . import cloud as _cloud
    clean = "\n".join(ln for ln in "\n".join(out).splitlines() if not _cloud.CUSTOMER.search(ln))
    return clean[:40000]


CHAT_MODELS = ("gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-3.8-pro", "gemma-4-31b-it")


def chat_model() -> str:
    """The Gemini model the owner picked for the cloud seat's chat (the card's picker, 2026-10-27), else Flash."""
    import json
    import os
    try:
        m = json.loads(open(os.path.expanduser("~/.lacuna/cloud-sight.json")).read()).get("model")
    except (OSError, ValueError):
        m = None
    return m if m in CHAT_MODELS else CHAT_MODELS[0]


def _read_json(url: str, timeout: float = 4.0):
    import json
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:   # loopback only: the box's own door
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception:  # noqa: BLE001 — a view the box cannot read now is left out, and the seat is told nothing false
        return None


def _read_floor():
    return _read_json("http://127.0.0.1:1138/api/floor")


def chat(text: str, history: list | None = None, on_step=None, on_event=None, who: str = "alfred", max_steps: int = 8, thinking_level: str | None = None, sight=None) -> dict:
    """The owner talks to Cloud Lacuna (Gemini): one call, one try, no shell, no tools (the cloud shell retired 2026-10-23,
    LACUNA-3.0-DESIGN §11); it sees the recent talk and the views he switched on, nothing else."""
    from . import cloud
    hist = "\n".join(f"{h.get('role', '?')}: {str(h.get('content') or h.get('text') or '')[:500]}" for h in (history or [])[-8:])
    views = sight() if sight else sight_block(question=text)
    clean_hist = "\n".join(ln for ln in hist.splitlines() if not cloud.CUSTOMER.search(ln))
    body = (f"VIEWS OF THE BOX (switched on by the owner):\n{views}\n\n" if views else "") + \
           (f"RECENT TALK:\n{clean_hist}\n\n" if clean_hist else "") + f"THE OWNER ASKS:\n{text}"
    if on_event:
        tokens = []
        def _stream_hook(ev):
            if ev.get("type") == "text":
                tokens.append(ev.get("text", ""))
                on_event({"type": "token", "text": ev.get("text", "")})
            elif ev.get("type") == "thought":
                on_event({"type": "thought", "text": ev.get("text", "")})
        r = cloud.ask_stream("chat", CHAT_HEAD, body, _stream_hook, models=[chat_model(), "gemini-3.8-flash", "gemini-3.8-flash-lite"])
        text = "".join(tokens) or (r.get("text") or r.get("answer") or "") if r.get("ok") else ""
    else:
        r = cloud.ask("chat", CHAT_HEAD, body, max_out=2500, model=chat_model())
        text = (r.get("text") or r.get("answer") or "") if r.get("ok") else ""
    filed = file_orders(text) if text else []
    if filed:
        text += "\n\n" + "\n".join(f"filed: {f}" for f in filed)
    return {**r, "text": text, "sight": bool(views), "orders": filed}


ORDER_LINE = re.compile(r"^\s*`?ORDER\s+(e4b|12b)\s*:\s*([^\n`]{10,3000}?)`?\s*$", re.M | re.I)


def file_orders(text: str, post=None) -> list[str]:
    """CLOUD LACUNA COMMANDS THE MINDS (the owner, 2026-10-27: "make sure Cloud Lacuna… can command them to go fix things"): each
    `ORDER <mind>: <goal>` line of its answer becomes a work order through the door's own route (the same road as the owner's Work
    tab: a branch, tests, a commit; shipping stays his press). Three at most an answer."""
    import json
    import urllib.request
    out = []
    for m in list(ORDER_LINE.finditer(text or ""))[:3]:
        mind, goal = m.group(1).lower(), m.group(2).strip()
        try:
            if post:
                r = post(mind, goal)
            else:
                req = urllib.request.Request(f"http://127.0.0.1:1138/api/agents/{mind}/order", data=json.dumps({"goal": goal}).encode(),
                                             headers={"content-type": "application/json"}, method="POST")
                r = json.loads(urllib.request.urlopen(req, timeout=10).read() or b"{}")
            out.append(f"{r.get('order')} for the {mind.upper()}" if r.get("ok") else f"not filed for the {mind.upper()}: {r.get('why')}")
        except Exception as e:  # noqa: BLE001 — one try; the answer says it was not filed
            out.append(f"not filed for the {mind.upper()} ({e.__class__.__name__})")
    return out


# ── E2–E4: the narrow jobs (burn-down 1.5 §E). Each payload is BUILT BY CODE from local reads; each answer is a DRAFT
# under ~/lacuna-world/cloud-drafts/<kind>/ — never written into a repo; what checks it is named in the draft's head. ──

def _draft(kind: str, name: str, text: str, checked_by: str) -> str:
    import re
    import time
    from pathlib import Path
    d = Path.home() / "lacuna-world" / "cloud-drafts" / kind
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{time.strftime('%Y%m%d-%H%M%S')}-{re.sub(r'[^A-Za-z0-9_.-]+', '-', Path(name).name)[:60]}.md"
    p.write_text(f"<!-- a Cloud Lacuna draft ({kind}) · checked by: {checked_by} · not applied -->\n\n{text}")
    return str(p)


WIKI_HEAD = ("You write one reference page for one source module, for the engineers who maintain it, from its OUTLINE and its "
             "own docstring (you do not see its code). Markdown: a one-line BLUF, then What it is · What it holds (each "
             "definition: one line, in the module's own words) · How it is used · What to watch. Never invent behaviour the "
             "outline and docstring do not state; where they are silent, say 'not stated'. Active voice, short sentences.")


def _docstring(path: str) -> str:
    import re
    from pathlib import Path
    try:
        text = Path(path).expanduser().read_text(errors="replace")[:20000]
    except OSError:
        return ""
    m = re.search(r'^\s*(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', text, re.S) or re.search(r"^((?:\s*//[^\n]*\n)+)", text)
    return (m.group(1) if m else "")[:3000]


def wiki(path: str) -> dict:
    """E2: a doc page for a module — its outline + its docstring (the shape, never the whole code) → a draft page"""
    from . import graphctx
    o = graphctx.outline(path)
    if not o.get("ok"):
        raise ValueError(o.get("why"))
    body = f"MODULE {o['file']} ({o['lines']} lines).\nITS DOCSTRING:\n{_docstring(o.get('path') or path) or '(none)'}\n\nITS DEFINITIONS:\n" + "\n".join(o["defs"])
    r = cloud.ask("wiki", WIKI_HEAD, body, max_out=3000)
    if not r.get("ok"):
        return {"file": o["file"], "why": r.get("why"), "resting": r.get("resting")}
    return {"file": o["file"], "draft": _draft("wiki", o["file"], r["text"], "the docs gate and the doc-drift cart"), "model": r["model"]}


MERGE_HEAD = ("You resolve merge conflicts in one file. For each numbered conflict you get OURS and THEIRS and the file's outline. "
              "Answer per conflict: '## conflict N', one line saying which side's intent wins or how both combine, then the "
              "resolved lines in a fenced block. Keep both sides' behaviour when they do not contradict. Never add new behaviour.")


def _conflicts(text: str) -> list[tuple[str, str]]:
    import re
    return [(a, b) for a, b in re.findall(r"^<<<<<<<[^\n]*\n(.*?)^=======\n(.*?)^>>>>>>>[^\n]*$", text, re.S | re.M)]


def merge(path: str) -> dict:
    """E3: a conflicted file (its <<<<<<< hunks, read here) + its outline → a proposed resolution per hunk, as a draft. The
    box checks it — it compiles and the narrow tests pass — before anyone applies it."""
    from pathlib import Path
    from . import graphctx
    p = Path(path).expanduser()
    if not str(p.resolve()).startswith((str(Path.home() / "code"), str(Path.home() / "lacuna-world"))):
        raise ValueError("a file inside ~/code or ~/lacuna-world")
    hunks = _conflicts(p.read_text(errors="replace"))
    if not hunks:
        return {"file": str(p), "why": "no conflict markers in the file"}
    o = graphctx.outline(str(p))
    body = (f"FILE {p.name}. ITS OUTLINE:\n" + "\n".join(o.get("defs") or [])[:4000] + "\n\n" +
            "\n\n".join(f"CONFLICT {i + 1}\nOURS:\n{a[:3000]}\nTHEIRS:\n{b[:3000]}" for i, (a, b) in enumerate(hunks[:12])))
    r = cloud.ask("merge", MERGE_HEAD, body, max_out=6000)
    if not r.get("ok"):
        return {"file": p.name, "conflicts": len(hunks), "why": r.get("why"), "resting": r.get("resting")}
    return {"file": p.name, "conflicts": len(hunks), "draft": _draft("merge", p.name, r["text"], "it compiles and the narrow tests pass"), "model": r["model"]}


MOCKS_HEAD = ("You turn one marketplace's PUBLIC API documentation into a mock server's routes. Answer one JSON object: "
              "{\"platform\": …, \"routes\": [{\"method\", \"path\", \"status\", \"response\": <an example body with obviously "
              "fake values>, \"notes\"}]}. Only routes the documentation shows; example values are fake (shop 'Example Shop', "
              "ids like 1001). No prose outside the JSON.")


def mocks(platform: str, doc: str) -> dict:
    """E4: a marketplace's PUBLIC docs → mock routes, as a draft for the Anything Shop's mock daemon (its own tests check
    it). The documentation is read from ~/lacuna-world/public-docs/ ONLY — a page the owner saved there; nothing is
    fetched. Public docs name buyers and e-mails as field names, so this kind alone skips the customer-word refusal; the
    secret scrub still runs."""
    import re
    from pathlib import Path
    root = Path.home() / "lacuna-world" / "public-docs"
    if not re.fullmatch(r"[a-z0-9-]{2,30}", platform or "") or not re.fullmatch(r"[\w.-]{1,80}", doc or ""):
        raise ValueError("a platform (letters, dashes) and a file name under ~/lacuna-world/public-docs/")
    p = root / doc
    if not p.is_file():
        return {"platform": platform, "why": f"no {doc} in ~/lacuna-world/public-docs (save the public page there first)"}
    r = cloud.ask("mocks", MOCKS_HEAD, f"PLATFORM {platform}\nDOCUMENTATION ({doc}):\n{p.read_text(errors='replace')[:60000]}",
                  max_out=8000, public_doc=True)
    if not r.get("ok"):
        return {"platform": platform, "why": r.get("why"), "resting": r.get("resting")}
    return {"platform": platform, "draft": _draft("mocks", platform, r["text"], "the mock daemon's own tests"), "model": r["model"]}
