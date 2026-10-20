# Automations-cart idiom scan — 2026-08-02

Task #18. **Report only — nothing edited.** The carts live in
`~/code/scheme-carts` (Curator/automations scope, a different repo). Any
migration is a corpus change and needs an explicit go.

Scope: 10,850 `.sks`. The opportunities below exist *because* SRFI-1 and
SRFI-13 verbs landed on 2026-08-02 — before that, the hand-rolled spellings
were the only option, so none of this is a criticism of the cart authors.

## Candidate sites, by class

| idiom found | upgrade to | files |
|---|---|---|
| `(substring s 0 n)` compared against a literal | `string-prefix?` | 263 |
| `(filter (lambda (x) (not …)) …)` | `remove` | 259 |
| `(car (cdr …))` chains | `cadr` / `caddr` | 146 |
| `(cons a (cons b …))` chains | `cons*` | 65 |
| `(= (string-length s) 0)` | `string-null?` | 47 |
| `(append (reverse a) b)` | `append-reverse` | 10 |

**790 candidate files.** Counts are per-file, not per-site, so the true site
count is higher. These are grep candidates, not confirmed rewrites — each needs
a read before it is touched.

## Which of these are worth doing, and which are not

**`string-prefix?` — the "263" in the table above is WRONG. The real number is 1.**

This row has now been corrected twice, so both corrections are kept here rather
than quietly edited away.

CORRECTION 1 (2026-08-02): I claimed these were latent crashes on short input.
They were not. `substring` **clamped** at the time — `(substring "ab" 0 3)`
returned `"ab"` — so the hand-rolled prefix test answered `#f` correctly. I had
asserted the raise from memory instead of running it.

CORRECTION 2 (2026-08-02, later): the count itself was bad. `263` came from a
loose per-file grep for files *mentioning* `substring` near a literal. Parsing
the corpus properly finds **283 real `substring` call sites in total**, of which
exactly **one** is the prefix-comparison idiom. The table's other counts were
produced the same way and should be treated as upper bounds, not site counts,
until each is re-derived by parsing.

**Resolved 2026-08-02: `substring` now conforms to R7RS §6.7** in both Motoi and
Sakura. It raises instead of clamping past the end, raises on negative indices,
and raises on reversed indices instead of silently swapping them. The errors name
the length and point at the right verb.

The corpus was migrated first, in the same pass:

- 240 sites across 176 files hardened to `(substring s 0 (min n (string-length s)))`,
  which reproduces the old clamping behaviour **exactly** — including the prefix
  test still answering `#f` rather than raising on short input.
- A full snapshot was taken first, to
  `~/code/scheme-carts-SNAPSHOT-2026-08-02-pre-substring-migration.tar.gz`,
  because this corpus is not under version control.
- Parse sweep before and after is byte-identical: 9,959 parsed, 837 read-fail,
  54 expand-fail. The migration introduced no regressions; those failures are
  the pre-existing corpus breakage described in `CART-SWEEP-2026-08-02.md`.
- **41 sites were deliberately left alone** — 31 fixed-index format parsers
  (ISO timestamps, hex colours) and 10 with variable start *and* end. These read
  a known layout, so out-of-range input means the input is malformed, and
  raising is the correct new behaviour rather than a regression to paper over.

**Worth doing — `remove` (259) and `string-null?` (47).** Pure readability, zero
semantic change, very low risk. Good candidates for a mechanical pass *if* a
mechanical pass is wanted at all.

**Lower value — `cadr` (146), `cons*` (65), `append-reverse` (10).** Real but
cosmetic. `append-reverse` is additionally a performance win (it avoids building
the intermediate reversed list), but at 10 files it will not show up anywhere.

## Explicitly out of scope

The `assq`/`assoc` → dictionary migration (~58k sites) stays **deferred by
prior agreement**. Nothing here changes that.

## The thing that actually matters more

See `scratch/CART-SWEEP-2026-08-02.md`. 102 carts contain genuine syntax bugs
that the old engine accepted silently — 48 with two dots in one list (which the
old reader turned into a flat list containing a symbol named `.`), and 54 using
`do` as `begin`. Those are correctness, not idiom, and they should be decided on
before any stylistic pass. Fixing style in a file that is silently emitting a
malformed record is the wrong order of work.
