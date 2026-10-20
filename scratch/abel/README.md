# scratch/abel — template-keyword hygiene, oracle diff harness

2026-08-03, Abel. Supports REQ-2 in `scratch/ABEL-EXTERNAL-REQUESTS.md`.

## Run it

```
./tk-compare.sh /Users/alfred/code/motoi-scheme      # the live tree
./tk-compare.sh /tmp/abel-verify                     # a sandbox with REQ-2
```

One expression per line of `tk-cases.txt`, `chibi-scheme -p` as the oracle,
last line of output compared verbatim. Multi-form cases are wrapped in
`(begin …)` because `-p` prints the FIRST form's value, not the last — an
unwrapped case silently "passes" as `#<undef>`.

## What the cases cover

Cases 2, 3, 16, 17, 20 are the point: a template-introduced keyword surviving
a use-site variable of the same name. They fail on the live tree and pass with
REQ-2 applied.

The other fifteen are guards in the opposite direction — the flag must NOT
fire. Use-site keyword shadowing without a macro (4, 5, 13, 14), quoted data
holding keyword-named symbols (7, 8, 9, and the three ad-hoc `quote` probes in
the REQ-2 write-up), macro-to-macro expansion (15), `do`/`cond` desugaring
(11, 12), hygiene of ordinary temporaries (6).

## The two standing DIFFs are older than this work

Both reproduce on the live tree with `src/macro.js` reverted, and neither is
touched by REQ-2:

- **case 10** — `(let ((x 'outer)) (define-syntax m (syntax-rules () ((_) x)))
  (let ((x 'inner)) (m)))` → chibi `outer`, Motoi `inner`. Referential
  transparency for VARIABLES under a plain `define-syntax`. `macro.js` has
  this for `let-syntax`/`letrec-syntax` only (`aliasFreeTemplateIds`), because
  that path can bind the alias in a `let` it is already emitting; an internal
  `define-syntax` has no such spot. Real fix is per-identifier renaming, not
  another alias — filed nowhere yet, deliberately.
- **case 18** — same defect, seen through `list`: a template's free `list`
  captured by a use-site `(let ((list vector)) …)`.

- **case 19** — `(let ((and or) (or and)) …)` errors in BOTH implementations
  (different messages). Not a divergence; kept as a reminder that `and`/`or`
  have no variable bindings to shadow with.
