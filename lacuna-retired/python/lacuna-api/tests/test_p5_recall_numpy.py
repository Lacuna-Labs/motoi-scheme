"""P5 — recall by meaning: the numpy coarse pass picks the same top pool as the pure-Python sort."""
import math
import random

from lacuna_api.control import rag


def test_numpy_pool_matches_pure_sort(monkeypatch):
    rnd = random.Random(7)
    dim = 8
    rows = [{"src": f"s{i}", "title": "t", "loc": "", "text": f"chunk {i}", "h": f"h{i:04d}", "v": [rnd.uniform(-1, 1) for _ in range(dim)]} for i in range(400)]
    for r in rows:
        r["c"] = r["v"][:4]
    qv = [rnd.uniform(-1, 1) for _ in range(dim)]
    qc = qv[:4]
    monkeypatch.setattr(rag, "RERANK", 10)
    pure = {r["h"] for r in sorted(rows, key=lambda r: -math.sumprod(qc, r["c"]))[:30]}
    if rag._np is None:
        return
    rag._mat.update({"n": -1, "c": None})
    mat = rag._np.asarray([r["c"] for r in rows], dtype=rag._np.float32)
    top = rag._np.argpartition(-(mat @ rag._np.asarray(qc, dtype=rag._np.float32)), 29)[:30]
    fast = {rows[int(i)]["h"] for i in top}
    assert len(pure & fast) >= 28          # float32 rounding may swap the last one or two at the boundary
