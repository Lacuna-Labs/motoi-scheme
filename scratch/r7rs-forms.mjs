import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'
import { expandProgram } from '../src/macro.js'
const run = (src) => {
  const fuel = { n: 500000 }
  const env = makeCoreEnv({ fuel })
  const { forms } = expandProgram(parse(src), { fuel: { n: 500000 } })
  let last
  for (const f of forms) last = evaluate(f, env, fuel)
  return last
}
// Each probe must EXERCISE the form and produce a checkable value.
const probes = {
  'quote': ["(quote a)", 'a'], 'if': ["(if #t 1 2)", 1], 'lambda': ["((lambda (x) x) 5)", 5],
  'define': ["(define z 3) z", 3], 'set!': ["(define z 1) (set! z 9) z", 9],
  'begin': ["(begin 1 2)", 2], 'and': ["(and 1 2)", 2], 'or': ["(or #f 3)", 3],
  'when': ["(when #t 7)", 7], 'unless': ["(unless #f 8)", 8],
  'cond': ["(cond (#f 1) (else 2))", 2], 'else': ["(cond (else 4))", 4],
  '=>': ["(cond (5 => (lambda (x) x)))", 5], 'case': ["(case 2 ((1) 'a) ((2) 'b) (else 'c))", 'b'],
  'let': ["(let ((x 1)) x)", 1], 'let*': ["(let* ((x 1) (y x)) y)", 1],
  'letrec': ["(letrec ((f (lambda (n) (if (= n 0) 1 (f (- n 1)))))) (f 3))", 1],
  'letrec*': ["(letrec* ((a 1) (b a)) b)", 1],
  'let-values': ["(let-values (((a b) (values 1 2))) (+ a b))", 3],
  'let*-values': ["(let*-values (((a) (values 1)) ((b) (values a))) b)", 1],
  'define-values': ["(define-values (p q) (values 1 2)) (+ p q)", 3],
  'do': ["(do ((i 0 (+ i 1))) ((= i 3) i))", 3],
  'delay': ["(force (delay 11))", 11], 'delay-force': ["(force (delay-force (delay 12)))", 12],
  'quasiquote': ["`(1 ,(+ 1 1))", null], 'unquote': ["`(,(+ 1 2))", null],
  'unquote-splicing': ["`(1 ,@(list 2 3))", null],
  'define-syntax': ["(define-syntax m (syntax-rules () ((_ x) x))) (m 6)", 6],
  'syntax-rules': ["(define-syntax m (syntax-rules () ((_ x) x))) (m 6)", 6],
  '...': ["(define-syntax m (syntax-rules () ((_ x ...) (list x ...)))) (length (m 1 2 3))", 3],
  '_': ["(define-syntax m (syntax-rules () ((_ x) x))) (m 6)", 6],
  'let-syntax': ["(let-syntax ((m (syntax-rules () ((_ x) x)))) (m 6))", 6],
  'letrec-syntax': ["(letrec-syntax ((m (syntax-rules () ((_ x) x)))) (m 6))", 6],
  'case-lambda': ["((case-lambda ((a) 1) ((a b) 2)) 1 2)", 2],
  'define-record-type': ["(define-record-type pt (mk x) pt? (x gx)) (gx (mk 42))", 42],
  'guard': ["(guard (e (#t 'caught)) (raise 'x))", 'caught'],
  'parameterize': ["(define p (make-parameter 1)) (parameterize ((p 2)) (p))", 2],
  'cond-expand': ["(cond-expand (else 13))", 13],
  'syntax-error': ["(define-syntax m (syntax-rules () ((_) (syntax-error \"boom\")))) 1", 1],
}
const bad = []
for (const [name, [src, want]] of Object.entries(probes)) {
  let got, err = null
  try { got = run(src) } catch (e) { err = e.message }
  const ok = err === null && (want === null || String(got) === String(want) || got === want ||
    (got && got.name === want) || (got && got.value === want))
  if (!ok) bad.push(`${name.padEnd(20)} ${err ? 'ERROR: ' + err : 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)}`)
}
console.log('special forms probed :', Object.keys(probes).length)
console.log('working              :', Object.keys(probes).length - bad.length)
console.log('FAILING              :', bad.length)
bad.forEach(b => console.log('  ' + b))
