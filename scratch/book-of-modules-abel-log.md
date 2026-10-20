# Book of Modules — Abel Sussman reframe log

The whole Book of Modules was copied from Sakura. It teaches a module system
(`module`, `import`, `export`, `module-verbs`, `module-hash`, `module/sign`,
`module/fork`, `version-compare`, `cortex/query-distinct`, `cortex/query-diff`,
`cache/purge`, etc.) that **Motoi does not have**. Motoi is batteries-included:
libraries auto-load via the runtime lib-loader; there is no user-facing
`import`/`module` special form.

Two moves used:
- (A) Reframe onto the REAL Motoi story (batteries-included; call the verb directly).
- (B) Turn a Sakura-only construct into a DIALECT-BOUNDARY teaching signal in
  PROSE (never in a runnable ```scheme fence).

Verified real behavior (2026-07-30):
- `import`, `module`, `module-verbs`, `getf` → unbound. NOT Motoi.
- `random`, `random-integer` → work.
- `cortex/query` → works, returns event records; `cortex/write`/`cortex/recall` work.
- `cortex/query-distinct`, `-diff`, `-unused-imports`, `-first` → unbound.
- Batteries verbs (string-join/split/upcase/downcase/trim, delete-duplicates,
  fold, sort, filter, map, iota, take, hash-table-ref/default) → all work
  directly with NO import.

## Per-file record (FINAL — all 27 files at 0 FAIL, verified 2026-07-30)

Format: file | before→after FAIL | move | note

- 00-manifest / 00-outline / README        | 0→0  | none      | TOC/boot records, no code
- 01-what-a-module-is        | 11→0 | A | "What a library is"; batteries thesis; string-append/random/cortex direct
- 02-the-import-statement    | 7→0  | B | "There is no import statement"; import forms → prose; string-upcase/delete-duplicates/random-integer
- 03-the-export-statement    | 9→0  | A | public/private via define+nested scope+closures; define-record-type → tagged list
- 04-module-discovery        | 9→0  | B | "There is no discovery step"; cache/purge, module-path, module-find → prose
- 05-versioning              | 2→0  | B | semver as engineering literacy; module/import :version → prose; cortex demo
- 06-hashes-and-signatures   | 7→0  | B | hashing/signing concepts; module-*/trust-* → prose
- 07-module-fold             | 4→0  | A | composition via define helpers + library verbs + dynamic-wind
- 08-cross-cart-modules      | 5→0  | A | isolated-vs-shared state via closures (make-counter, sealed n)
- 09-module-hygiene          | 1→0  | A | hygiene via lexical scope; guard proves unreachable; parameterize → closure save/restore
- 10-lazy-vs-eager           | 5→0  | A | delay/force promises w/ memoization
- 11-circular-imports        | (was 0 after edit) →0 | A | mutual recursion; even?/odd?, nested parity, shared helper, callback
- 12-module-identity         | 0→0  | (prior pass) | eq?/equal? identity; already clean
- 13-cortex-tracked-modules  | 4→0  | B+A | no module events; cortex/write+recall real; diff via filter/member
- 14-publishing-a-module     | 7→0  | B | "There is no registry — share source"; module/sign,publish,fetch,verify → prose
- 15-fork-and-remix          | 3→0  | B+A | no module/fork; remix = wrap a verb (define greet-loud); provenance via cortex
- 16-module-verb-cart        | 3→0  | B+A | module layer dissolved; verb (real) + cart (Curator); one flat file
- appendix-a-tiniest-module  | 2→0  | A | tiniest unit = a few defines; private via nesting
- appendix-b-import-forms    | 12→0 | B | every import shape → prose w/ Motoi answer; 1 runnable "no-import" one-liner
- appendix-c-search-path     | 3→0  | B | "there is no search path"; all path verbs → prose
- appendix-d-semantic-versions | 1→0 | B | kept as literacy prose; version-compare/satisfies? block → prose
- appendix-e-signatures      | 7→0  | B | crypto literacy; module-signature/keygen/sign/verify/trust-* → prose; cortex review demo
- appendix-f-circular-shapes | 0→0  | (prior) | already clean
- appendix-g-cortex-recipes  | 11→0 | A | real recipes: cortex/write+recall, delete-duplicates, filter/member diff
- appendix-h-module-summit   | 2→0  | A | composition summit: falling-blocks core as folded verbs, runnable

TOTAL: 26 slatl chapters/appendices + README; BEFORE ~104 FAIL across 20 files; AFTER 0 FAIL everywhere.

## Whole-book verdict
The entire Book of Modules is really a DIALECT-BOUNDARY BOOK: its thesis in Motoi
is "Motoi has no module system." No file needed excision — every section reframed
cleanly to either (A) a real Motoi analog or (B) a boundary lesson in prose. No
files deleted. No verbs invented. define-record-type engine bug avoided (used
tagged lists). parameterize/make-parameter-as-mutable avoided (used closures).
