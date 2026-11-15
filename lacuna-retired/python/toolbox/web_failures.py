"""web_failures.py <vitest-json> — the failing web test ids in one vitest report, one per line, as the gate compares them.

One parser for every web run in promote.sh, so a line means the same thing at dev, alone, and at main:
  web <file> :: <full test name>                         a test that failed
  web <file> :: (the file failed to load)                no assertions ran (found 2026-09-25)
  web <file> :: (the file never finished)                its worker was stopped: tests "pending" in a "passed" file
  web <file> :: <test> (hung — its worker was stopped)   named by vitest-hung.mjs in <json>.hung (2026-10-19)
A missing or unreadable report prints nothing; the caller decides what a missing report means."""
import json
import os
import sys

src = sys.argv[1]
try:
    d = json.load(open(src))
except Exception:  # noqa: BLE001
    d = {"testResults": []}
for f in d["testResults"]:
    n = f["name"].split("curator-web/")[-1]
    st = [t["status"] for t in f["assertionResults"]]
    for t in f["assertionResults"]:
        if t["status"] == "failed":
            print(f"web {n} :: {t['fullName']}")
    if f.get("status") == "failed" and "failed" not in st:
        print(f"web {n} :: (the file failed to load)")
    if st and "pending" in st and not any(x in ("passed", "failed") for x in st):
        print(f"web {n} :: (the file never finished)")
if os.path.exists(src + ".hung"):
    for line in open(src + ".hung"):
        try:
            h = json.loads(line)
        except ValueError:
            continue
        print(f"web {h.get('file') or '(a worker it could not read)'} :: {h.get('test') or '?'} (hung — its worker was stopped)")
