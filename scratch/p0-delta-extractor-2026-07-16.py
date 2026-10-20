#!/usr/bin/env python3
"""
p0-delta-extractor-2026-07-16.py — Emit only the NEW pairs added by the
Plan A P0 injection into a separate JSONL, keeping the original untouched.

Reads the reference (post-injection) and for each of the 137 P0 target
verbs, emits only :examples entries whose (verb, code) matches the newly
added examples in scratch/p0-new-examples-2026-07-16.py. Uses the same
prompt-templating logic as tools/reference-example-extractor.py so the
pair shape is identical to the main JSONL.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REF_PATH = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")
DATA_PATH = Path("/Users/alfred/code/motoi-scheme/scratch/p0-new-examples-2026-07-16.py")
EXTRACTOR_PATH = Path("/Users/alfred/code/motoi-scheme/tools/reference-example-extractor.py")
OUT_JSONL = Path(
    "/Users/alfred/code/motoi-scheme/training-data/"
    "reference-examples-p0-expansion-2026-07-16.jsonl"
)


def load_extractor():
    spec = importlib.util.spec_from_file_location("ref_extractor", EXTRACTOR_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_new_examples():
    spec = importlib.util.spec_from_file_location("p0mod", DATA_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.NEW_EXAMPLES


def main() -> int:
    ext = load_extractor()
    new_examples = load_new_examples()
    text = REF_PATH.read_text()

    # Build a lookup of (verb-name -> set of code-strings from p0 data)
    p0_codes = {name: set(ex["code"] for ex in exs)
                for name, exs in new_examples.items()}

    # Walk reference verb records
    pairs = []
    per_batch = {"B-01": 0, "B-02": 0, "B-03": 0, "B-04": 0, "B-05": 0, "B-06": 0}

    # Batch membership
    B01 = set([
        "audio-band","audio-bands","audio-bar-clock","audio-beat?","audio-bpm",
        "audio-halt","audio-master-volume","audio-peak","audio-perceptual-bands",
        "audio-play","audio-playing?","audio-rms","audio-tempo","audio-time",
        "camera-bring-to-view","camera-center-on","camera-export","camera-fit-all",
        "camera-frame","camera-home","camera-pan","camera-pan-to","camera-record",
        "camera-scale","camera-set!","camera-state","camera-tilt","camera-trace",
        "camera-x","camera-y","camera-zoom-to",
        "grid-cell-age","grid-cell-set!","grid-cell-state","grid-cell?","grid-cols",
        "grid-init","grid-live-count","grid-neighbors","grid-origin","grid-rows",
        "grid-step","grid-step-3state","grid-step-4state","grid-step-aged","grid-step-count",
        "note-dots","note-place","note-place-at","note-release","note-strike",
        "random-int","random-pick","random-range",
        "on-canvas-trace","on-frame","on-key","on-tick",
        "cancel-tick","begin-frame","end-frame","after-frame",
        "pixels-tall","pixels-wide",
        "viewport","cols","rows","key?","touch",
        "sub-position-per-beat","land-on-downbeat","across-beats","arc-between",
        "measure-content","with-spacing","with-seed",
    ])
    B02 = set([
        "entity/all","entity/apply-force!","entity/collisions","entity/count",
        "entity/damage!","entity/hp!","entity/layer!","entity/mask!",
        "entity/parent!","entity/pose!","entity/ref","entity/remove!",
        "entity/rotate!","entity/sensor!","entity/shape!","entity/shape-flower!",
        "entity/team!","entity/untag!","entity/overlaps?","entity/state","entity/solid!",
    ])
    B03 = set([
        "ai/bt-invert","ai/bt-parallel","ai/waypoints",
        "ai/clear!","ai/bt-force","ai/decide","ai/evade","ai/flow-at",
        "ai/passable?","ai/bb-del!","ai/bb-get","ai/bb-has?","ai/bb-set!",
        "ai/utility","ai/arrive","ai/cohere",
    ])
    B04 = set([
        "cortex/query","cortex/forget","cortex/keys","cortex/read",
        "cortex/recall","cortex/remember","cortex/size","cortex/topk",
    ])
    B05 = set([
        "grid/card-center","grid/clear","grid/dot",
        "grid/flower-clear!","grid/flower-go-to!","grid/flower-list",
        "grid/flower-move-to!","grid/flower-pos","grid/flower-settled?",
        "grid/flower-spawn!","grid/flower-state!","grid/glow",
    ])
    B06 = set(["part/grasp","part/shake","part/shrug","part/twist"])

    def batch_of(name):
        for tag, s in (("B-01", B01), ("B-02", B02), ("B-03", B03),
                       ("B-04", B04), ("B-05", B05), ("B-06", B06)):
            if name in s:
                return tag
        return None

    seen_verbs = set()
    for _, _, form in ext.split_forms(text):
        if not form.startswith("(verb"):
            continue
        name = ext.find_string_field(form, "name")
        if not name or name not in p0_codes:
            continue
        if name in seen_verbs:
            continue  # dedupe duplicate verb records
        seen_verbs.add(name)
        library = ext.find_string_field(form, "library") or ""
        summary = ext.find_string_field(form, "summary")
        body = ext.extract_examples_body(form)
        if body is None:
            continue
        for i, ef in enumerate(ext.iter_example_forms(body)):
            parsed = ext.parse_example(ef)
            if parsed is None:
                continue
            code = (parsed.get("code") or "").strip()
            if not code or code.lower() == "unavailable":
                continue
            # Only keep pairs whose code matches a p0-authored one
            # (compare stripped versions)
            p0_set = {c.strip() for c in p0_codes[name]}
            if code not in p0_set:
                continue
            user = ext.build_user_prompt(name, parsed.get("tier"), i)
            assistant = ext.build_assistant_reply(
                code=code, note=parsed.get("note", ""), summary=summary
            )
            pair = {
                "messages": [
                    {"role": "user", "content": user},
                    {"role": "assistant", "content": assistant},
                ],
                "family": "code",
                "source": "reference-examples",
                "verb": name,
                "library": library,
                "tier": parsed.get("tier"),
                "example_index": i,
                "batch": batch_of(name),
                "provenance": (
                    f"p0-delta-extractor-2026-07-16 verb={name} ex={i} "
                    f"batch={batch_of(name)}"
                ),
            }
            pairs.append(pair)
            tag = batch_of(name)
            if tag:
                per_batch[tag] += 1

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    header = {
        "_provenance_header": True,
        "generated_at": generated_at,
        "generator": "p0-delta-extractor-2026-07-16.py",
        "source": str(REF_PATH),
        "design_doc": (
            "/Users/alfred/code/lacuna-labs/design-docs/"
            "architect-scheme-doc-edit-plan-2026-07-16.slat"
        ),
        "note": (
            "Delta pairs from Plan A P0 execution (batches B-01..B-06). "
            "Extracted only from the 137 target verbs' newly authored "
            ":examples entries. Main reference-examples JSONL is not "
            "modified by this file."
        ),
        "target_verbs": len(p0_codes),
        "verbs_with_delta_pairs": len(seen_verbs),
        "delta_pair_count": len(pairs),
        "per_batch": per_batch,
    }
    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSONL.open("w") as fh:
        fh.write(json.dumps(header) + "\n")
        for p in pairs:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"Wrote {OUT_JSONL}")
    print(f"target verbs:      {len(p0_codes)}")
    print(f"verbs matched:     {len(seen_verbs)}")
    print(f"delta pair count:  {len(pairs)}")
    print("per-batch:")
    for k, v in per_batch.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
