# Slat → Markdown Presentation Spec (v1)

**Purpose.** How to render a `.slat`/`.slatl` reference chapter into readable Markdown for
Claude chat (and, forward-compatibly, the VitePress doc-site). Presentation-only — canonical
source always stays `.slat`. Renderings live in `scratch/`.

> **This is the canonical code-formatting standard for Motoi & Sakura Scheme — not just a
> viewer.** The reference is training data: rendering the corpus in this exact shape is how the
> model learns to *emit* Scheme this way. One spec drives three surfaces that must agree —
> the formatter (`sakura-scheme fmt`), the REPL pretty-printer, and the VitePress doc theme.
> When code and this spec disagree, reformat the code.

> **Length is never a constraint.** A reference page is exactly as long as it needs to be. Never
> compress, truncate, inline, or drop a program to save space. Fully expand every form (per A3).
> Beauty comes from clarity and rhythm, never from brevity.

---

## A. Linting spec — pretty-printing Motoi Scheme code

**A1. Always fence, never inline-in-tables.** Every runnable program is a ```scheme fenced block.
No S-expression ever goes inside a Markdown table cell (they wrap and become unreadable). Tables
are for metadata only (tier, type, signature).

**A2. One-line threshold.** If the whole form fits in ≤ 56 columns, keep it on one line.
Otherwise break per A3.

**A3. Break rules (indent = 2 spaces per level).**
- `begin` / `define` / `lambda` bodies → each sub-form on its own line.
- `let` / `let*` / named-`let` → bindings block indented; body on following lines.
- `if` → `test` on the head line; `then` and `else` each on their own line, aligned.
- `cond` → each clause on its own line, aligned under the first clause.
- `map` / `for-each` with a lambda + a list → lambda on the head line, the list on the next,
  aligned to the first argument column.

**A4. No dangling parens.** Closing parens hug the last token, Scheme-style
(`… (loop (+ n 1))))` — never a line of lone `)`).

**A5. Quotes attach.** `'star`, `'idle`, `#t`, `#f` stay glued to their token.

**A6. Result annotation.** When the result is concrete and known, append it as a trailing
comment `; ⇒ <value>` on the closing line. Never invent a result — only annotate verified ones.

**A7. Verified-green marker.** A chapter rendering ends with a line stating the program count and
that all ran green via `node bin/motoi run /dev/stdin`.

---

## B. Color spec — "Motoi Dusk" palette

Syntax color is driven by the ```scheme fence (chat + GitHub + VitePress all lex Scheme).
In Claude chat the theme is fixed, so color there is approximate; the palette below is the
**canonical Motoi doc-site theme** the VitePress build should ship (Shiki `themes` override),
so the two surfaces converge.

| token class | examples | hex | role |
|---|---|---|---|
| special form | `begin let lambda if cond define and or loop map` | `#C792EA` (orchid) | control skeleton |
| namespaced verb | `animation/tick motion/move-to easing/standard calc/derivative` | `#89DDFF` (cyan) | the library surface — the star of every chapter |
| primitive | `list length null? = >= + - /` | `#82AAFF` (blue) | plain R7RS/SRFI builtins |
| quoted symbol | `'star 'idle 'busy` | `#F78C6C` (coral) | data-as-symbol |
| number | `0 1 60 9` | `#C3E88D` (lime) | literals |
| string | `"…"` | `#C3E88D` (lime) | literals |
| boolean | `#t #f` | `#FF5370` (red) | truth |
| comment / result | `; ⇒ 1` `;;; …` | `#546E7A` italic (slate) | annotation |
| parens (by depth) | `( … )` | cycle `#FFD700` gold → `#DA70D6` orchid → `#89DDFF` sky | rainbow nesting |

**B1. Verb-name emphasis.** The namespaced verb the chapter documents is the brightest token
(cyan) — a reader scanning the page should see *what moves* before *how it's wrapped*.

**B2. Rainbow parens** cycle by nesting depth (3-color cycle) so deep forms stay legible.

**B3. State-change vs pure cue.** In the metadata line, tag `**state-change**` in red-adjacent
weight and `**pure**` in green-adjacent — a fast visual read of whether a verb mutates.

---

## C. Layout spec

```
# Chapter NN — `library`  (provenance line)
> presentation-only banner + one-paragraph subject statement
(chapter …) metadata line
short chapter preamble

## Verb K — `namespace/name`
`(signature) -> type` · std · tier · **pure|state-change**
> one-line summary

### Row 1 — examples (novice / intermediate / expert)
**novice**
```scheme … ```
*note*
… (intermediate, expert the same shape)

### Row 2 — audit (eng / math / cs)
**eng** / **math** / **cs** each a fenced block
**problem:** … **meta:** …

### Row 3 — dimension        (setup line, then eng/math/cs fenced)
### Row 4 — proof            (eng/math/cs fenced, then claim + invariant)
### Row 5 — emergence        (eng/math/cs fenced, then emergent + family)

--- (between verbs)
```

**C1.** Examples are per-tier bolded label + fenced block + italic note. **Never a table.**
**C2.** Rows 2–5 give the eng/math/cs triple as three fenced blocks, then the prose lines
(problem/meta/claim/invariant/emergent) as compact bold-led bullets.
**C3.** Horizontal rule (`---`) separates verbs.

---

## D. Determinism — the converter runs EVERY time

The reason Scheme "looks ugly" is that people hand-format it inconsistently. The fix is to never
hand-format: a deterministic tool re-prints every program the same way, every time. This spec is
implemented by **`scratch/slat2md.py`** — the reference converter.

**D1. Pretty-print is an algorithm, not a judgement.** The A3 break rules compile to a fixed
per-operator indentation table:

| operator class | operators | head-line datums kept | body indent |
|---|---|---|---|
| body | `begin` `define` `lambda` `let*` `letrec` `when` `unless` | operator + N prefix datums (below) | `col + 2` |
| `let` | `let` (plain) / named `let` | bindings / name + bindings | `col + 2` |
| align | `if` `and` `or` `cond` `map` `for-each` + **every function call** | operator + first argument | under first arg = `col + 1 + len(op) + 1` |

Prefix-datum counts: `lambda`=1 (params), `define`=1 (signature), `let`=1 (bindings), named
`let`=2 (name+bindings), `when`/`unless`=1 (test), `begin`=0.

**D2. Width = 56 columns.** A form renders flat iff it fits in 56 columns at its start column;
otherwise it breaks by D1. Same input → same output, always.

**D3. Results are executed, never invented.** The `; ⇒ value` annotation (A6) is produced by
actually running the program through `bin/motoi` and capturing stdout. Truthful by construction;
also doubles as the green-check. Multi-line or empty results are omitted.

**D4. One tool, three surfaces.** `slat2md.py` is the chat/doc renderer today; the same
indentation table is the contract for the eventual `sakura-scheme fmt` (canonical formatter) and
the REPL pretty-printer. They must never disagree — the model is trained on this shape.

**D5. Run it, don't type it.** Never hand-format a program for presentation. Invoke
`python3 scratch/slat2md.py <chapter.slat>`.

---

## E. Beauty spec

Length is free (see header). Beauty comes from **rhythm, hierarchy, and colour**:

- **Masthead.** Chapter opens with title, a one-line subject in bold, and a dim provenance line.
- **Verb index.** A table at the top: number · verb · kind · one-line gloss. The reader sees the
  whole chapter's shape before diving.
- **Signature card.** Each verb opens with a small 2-column metadata table (signature, kind, tier,
  std) — not a run-on line.
- **Row subtitles.** Each row header carries a short italic subtitle naming what the row teaches
  (e.g. *Row 4 · Proof — the invariant that always holds*).
- **Generous whitespace + rules.** A `---` between verbs; blank lines around every fenced block.
- **Colour** via ```scheme fences and the Motoi Dusk palette (§B): the documented verb is the
  brightest token on the page.
- **No emoji** unless the source carries them. Glyphs `·` `—` `⇒` `∀` `∅` `∈` are welcome.
