"""echo — the smallest worker: says its brief back. The protocol's and the foreman's own test (LACUNA-1.3 B1–B3)."""


def run(w):
    w.progress(f"echoing: {w.job['brief']}")
    if w.inputs.get("crash"):
        raise RuntimeError("asked to crash")
    return {"ok": True, "said": f"echo: {w.job['brief']}", "outputs": [], "confidence": 1.0,
            "handoff": {"next": None}, "anti_taxonomy": ["touched nothing"]}
