// scratch/conformance-probe.mjs — behavioral conformance harness.
//
// Executes representative expressions for R7RS-small core + each SRFI part
// against expected outputs and reports every DIVERGE. This is BEHAVIOR
// checking (does the verb do what its spec says), not the structural
// 5-point gate (does the verb bind + run). Purpose: find real spec
// divergences before the 0.90 compliance sweep.
//
// Each case: { part, expr, want }  where `want` is the canonical printed
// form. Special `want` sentinels:
//   'ERROR'  — the expression MUST raise (spec says error / non-callable).
//
// Usage: node scratch/conformance-probe.mjs [--part SRFI-125]

import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'

const FUEL = 400000

// canonical renderer — Scheme-ish printed form, enough to compare against
// hand-written `want` strings.
function render (v) {
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'bigint') return String(v)
  if (Array.isArray(v)) return '(' + v.map(render).join(' ') + ')'
  // Motoi pair identity: cons cells are { car, cdr }; nil is { __nil__:true }
  if (v && typeof v === 'object' && v.__nil__ === true) return '()'
  if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Pair') {
    const parts = []
    let cur = v
    while (cur && typeof cur === 'object' && cur.constructor && cur.constructor.name === 'Pair') {
      parts.push(render(cur.car))
      cur = cur.cdr
    }
    if (cur && typeof cur === 'object' && cur.__nil__ === true) return '(' + parts.join(' ') + ')'
    // improper list
    return '(' + parts.join(' ') + ' . ' + render(cur) + ')'
  }
  if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Vector') {
    const items = v.items || v.elements || v.data || []
    return '#(' + items.map(render).join(' ') + ')'
  }
  if (v && typeof v === 'object' && typeof v.name === 'string' && Object.keys(v).length <= 2) return v.name
  if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'HashTable') return '#<hash-table>'
  return String(v)
}

function run (expr) {
  const env = makeCoreEnv({ fuel: { n: FUEL } })
  const forms = parse(expr)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: FUEL } })
  const fuel = { n: FUEL }
  let result
  for (const f of expanded) result = evaluate(f, env, fuel)
  return render(result)
}

// ── the cases ──────────────────────────────────────────────────────────
const CASES = [
  // --- R7RS-small core: equivalence + basics ---
  ['R7RS-small', '(+ 1 2 3)', '6'],
  ['R7RS-small', '(eq? (quote a) (quote a))', '#t'],
  ['R7RS-small', '(equal? (list 1 2) (list 1 2))', '#t'],
  ['R7RS-small', '(eqv? 2 2)', '#t'],
  ['R7RS-small', '(if #f 1)', '#f'],         // unspecified when no else → Motoi renders #f
  ['R7RS-small', '(cond (#f 1) (else 2))', '2'],
  ['R7RS-small', '(assoc 2 (list (list 1 (quote a)) (list 2 (quote b))))', '(2 b)'],
  ['R7RS-small', '(assq (quote c) (list (list (quote a) 1)))', '#f'],
  ['R7RS-small', '(member 3 (list 1 2 3 4))', '(3 4)'],
  ['R7RS-small', '(memq (quote x) (list (quote a) (quote x)))', '(x)'],
  ['R7RS-small', '(reverse (list 1 2 3))', '(3 2 1)'],
  ['R7RS-small', '(append (list 1 2) (list 3 4))', '(1 2 3 4)'],
  ['R7RS-small', '(list-tail (list 1 2 3 4) 2)', '(3 4)'],
  ['R7RS-small', '(list-ref (list 10 20 30) 1)', '20'],
  ['R7RS-small', '(map (lambda (x) (* x x)) (list 1 2 3))', '(1 4 9)'],
  ['R7RS-small', '(map + (list 1 2 3) (list 10 20 30))', '(11 22 33)'],
  ['R7RS-small', '(map + (list 1 2 3) (list 10 20))', '(11 22)'], // shortest-stop superset
  ['R7RS-small', '(vector-ref (vector 1 2 3) 0)', '1'],
  ['R7RS-small', '(vector->list (vector 1 2 3))', '(1 2 3)'],
  ['R7RS-small', '(string->number "42")', '42'],
  ['R7RS-small', '(number->string 42)', '42'],
  ['R7RS-small', '(string-append "ab" "cd")', 'abcd'],
  ['R7RS-small', '(substring "hello" 1 3)', 'el'],
  ['R7RS-small', '(string-length "hello")', '5'],
  ['R7RS-small', '(char->integer #\\A)', '65'],
  ['R7RS-small', '(integer->char 66)', '#\\B'],  // canonical char write-form
  ['R7RS-small', '(exact->inexact 1)', '1'],
  ['R7RS-small', '(quotient 7 2)', '3'],
  ['R7RS-small', '(remainder 7 2)', '1'],
  ['R7RS-small', '(modulo -7 3)', '2'],       // R7RS modulo follows divisor sign
  ['R7RS-small', '(expt 2 10)', '1024'],
  ['R7RS-small', '(gcd 12 8)', '4'],
  ['R7RS-small', '(lcm 4 6)', '12'],
  ['R7RS-small', '(min 3 1 2)', '1'],
  ['R7RS-small', '(max 3 1 2)', '3'],
  ['R7RS-small', '(abs -5)', '5'],
  ['R7RS-small', '(floor 2.7)', '2'],
  ['R7RS-small', '(ceiling 2.1)', '3'],
  ['R7RS-small', '(round 2.5)', '2'],         // round-to-even
  ['R7RS-small', '(round 3.5)', '4'],         // round-to-even
  ['R7RS-small', '(truncate -2.7)', '-2'],
  ['R7RS-small', '(boolean=? #t #t)', '#t'],
  ['R7RS-small', '(not #f)', '#t'],
  ['R7RS-small', '(let loop ((i 0) (acc 0)) (if (= i 5) acc (loop (+ i 1) (+ acc i))))', '10'],
  ['R7RS-small', '(let-values (((q r) (floor/ 7 2))) (list q r))', '(3 1)'],
  ['R7RS-small', '(call-with-current-continuation (lambda (k) (+ 1 (k 42))))', '42'],

  // --- SRFI-1 (lists) ---
  ['SRFI-1', '(iota 5)', '(0 1 2 3 4)'],
  ['SRFI-1', '(iota 3 1)', '(1 2 3)'],
  ['SRFI-1', '(iota 3 0 2)', '(0 2 4)'],
  ['SRFI-1', '(fold + 0 (list 1 2 3 4))', '10'],           // elem-first, acc-last
  ['SRFI-1', '(fold cons (quote ()) (list 1 2 3))', '(3 2 1)'],
  ['SRFI-1', '(fold-right cons (quote ()) (list 1 2 3))', '(1 2 3)'],
  ['SRFI-1', '(reduce + 0 (list 1 2 3 4))', '10'],
  ['SRFI-1', '(filter even? (list 1 2 3 4 5 6))', '(2 4 6)'],
  ['SRFI-1', '(remove even? (list 1 2 3 4))', '(1 3)'],
  ['SRFI-1', '(call-with-values (lambda () (partition even? (list 1 2 3 4))) list)', '((2 4) (1 3))'],  // SRFI-1 partition returns TWO values
  ['SRFI-1', '(filter-map (lambda (x) (if (even? x) (* x x) #f)) (list 1 2 3 4))', '(4 16)'],
  ['SRFI-1', '(take (list 1 2 3 4 5) 2)', '(1 2)'],
  ['SRFI-1', '(drop (list 1 2 3 4 5) 2)', '(3 4 5)'],
  ['SRFI-1', '(last (list 1 2 3))', '3'],
  ['SRFI-1', '(last-pair (list 1 2 3))', '(3)'],
  ['SRFI-1', '(delete 2 (list 1 2 3 2 1))', '(1 3 1)'],
  ['SRFI-1', '(delete-duplicates (list 1 1 2 3 3))', '(1 2 3)'],
  ['SRFI-1', '(count even? (list 1 2 3 4))', '2'],
  ['SRFI-1', '(find even? (list 1 3 4 5))', '4'],
  ['SRFI-1', '(any even? (list 1 3 5 6))', '#t'],
  ['SRFI-1', '(every even? (list 2 4 6))', '#t'],
  ['SRFI-1', '(list-index even? (list 1 3 4))', '2'],
  ['SRFI-1', '(append-map (lambda (x) (list x x)) (list 1 2))', '(1 1 2 2)'],
  ['SRFI-1', '(concatenate (list (list 1 2) (list 3 4)))', '(1 2 3 4)'],
  ['SRFI-1', '(zip (list 1 2) (list 3 4))', '((1 3) (2 4))'],
  ['SRFI-1', '(first (list 1 2 3))', '1'],
  ['SRFI-1', '(second (list 1 2 3))', '2'],
  ['SRFI-1', '(third (list 1 2 3))', '3'],
  ['SRFI-1', '(cons* 1 2 (list 3 4))', '(1 2 3 4)'],
  ['SRFI-1', '(unfold (lambda (x) (> x 3)) (lambda (x) x) (lambda (x) (+ x 1)) 1)', '(1 2 3)'],

  // --- SRFI-13 (strings) ---
  ['SRFI-13', '(string-join (list "a" "b" "c") "-")', 'a-b-c'],
  ['SRFI-13', '(string-trim "  hi  ")', 'hi  '],
  ['SRFI-13', '(string-trim-left "  hi")', 'hi'],
  ['SRFI-13', '(string-trim-right "hi  ")', 'hi'],
  ['SRFI-13', '(string-trim-both "  hi  ")', 'hi'],
  ['SRFI-13', '(string-prefix? "he" "hello")', '#t'],
  ['SRFI-13', '(string-suffix? "lo" "hello")', '#t'],
  ['SRFI-13', '(string-contains "hello" "ell")', '1'],
  ['SRFI-13', '(string-index "hello" #\\l)', '2'],
  ['SRFI-13', '(string-upcase "abc")', 'ABC'],
  ['SRFI-13', '(string-downcase "ABC")', 'abc'],
  ['SRFI-13', '(string-reverse "abc")', 'cba'],
  ['SRFI-13', '(string-take "hello" 2)', 'he'],
  ['SRFI-13', '(string-drop "hello" 2)', 'llo'],
  ['SRFI-13', '(string-count "banana" #\\a)', '3'],
  ['SRFI-13', '(string-null? "")', '#t'],

  // --- SRFI-125 (hash tables) — the known divergence lives here ---
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-set! h "k" 42) (hash-table-ref/default h "k" 0))', '42'],
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-ref/default h "missing" 0))', '0'],
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-set! h "k" 42) (hash-table-ref h "k"))', '42'],
  // SRFI-125: 3rd arg is a FAILURE THUNK (called on miss). Correct impl → 7.
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-ref h "missing" (lambda () 7)))', '7'],
  // SRFI-125: optional 4th arg is a SUCCESS proc applied to the found value.
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-set! h "k" 20) (hash-table-ref h "k" (lambda () 0) (lambda (v) (* v 2))))', '40'],
  // SRFI-125: ref on missing key with NO failure thunk → error.
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-ref h "missing"))', 'ERROR'],
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-set! h "k" 1) (hash-table-contains? h "k"))', '#t'],
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-set! h "k" 1) (hash-table-size h))', '1'],
  // hash-table-update!: 4th arg is a FAILURE THUNK per SRFI-125.
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-update! h "k" (lambda (v) (+ v 1)) (lambda () 0)) (hash-table-ref/default h "k" -1))', '1'],
  ['SRFI-125', '(let ((h (make-hash-table))) (hash-table-update!/default h "k" (lambda (v) (+ v 1)) 0) (hash-table-ref/default h "k" -1))', '1'],
  // hash-table constructor: alternating key/value args (Motoi omits comparator).
  ['SRFI-125', '(hash-table-ref/default (hash-table "a" 1 "b" 2) "b" 0)', '2'],
  ['SRFI-125', '(hash-table-size (hash-table "a" 1 "b" 2))', '2'],
  // odd argument count is an error.
  ['SRFI-125', '(hash-table "a" 1 "b")', 'ERROR'],
  // hash-table-copy: independent copy (mutating the copy leaves the original).
  ['SRFI-125', '(let* ((a (hash-table "x" 1)) (b (hash-table-copy a))) (hash-table-set! b "x" 9) (hash-table-ref/default a "x" 0))', '1'],
  // hash-table-walk: table-first argument order, (proc key value) for side effect.
  ['SRFI-125', '(let ((h (hash-table "a" 10 "b" 20)) (s 0)) (hash-table-walk h (lambda (k v) (set! s (+ s v)))) s)', '30'],
  // hash-table-for-each: proc-first argument order.
  ['SRFI-125', '(let ((h (hash-table "a" 10 "b" 20)) (s 0)) (hash-table-for-each (lambda (k v) (set! s (+ s v))) h) s)', '30'],

  // --- SRFI-27 (random) — nondeterministic; check TYPE/range via predicates ---
  ['SRFI-27', '(let ((n (random-integer 10))) (and (>= n 0) (< n 10)))', '#t'],
  ['SRFI-27', '(let ((x (random-real))) (and (>= x 0) (< x 1)))', '#t'],
]

// ── driver ──────────────────────────────────────────────────────────────
const partFilter = (() => {
  const i = process.argv.indexOf('--part')
  return i >= 0 ? process.argv[i + 1] : null
})()

const results = []
for (const [part, expr, want] of CASES) {
  if (partFilter && part !== partFilter) continue
  let got, threw = false, errMsg = ''
  try { got = run(expr) } catch (e) { threw = true; errMsg = String(e && e.message || e) }
  let status
  if (want === 'ERROR') {
    status = threw ? 'PASS' : 'DIVERGE'
    got = threw ? `(errored: ${errMsg.slice(0, 60)})` : got
  } else {
    status = (!threw && got === want) ? 'PASS' : 'DIVERGE'
    if (threw) got = `(errored: ${errMsg.slice(0, 60)})`
  }
  results.push({ part, expr, want, got, status })
}

const byPart = {}
for (const r of results) (byPart[r.part] ||= []).push(r)

let totPass = 0, totFail = 0
for (const part of Object.keys(byPart)) {
  const rs = byPart[part]
  const pass = rs.filter(r => r.status === 'PASS').length
  totPass += pass; totFail += rs.length - pass
  console.log(`\n### ${part}  —  ${pass}/${rs.length} pass`)
  for (const r of rs.filter(r => r.status === 'DIVERGE')) {
    console.log(`  DIVERGE  ${r.expr}`)
    console.log(`           want=${JSON.stringify(r.want)}  got=${JSON.stringify(r.got)}`)
  }
}
console.log(`\n=== TOTAL: ${totPass} pass, ${totFail} diverge, ${results.length} cases ===`)
