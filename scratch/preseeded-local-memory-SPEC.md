# Preseeded Local Memory — runtime SPEC (for Alfred's review)

**Status:** DRAFT for sign-off. Engine artifact, Cortex #375 territory — NOT corpus.
**Author:** drafted 2026-07-30 per Alfred's directive: *"Also need a preseeded local
memory. So a place like your memory.md. A place to start with rules like fixed size
and dynamic evacuation rules. conversation chains happen there also — use qwen's
judgement on eviction."*

The teaching side of this (how Motoi *uses* the store) is authored into the Book of
Your Own Dialect, Part III (ch12 The Console Remembers, ch13 A Place to Start, ch14
Reminders and Not Repeating Mistakes) + Appendix D. **This document is the runtime
scaffold**, not the corpus.

---

## 0. What already exists (verified 2026-07-30, `lib/ai/cortex.js`)

The whole scaffold sits on top of the Cortex that is ALREADY wired. I re-verified
every verb and read the implementation before writing this. Nothing below invents a
verb; it composes what runs today.

- **Store:** `~/motoi/cortex.slatl` — one line-delimited slatl file of
  `(cortex-record …)` and `(cortex-edge …)` forms. **Persists across
  `./bin/motoi run` invocations** (disk-backed). This IS the "place like memory.md."
- **Record schema (extensible):**
  `:kind :id :key :text :tags :salience :ts :data :provenance` + arbitrary tail.
  Unknown fields and unknown `:kind` values round-trip untouched. The model may
  invent kinds/fields and the store keeps them.
- **Two tiers, one surface:**
  - **memory tier** — episodic, prunable, written to the file. `cortex/size` counts
    only this tier.
  - **knowledge tier** — the four Jung graphs, **virtual/read-only**, merged into
    `cortex/search`/`cortex/recall` results as `:kind :knowledge`. Never written,
    never pruned. This is the *preseeded world-knowledge* half — always present,
    zero cost to carry.

### Verb signatures (corrected against source — these differ from the loose notes)

| Verb | Signature | Returns | Notes |
|---|---|---|---|
| `cortex/remember` | `(key value [:tags (…)] [:salience s])` | `#t` | **upsert by key**; string→`:text`, else→`:data`. Salience via **keyword**, default 0.5. |
| `cortex/write` | `(key value)` | `#t` | KV alias of remember; **always salience 0.5**, no keyword support. |
| `cortex/record` | `(:k v :k v …)` | `#t` | **append** free-form record; `:salience` keyword honored, default 0.5. |
| `cortex/recall` | `(key)` | record alist \| `#f` | memory keys first, then knowledge graphs. **Honest-`#f`** when nothing known. |
| `cortex/read` | `(key)` | value \| `#f` | just the stored `:text`/`:data`. |
| `cortex/search` | `(query [k])` | up to k alists | token-overlap RAG across memory **and** knowledge. Default k=8. |
| `cortex/query` | `(:k v …)` | list of alists | memory records whose `:data` matches every pair. |
| `cortex/topk` | `(k [:field v …])` | k alists | **k most RECENT** (ts-ranked), optional `:data` filter. NOT salience-ranked. |
| `cortex/keys` | `()` | list of keys | memory tier only. |
| `cortex/size` | `()` | integer | memory-tier record count (the fill gauge). |
| `cortex/forget` | `(key)` | `#t`\|`#f` | drop one record by key/id. |
| `cortex/prune` | `([:older-than ms] [:min-salience s] [:keep n])` | count evicted | **keyword-driven.** No args → drop salience < 0.1. |
| `cortex/associate` | `(from to label)` | `#t` | append labeled edge (makes it a graph). |
| `cortex/lookup` | `(key [label])` | list of targets \| `#f` | walk edges out of key. |

**Two corrections to fold-facing notes:** (1) `cortex/prune` is NOT a positional
salience floor — it is `:min-salience` / `:older-than` / `:keep`. (2) `cortex/topk`
is recency-ranked, not salience-ranked. Salience only bites through `prune`.

---

## 1. The gap this SPEC closes

Cortex gives us the *store and the verbs*. Alfred asked for four **policies** on top:

1. **Preseeded** — it ships with starting rules, not empty (like MEMORY.md's index).
2. **Fixed size** — bounded; a cap that holds.
3. **Dynamic evacuation** — when full, evict, by a rule.
4. **Conversation chains live there too** — the running dialogue accumulates in the
   same store, and **Qwen's judgement decides what to evict**, not a blind LRU.

None of these needs a new verb. They need (a) a seed file, (b) a small policy record
that names the cap and the eviction rule, and (c) a documented loop the model runs.
That is the whole SPEC.

---

## 2. Preseeded — the seed file

A checked-in seed, mirroring MEMORY.md's "index, not the memories" shape. On first
run (or `motoi cortex seed`), each seed line is loaded as a **pinned** record.

- **Location:** `lib/ai/seed/local-memory.seed.slatl` (checked in, read-only source).
- **Loaded into:** the same `~/motoi/cortex.slatl`, as records with
  `:kind :seed :salience 1.0 :pinned #t`.
- **Pinned = never evicted.** Salience 1.0 clears every `:min-salience` floor, and
  the eviction loop (§4) skips any record with `:pinned #t` even under `:keep`.
- **What the seed carries** (the "rules to start with"):
  - the boundary rules — what is / isn't Motoi (the not-my-verb doctrine);
  - the self-correction loop (accept pushback → track-why / explain → reason →
    **verify against reference + a self-test** → debug → remember);
  - known dialect facts (R7RS-small + SRFI-1/13/125/27; batteries-included; no
    `import`/`module`; `fold` not `fold-left`);
  - the honest-null stance (a boundary is positive signal).

Seed record example (real, runs today):

```scheme
(cortex/record
  :kind :seed
  :key "rule/verify-last"
  :text "Reasoning proposes; the reference and a self-test dispose. Always end at the registry + a tiny run through the interpreter before trusting a verb."
  :salience 1.0
  :pinned #t
  :provenance "local-memory.seed")
```

The knowledge tier (the four graphs) is *also* preseeded, for free — it is virtual
and always merged into recall/search. So "preseeded" is two layers: the pinned seed
rules (episodic, above) and the always-on world graphs (virtual).

---

## 3. Fixed size — the cap

- **Default cap:** `LOCAL_MEM_CAP = 256` memory-tier records (pinned seeds excluded
  from the count for eviction purposes but included in `cortex/size`). Tunable via a
  single policy record; number is a starting guess, meant to be measured then scaled
  (over-include first, per doctrine).
- **The gauge is `cortex/size`.** Fixed-size = "when `(cortex/size)` exceeds the cap,
  run the eviction loop until it's back under."
- **The cap lives in the store**, as one policy record, so it is inspectable and the
  model can read its own rules:

```scheme
(cortex/remember "policy/local-memory"
  '((:cap . 256) (:evict . qwen-judged) (:floor . 0.1))
  :salience 1.0)
```

---

## 4. Dynamic evacuation — the eviction rule (Qwen-judged)

The eviction axis is **salience**, but salience is **set by the model's judgement**,
not by a fixed LRU. The loop:

1. **Check fill:** `(cortex/size)` > cap → proceed, else stop.
2. **Model scores staleness.** Pull the eviction candidates (everything not pinned):
   `(cortex/topk 1000)` gives them recency-first. Qwen reads them and decides *what
   is still salient vs. stale* — the judgement Alfred asked for. It expresses that
   judgement by **re-remembering** each survivor at a bumped salience and letting the
   stale ones keep their low salience:
   ```scheme
   (cortex/remember "<key>" "<same text>" :salience 0.8)   ; "still matters"
   ```
   (Re-remember is an upsert; it does not duplicate.)
3. **Enforce the cap two ways, cheapest first:**
   - **Salience floor:** `(cortex/prune :min-salience 0.1)` drops scratch thoughts.
   - **Hard cap:** if still over, `(cortex/prune :keep 256)` keeps the 256 most
     recent survivors. Pinned seeds are re-asserted after (they are salience 1.0, so
     `:min-salience` never touches them; only `:keep` could, so the loader re-seeds
     any pinned record that fell outside the keep window — cheap, idempotent).
4. **Time hygiene (optional):** `(cortex/prune :older-than <ms>)` sweeps anything
   older than a session horizon, independent of salience.

**Why not LRU:** `:keep` alone *is* an LRU (recency). Alfred explicitly wanted the
model's judgement in the loop, so the salience bump in step 2 is the load-bearing
part — the model promotes what it judges still-relevant, and only then does the
mechanical cap fall back to recency for ties. Salience is the model's vote; `prune`
is the enforcement.

---

## 5. Conversation chains

The running dialogue accumulates into the same store — not just facts. Each turn is
an appended `:episode` record; turns are linked into a **chain** with edges, so the
model can walk the conversation backward.

```scheme
;; turn N
(cortex/record :kind :episode :key "turn/42"
  :text "user asked for a verb that doesn't exist; recovered to the analog"
  :salience 0.4)
;; link it to the previous turn — the chain
(cortex/associate "turn/42" "turn/41" :follows)
```

- **Walk the chain:** `(cortex/lookup "turn/42" :follows)` → the prior turn's key;
  recurse to replay the thread.
- **Chains are subject to the same eviction.** A whole stale chain sinks in salience
  together and gets pruned together; a chain the model judges important (a recovery
  it wants to remember) gets its turns bumped and survives. This is where "use qwen's
  judgement on eviction" and "conversation chains happen there also" meet: the chain
  is data in the store, and the model's salience vote decides whether the thread is
  worth keeping.
- **A "reminder"** (no `cortex/remind` verb exists) is a remembered note with enough
  salience to survive to the next time its case appears: remember-then-recall. ch14
  teaches this; the runtime is just `cortex/remember` + `cortex/recall`/`search`.

---

## 6. The commands (thin CLI, optional — all compose existing verbs)

Not required for the corpus; convenience for operating the store:

- `motoi cortex seed` — load `local-memory.seed.slatl` (idempotent; re-asserts pins).
- `motoi cortex size` — print `(cortex/size)` and the cap.
- `motoi cortex evict` — run the §4 loop once (host calls the model for step 2).
- `motoi cortex chain <key>` — print the conversation chain from `<key>` backward.

---

## 7. What I am NOT proposing

- **No new verbs.** Everything above runs on the 14 wired cortex verbs today.
  "We have enough."
- **No second store.** The "local memory" and the RAG memory are the *same*
  `cortex.slatl`; "preseeded local memory" is a *policy layer* (seed + cap + loop),
  not a new subsystem. This matches the Cortex #375 "one unified slatl" doctrine.
- **No LRU-only eviction.** The model's salience judgement is in the loop by design.
- **Nothing touches the knowledge tier.** The four graphs stay virtual, read-only,
  always-on.

---

## 8. Open questions for Alfred

1. **Cap value.** 256 is a guess. Over-include then measure, or set it lower to force
   the eviction loop to exercise early?
2. **Seed contents.** I listed boundary rules + the loop + dialect facts + honest-null
   stance. Anything else pinned from the start? (e.g. identity: "made in Brooklyn, no
   names"?)
3. **Who runs step 2 (the salience vote)?** In-process host call to the model on an
   `evict` trigger, or a periodic pass? Affects whether eviction is synchronous with
   dialogue or a background sweep.
4. **Pinned re-seed after `:keep`.** Cheap idempotent re-seed (my proposal) vs. teach
   `:keep` to honor `:pinned` in the engine (one-line change to `cortex/prune`). The
   engine change is cleaner; say the word and I'll spec it.
