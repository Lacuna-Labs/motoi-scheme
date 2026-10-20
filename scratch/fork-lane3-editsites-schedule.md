# Fork Lane 3 — Edit Sites Inventory + ~1-Week Schedule (2026-07-27)

RESEARCH ONLY. Every count is preceded by the command/path used.

## KEY REFRAME
`~/code/sakura-scheme/` is NOT empty — it is already a real forked runtime, extracted
from Curator on 2026-07-09, `package.json name:"sakura-scheme" version:1.4.0`, 654 tests
passing, bin `sakura-scheme`, CLI supports `run`. And a **Rosetta compat architecture**
already exists (`~/code/motoi-scheme/rosetta/dialect.slat`): a fork declares itself
against Motoi's dialect anchor and a deterministic (no-LLM) adapter emits per-verb
bindings `:native|:reduced|:virtual|:break`. Backwards-compat is a *designed seam*, not
a hope. This makes the migration largely a **naming/anchor-flip + doc rename**, not a
rewrite.

## 1. CARTS INVENTORY
- motoi-scheme: `find carts -type f | wc -l` = **87** (26 `.sks`, 29 `.scm`, 4 `.slat`, +txt).
- curator canonical: `find curator-web/src/scheme/carts -name '*.sks' | wc -l` = **1901**
  (etsy 244, dream 494, imagine 474, pink 362, magic 208, cron 48, scenes 34…).
- Marketplace payoff carts confirmed present: `scenes/reconcile-sold.sks`,
  `anti-undercut-reprice.sks`, `crosspost-listing.sks`, `magic/migration-script-etsy-to-shopify.sks`,
  `google/cross-post-ebay-to-google.sks`. `reconcile-sold.sks` header: `status live (etsy, ebay)`.
- **Dialect coupling in carts = essentially none.** `grep -ril motoi curator-web/src/scheme/carts` = **0**;
  `grep -ril sakura … = 1366` (already Sakura-native). motoi-scheme carts: `grep -ril motoi carts` = **60**,
  but reading `hello.scm` / `snake-classic.sks` shows it is only comments (`;; motoi run …`,
  `"hello, motoi"`). No shebangs (`grep -rl '^#!' carts` = none). **Carts call verbs, not the dialect name** → if verb surface holds, carts run unchanged.

## 2. SCHEME-BOOKS + REFERENCE EDIT SITES
- `grep -ril motoi scheme-books | wc -l` = **862** of **864** files.
- `grep -rl 'Motoi Scheme' scheme-books` = **244** (language-name hits; the rest are Motoi-the-persona, LEAVE those).
- Reference is now a dir `Scheme/reference/` (`find … | wc -l` = **112** cards); `grep -ril motoi` = **111**.
- This is the heavy doc-rename load. Mechanical: rename "Motoi Scheme"→"Sakura Scheme" language-name only, preserve persona "Motoi". Needs a careful sed pass + human sift (persona vs language ambiguity).

## 3. BINDINGS + TOOLING + SITE
- `package.json`: name `motoi-scheme`, `bin.motoi → ./bin/motoi`. Wrapper `./motoi` is a chat script → forge python (persona, not language) — leave or alias.
- sakura-scheme already has `bin/sakura-scheme` + `name:sakura-scheme`. Renames needed there: none for the binary; add a `motoi` **alias** in `bin`/package for backwards-compat.
- `bindings/` (js `slat.js`, python `slat/`) — path/pkg-name coupling only.
- Site: `grep -ril motoi site` = **27** files.

## 4. TRAINING CORPUS IMPACT — COMPAT-SAFE, NO REGEN
- `grep -oic motoi ~/code/sakura-corpus/train.jsonl` (full 287MB) = **0**.
- Sampled 50MB: `sakura` 15176 / `Sakura` 34465, `motoi` 0. Folds say **"Sakura run"** (15), never "motoi run".
- Corpus README: already "Sakura Scheme training corpus," extracted from curator 2026-07-09.
- **Verdict: corpus is already 100% Sakura-native. No regen required.** This is why translation-first is cheap — the training substrate already committed to the name.

## 5. BACKWARDS-COMPAT GATE
Mechanism = Rosetta: sakura-scheme's `dialect.slat` sets `:parent "motoi"`, `refuses/modifies` empty → deterministic manifest binds every Motoi verb `:native`. Exit check for each phase: **all 87 motoi + N curator carts run byte-identical output** under sakura-scheme vs motoi (diff the `fb/dump`/stdout).

---

## PHASED SCHEDULE (Day 1–7)
| Day | Phase | Entry gate | Work | Exit check |
|-----|-------|-----------|------|-----------|
| 1 | Translation-A: anchor flip | Rosetta dialect.slat present | Set sakura `dialect.slat :parent "motoi"`, empty refuses/modifies; generate compat manifest; add `motoi` bin+pkg alias | Manifest emits, every verb `:native`; `sakura-scheme run carts/hello.scm` == motoi output |
| 2 | Translation-B: verb-surface parity | Day-1 manifest green | Diff sakura verb registry vs `Scheme/reference` (112 cards); wire any `:reduced/:virtual` gaps | 0 `:break` bindings; 654+ sakura tests still pass |
| 3 | Translation-C: doc rename | Verb parity | sed "Motoi Scheme"→"Sakura Scheme" across 244 book hits + 111 ref cards + 27 site; **human sift persona vs language** | grep language-name = 0 stray; persona "Motoi" untouched |
| 4 | **COMPAT GATE** | Docs renamed | Run all 87 motoi-scheme carts under sakura-scheme, byte-diff | **87/87 byte-identical** — else stop, fix before carts |
| 5 | Carts-A: bulk port | Gate passed | Point curator at sakura-scheme runtime; run the 1901 curator carts (batch by subdir) | ≥99% byte-identical; log divergences honestly |
| 6 | Carts-B: divergence triage | Batch results | Fix any diverging carts (likely host-bus/`state.events` verbs) | 1901/1901 green OR each failure has a filed reason |
| 7 | **Marketplace payoff** | All carts green | Live-key run `reconcile-sold`, `anti-undercut-reprice`, `crosspost-listing`, `cross-post-ebay-to-google` with eBay+Etsy keys (sandbox first) | Real listings reconcile/reprice/crosspost under Sakura Scheme |

## OPEN QUESTIONS FOR ALFRED
1. Does curator's runtime import point at `motoi-scheme/src` or `sakura-scheme/src` today? (needs the seam confirmed before Day 5) — **unknown, needs Alfred.**
2. Keep persona name "Motoi" in Sakura Scheme docs/carts, or also rename persona? (244 book hits are ambiguous) — **needs decision.**
3. Sandbox vs live for Day-7 eBay/Etsy keys — which shop, which SKUs are safe to touch first? — **needs Alfred.**
4. Is byte-identical the right compat bar, or is semantic-identical (whitespace-tolerant) acceptable for carts with host-bus side effects? — **needs decision.**
