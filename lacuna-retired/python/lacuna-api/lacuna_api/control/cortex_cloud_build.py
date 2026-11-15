"""cortex_cloud_build — the Cortex card's layout, computed apart (numpy; run by the forge's python, so the API stays
light). Reads ~/.lacuna/rag/vectors.jsonl (every chunk Lacuna can recall, by meaning) and writes ~/.lacuna/rag/cloud.json:

  topics   k-means over the unit vectors (k ≈ √n / 2, 12–40): each a NEBULA, named by its commonest source title and
           its most telling words
  layout   the nebulae's centres placed in 3D by PCA of the centres (related topics sit near each other); each chunk
           around its centre by the PCA of what is left (its own direction inside the topic), scaled to the topic's size
  points   [x, y, z, topic, source-kind, h] — h is the chunk's hash, how the recall lights it

    python cortex_cloud_build.py VECTORS OUT
"""
import base64
import collections
import json
import os
import re
import struct
import sys

import numpy as np

def clustering_vectors(keep: list, cache_path: str):
    """EmbeddingGemma's CLUSTERING view (its own prompt for grouping by topic; the roll-up C6), read from the cache the door's
    RAG walk writes beside the index (lacuna-node/frontend/rag-index.mjs, in the setting's model: it is written only when every
    live chunk has its vector). Nothing is embedded here (2026-11-06, finale §3.12: the model's name no longer lives in this
    file); a cache that lacks a chunk answers None and the layout uses the search vectors, said in the output."""
    try:
        z = np.load(cache_path)
        cache = dict(zip(list(z["h"]), list(z["v"])))
    except (OSError, ValueError, KeyError):
        return None
    if any(r["h"] not in cache for r, _ in keep):
        return None
    return np.stack([cache[r["h"]] for r, _ in keep])

STOP = set("the a an and or of to in on for is are was were be been it its this that with as at by from not no but if then "
           "we you he she they i our your their his her my me us them so do does did done can will would should could may "
           "must has have had into out up over under about than also just only more most very each every all any some what "
           "when where which who how why there here one two three new now".split())


NAMELESS = {"lacuna", "alfred", "your", "owner", "claude", "said"}   # in every journal topic: they name none of them


def smacof(D, X0, iters: int = 300):
    """Weighted metric MDS (SMACOF, weights 1/D² — Sammon's): the layout X whose distances best keep D, from X0."""
    D = np.asarray(D, dtype=np.float64); X0 = np.asarray(X0, dtype=np.float64)    # float32 makes the pseudo-inverse blow up
    np.fill_diagonal(D, 0.0)
    n = len(D)
    floor = 0.25 * float(np.median(D[np.triu_indices(n, 1)]))     # two near-twin centres must not own every weight
    W = np.where(np.eye(n, dtype=bool), 0.0, 1.0 / np.maximum(D, floor) ** 2)
    V = np.diag(W.sum(1)) - W
    Vp = np.linalg.pinv(V)
    X = X0 * (D[np.triu_indices(n, 1)].mean() / (np.linalg.norm(X0[:, None] - X0[None], axis=2)[np.triu_indices(n, 1)].mean() + 1e-9))
    for _ in range(iters):
        dist = np.linalg.norm(X[:, None] - X[None], axis=2)
        B = -np.where(dist > 1e-9, W * D / np.maximum(dist, 1e-9), 0.0)
        B[np.diag_indices(n)] = -B.sum(1)
        X = Vp @ (B @ X)
    X = X - X.mean(0)
    sd = X.std(0)
    return X if sd.min() > 0.15 * sd.max() else X0          # a layout that went flat is no better than the PCA it began from


def kind_of(src: str) -> str:
    return ("conversation" if src == "conversation" else "journal" if src == "journal" else "skill" if src.startswith("skill/")
            else "lacuna" if src.startswith("lacuna/") else "curator" if src.startswith("eng/") else "manual")


def main(vec_path: str, out_path: str) -> None:
    rows = []
    for ln in open(vec_path):
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        raw = base64.b64decode(r["e"])
        rows.append((r, np.frombuffer(raw, dtype=np.float16).astype(np.float32)))
    seen, keep = set(), []
    for r, v in rows:
        if r["h"] not in seen:
            seen.add(r["h"]); keep.append((r, v))
    CV = clustering_vectors(keep, os.path.join(os.path.dirname(vec_path), "cluster-vectors.npz"))
    view = "clustering" if CV is not None else "search"
    V = CV if CV is not None else np.stack([v for _, v in keep])
    V = V / (np.linalg.norm(V, axis=1, keepdims=True) + 1e-9)
    n = len(V)
    k = int(max(12, min(40, (n ** 0.5) / 2)))
    rng = np.random.default_rng(7)
    C = V[rng.choice(n, size=k, replace=False)].copy()
    for _ in range(30):
        lab = np.argmax(V @ C.T, axis=1)
        for j in range(k):
            m = V[lab == j]
            if len(m):
                c = m.mean(0); C[j] = c / (np.linalg.norm(c) + 1e-9)
    # the centres in 3D: PCA of the centres to start, then a neighbourhood-keeping refinement (B2: "UMAP-like regions"):
    # weighted SMACOF on the centres' chord distances in the 768-d space, weights 1/d² (Sammon), so topics that are near
    # in meaning sit near in the sky and far ones are not crushed together the way a linear projection crushes them
    Cc = C - C.mean(0)
    _, _, vt = np.linalg.svd(Cc, full_matrices=False)
    P = smacof(np.sqrt(np.clip(2 - 2 * (C @ C.T), 0, None)), Cc @ vt[:3].T)
    P = P / (np.abs(P).max() + 1e-9) * 100.0
    # each chunk: its centre + its residual's own 3 directions (one PCA over all residuals), scaled by the topic's size
    R = V - C[lab]
    _, _, rt = np.linalg.svd(R - R.mean(0), full_matrices=False)
    Q = R @ rt[:3].T
    Q = Q / (np.abs(Q).max() + 1e-9)
    counts = collections.Counter(lab.tolist())
    pts = []
    for i, (r, _) in enumerate(keep):
        t = int(lab[i])
        rad = 6 + 10 * (counts[t] / max(counts.values())) ** 0.5
        x, y, z = P[t] + Q[i] * rad * 2.2
        pts.append([round(float(x), 2), round(float(y), 2), round(float(z), 2), t, kind_of(r["src"]), r["h"][:12]])
    topics = []
    for j in range(k):
        members = [keep[i][0] for i in range(n) if lab[i] == j]
        if not members:
            continue
        titles = collections.Counter(m["title"] for m in members).most_common(2)
        words = collections.Counter(w for m in members for w in re.findall(r"[a-z][a-z\-]{3,}", m["text"].lower()) if w not in STOP)
        kinds = collections.Counter(kind_of(m["src"]) for m in members)
        top = [w for w, _ in words.most_common(6)]
        # a topic of journal entries or talk is named by its own words — "your journal" ×20 said nothing (B2)
        tell = [w for w in top if w not in NAMELESS] or top
        name = f"{'journal' if kinds.most_common(1)[0][0] == 'journal' else 'talk'} · {' · '.join(tell[:2])}" \
            if kinds.most_common(1)[0][0] in ("journal", "conversation") and top else titles[0][0]
        topics.append({"id": j, "n": len(members), "at": [round(float(x), 2) for x in P[j]], "title": name,
                       "also": titles[1][0] if len(titles) > 1 else None, "words": top,
                       "kinds": dict(kinds)})
    dup = collections.Counter(t["title"] for t in topics)
    for t in topics:                                         # five nebulae of one long doc: each also says what it holds
        if dup[t["title"]] > 1:
            w = next((x for x in t["words"] if x not in NAMELESS and x not in t["title"].lower()), None)
            if w:
                t["title"] = f"{t['title']} · {w}"
    json.dump({"n": n, "k": k, "points": pts, "topics": topics, "view": view,
               "kinds": ["manual", "curator", "lacuna", "skill", "journal", "conversation"]}, open(out_path, "w"))
    print(f"{n} chunks, {k} topics")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
