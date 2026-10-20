#!/usr/bin/env python3
"""std-tag-map.py — classify every reference verb by provenance standard.

Axes:
  :library  -> topical module (already authored in the reference)
  std       -> provenance: r7rs-small | srfi-1 | r6rs | motoi-ext | motoi(domain)

Precedence: R7RS-small is the core/authority -> matched first. Then SRFI-1.
Then the R6RS/Racket fold family. Namespaced (ns/verb) verbs = motoi domain
(already :library-tagged). Anything generic that matches none = motoi-ext
(flagged for human review).
"""
import re, json, sys
from pathlib import Path
from collections import Counter, defaultdict

REF = Path('/Users/alfred/code/motoi-scheme/scheme/reference')

# ---- canonical R7RS-small base library identifiers (procedures + syntax) ----
R7RS_SMALL = set("""
define lambda case-lambda if cond case and or when unless let let* letrec letrec*
let-values let*-values begin do delay delay-force force make-promise make-parameter
parameterize guard quote quasiquote unquote unquote-splicing set! define-values
define-syntax let-syntax letrec-syntax syntax-rules syntax-error define-record-type
else => _ ...
eq? eqv? equal? not boolean? boolean=?
number? complex? real? rational? integer? exact? inexact? exact-integer? finite?
infinite? nan? = < > <= >= zero? positive? negative? odd? even? max min + * - /
abs floor/ floor-quotient floor-remainder truncate/ truncate-quotient
truncate-remainder quotient remainder modulo gcd lcm numerator denominator floor
ceiling truncate round rationalize exp log sin cos tan asin acos atan square sqrt
exact-integer-sqrt expt make-rectangular make-polar real-part imag-part magnitude
angle inexact exact number->string string->number exact->inexact inexact->exact
pair? cons car cdr
caar cadr cdar cddr caaar caadr cadar caddr cdaar cdadr cddar cdddr
caaaar caaadr caadar caaddr cadaar cadadr caddar cadddr
cdaaar cdaadr cdadar cdaddr cddaar cddadr cdddar cddddr
set-car! set-cdr! null? list? make-list list length append reverse list-tail
list-ref list-set! memq memv member assq assv assoc list-copy map for-each
symbol? symbol=? symbol->string string->symbol
char? char=? char<? char>? char<=? char>=? char->integer integer->char
string? make-string string string-length string-ref string-set! string=? string<?
string>? string<=? string>=? substring string-append string->list list->string
string-copy string-copy! string-fill! string->vector vector->string string-for-each
string-map
vector? make-vector vector vector-length vector-ref vector-set! vector->list
list->vector vector-fill! vector-copy vector-copy! vector-append vector-for-each
vector-map
bytevector? make-bytevector bytevector bytevector-length bytevector-u8-ref
bytevector-u8-set! bytevector-copy bytevector-copy! bytevector-append utf8->string
string->utf8
procedure? apply values call-with-values dynamic-wind
call-with-current-continuation call/cc with-exception-handler raise raise-continuable
error error-object? error-object-message error-object-irritants read-error? file-error?
input-port? output-port? textual-port? binary-port? port? close-port
close-input-port close-output-port eof-object? eof-object read-char peek-char
read-line read-string char-ready? write-char write-string newline
flush-output-port current-input-port current-output-port current-error-port
open-input-string open-output-string get-output-string input-port-open?
output-port-open? write-u8 read-u8 peek-u8 u8-ready? features
""".split())

# R7RS-small is 16 libraries, not just (scheme base). Fold the rest in.
R7RS_SMALL |= set("""
char-alphabetic? char-ci<=? char-ci<? char-ci=? char-ci>=? char-ci>? char-downcase
char-foldcase char-lower-case? char-numeric? char-upcase char-upper-case?
char-whitespace? digit-value string-ci<=? string-ci<? string-ci=? string-ci>=?
string-ci>? string-downcase string-foldcase string-upcase
write write-shared write-simple display
read
current-jiffy current-second jiffies-per-second
command-line exit emergency-exit get-environment-variable get-environment-variables
call-with-input-file call-with-output-file with-input-from-file with-output-to-file
open-input-file open-output-file open-binary-input-file open-binary-output-file
delete-file file-exists?
load eval environment interaction-environment
scheme-report-environment null-environment
""".split())

# ---- SRFI-1 list library ----
SRFI_1 = set("""
xcons cons* list-tabulate circular-list proper-list? circular-list? dotted-list?
null-list? not-pair? list= first second third fourth fifth sixth seventh eighth
ninth tenth car+cdr take drop take-right drop-right take! drop-right! split-at
split-at! last last-pair length+ concatenate append-reverse zip unzip1 unzip2
unzip3 unzip4 unzip5 count fold fold-right pair-fold pair-fold-right reduce
reduce-right unfold unfold-right append-map append-map! map! map-in-order
pair-for-each filter-map filter partition remove filter! partition! remove! find
find-tail take-while drop-while span break span! break! any every list-index delete
delete-duplicates delete! delete-duplicates! alist-cons alist-copy alist-delete
alist-delete! lset<= lset= lset-adjoin lset-union lset-intersection lset-difference
lset-xor lset-diff+intersection iota
""".split())

# ---- SRFI-69 hash tables (ADOPTED as standard 2026-07-24) ----
SRFI_69 = set("""
make-hash-table hash-table? hash-table-ref hash-table-set! hash-table-update!
hash-table-delete! hash-table-contains? hash-table-exists? hash-table-keys
hash-table-values hash-table->alist alist->hash-table hash-table-size
hash-table-clear! hash-table-fold hash-ref hash-set!
""".split())

# ---- SRFI-13 string library (ADOPTED as standard 2026-07-24) ----
SRFI_13 = set("""
string-join string-split string-index string-contains string-count string-take
string-drop string-pad string-pad-right string-trim string-trim-left
string-trim-right string-reverse string-titlecase string-replace
""".split())

# ---- SRFI-27 random (ADOPTED as standard 2026-07-24) ----
SRFI_27 = set("""
random randint random-int random-range random-pick with-seed
""".split())

# ---- R6RS / Racket fold family (EXCLUDED -> broken-examples) ----
R6RS_FOLD = {'fold-left', 'foldl', 'foldr'}
# common non-SRFI aliases people reach for
MIT_ALIASES = {'list-head'}  # = SRFI-1 take

def classify(name):
    if '/' in name:
        return 'motoi'          # namespaced domain verb (already :library-tagged)
    if name in R7RS_SMALL:
        return 'r7rs-small'
    if name in R6RS_FOLD:
        return 'r6rs'          # EXCLUDED from standard -> rewrite to srfi-1 fold
    if name in SRFI_1:
        return 'srfi-1'
    if name in SRFI_69:
        return 'srfi-69'
    if name in SRFI_13:
        return 'srfi-13'
    if name in SRFI_27:
        return 'srfi-27'
    if name in MIT_ALIASES:
        return 'mit-alias'
    return 'motoi-ext'          # un-namespaced motoi verb (runtime/introspection)

def main():
    name_lib = {}   # name -> library
    for path in sorted(REF.glob('*.slat')):
        text = path.read_text()
        # pair each :name with the nearest preceding/following :library in same verb form
        for m in re.finditer(r':name\s+"([^"]+)"', text):
            nm = m.group(1)
            # look in a window after the name for :library
            window = text[m.end():m.end()+400]
            lm = re.search(r':library\s+"([^"]+)"', window)
            name_lib.setdefault(nm, lm.group(1) if lm else '?')
    rows = []
    by_std = Counter()
    for nm, lib in sorted(name_lib.items()):
        std = classify(nm)
        by_std[std] += 1
        rows.append({'name': nm, 'library': lib, 'std': std})
    # buckets for review
    motoi_ext = sorted(r['name'] for r in rows if r['std'] == 'motoi-ext')
    r6rs = sorted(r['name'] for r in rows if r['std'] == 'r6rs')
    mit = sorted(r['name'] for r in rows if r['std'] == 'mit-alias')
    out = {
        'total_distinct_verbs': len(rows),
        'by_std': dict(by_std),
        'r6rs_fold_family': r6rs,
        'mit_aliases': mit,
        'motoi_ext_generic_needs_review': motoi_ext,
        'rows': rows,
    }
    Path('/Users/alfred/code/motoi-scheme/scratch/std-tag-map.json').write_text(json.dumps(out, indent=2))
    print(f'distinct verbs: {len(rows)}')
    print('by std:', dict(by_std))
    print(f'\nr6rs fold family ({len(r6rs)}):', r6rs)
    print(f'mit aliases ({len(mit)}):', mit)
    print(f'\nmotoi-ext GENERIC (un-namespaced, matches no standard) = {len(motoi_ext)}')
    for n in motoi_ext[:60]:
        print('   ', n)
    if len(motoi_ext) > 60:
        print(f'    ... +{len(motoi_ext)-60} more (see scratch/std-tag-map.json)')

if __name__ == '__main__':
    main()
