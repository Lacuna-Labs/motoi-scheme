"""THE EYE'S JUDGE (Caliper's eye stream, 2026-10-18): SigLIP, zero-shot, on each new frame the shooter writes. The
labels are sentences, so a new state is a new sentence, not a training run. Writes <id>.verdict.json
{label, p, all: {label: p}, at}. Runs while the eye wall's heartbeat is fresh (2 minutes), then exits."""
import glob
import json
import os
import time

DIR = os.path.expanduser("~/.lacuna/eye")
LABELS = {"normal": "a normal web app screen with content", "loading": "a loading screen with a spinner or skeleton",
          "error": "an error page or an error message", "blank": "a blank empty screen", "login": "a sign-in screen"}


def alive() -> bool:
    try:
        return time.time() - os.path.getmtime(f"{DIR}/heartbeat") < 120
    except OSError:
        return False


def main() -> None:
    import torch
    from PIL import Image
    from transformers import AutoModel, AutoProcessor
    name = "google/siglip-base-patch16-224"
    model = AutoModel.from_pretrained(name, local_files_only=True).eval()
    proc = AutoProcessor.from_pretrained(name, local_files_only=True)
    keys, texts = list(LABELS), list(LABELS.values())
    seen = {}
    while alive():
        for f in glob.glob(f"{DIR}/*.jpg"):
            m = os.path.getmtime(f)
            if seen.get(f) == m:
                continue
            seen[f] = m
            try:
                img = Image.open(f).convert("RGB")
                with torch.no_grad():
                    out = model(**proc(text=texts, images=img, padding="max_length", return_tensors="pt"))
                p = torch.sigmoid(out.logits_per_image[0]).tolist()
                best = max(range(len(p)), key=lambda i: p[i])
                json.dump({"label": keys[best], "p": round(p[best], 3), "all": {k: round(v, 3) for k, v in zip(keys, p)}, "at": time.time()},
                          open(f[:-4] + ".verdict.json", "w"))
            except Exception as e:  # noqa: BLE001 — one bad frame never stops the eye
                json.dump({"label": "unknown", "p": 0, "error": str(e)[:160], "at": time.time()}, open(f[:-4] + ".verdict.json", "w"))
        time.sleep(1.5)


if __name__ == "__main__":
    main()
