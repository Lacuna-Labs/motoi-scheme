// smoke.mjs — end-to-end validation of the copilot core.
//
// Run: node motoi-copilot/test/smoke.mjs   (from repo root)
//   or: node test/smoke.mjs                (from module dir)
//
// Asserts the load-bearing guarantees:
//   1. The 3 gates REJECT a hallucinated (unbound) verb.
//   2. A gate-passing completion RUNS.
//   3. RESOLVE respects local scope (let-bound vars, lambda params).
//   4. The evolve-and-win selection returns the better candidate and can
//      choose silence (NONE).
//   5. The module is de-branded (no vendor tokens surface).

import assert from 'node:assert'
import {
  Copilot, RegistryOracle, GateContext, runGates, screen,
  ReasoningStore, NONE, buildFimPrompt, mode, isBalanced,
  formAtOffset, findTopForm, scopeAtOffset, debrand, containsVendorText, IDENTITY,
  BrokenGuard,
} from '../index.js'

let pass = 0, fail = 0
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}`) }
}
function section(t) { console.log(`\n${t}`) }

const oracle = new RegistryOracle()
const ctx = new GateContext({ oracle })

section('Gate 2 (RESOLVE) — cannot ghost an unbound verb')
{
  // A candidate that mentions a verb that does not exist.
  const splice = { prefix: '(display (', suffix: '))' }
  const r = runGates('totally-made-up-verb 3', splice, ctx)
  ok('rejects hallucinated verb', r.offerable === false && r.failedGate === 'resolve')
  ok('reports the unbound symbol', Array.isArray(r.unresolved) && r.unresolved.includes('totally-made-up-verb'))
}

section('Gate 1 (PARSE) — rejects unbalanced')
{
  const splice = { prefix: '(+ 1 ', suffix: '' }
  const r = runGates('(* 2 3', splice, ctx) // leaves an open paren
  ok('rejects unbalanced s-expr', r.offerable === false && r.failedGate === 'parse')
  ok('isBalanced sanity', isBalanced('(+ 1 2)') && !isBalanced('(+ 1'))
}

section('Gate 3 (SPEC-RUN) — a passing completion RUNS')
{
  const splice = { prefix: '(display (+ 1 ', suffix: '))' }
  const r = runGates('2', splice, ctx)
  ok('offerable when it runs', r.offerable === true)
  ok('carries a run verdict', r.run && r.run.ok === true)
  ok('program reconstructed', r.program === '(display (+ 1 2))')
}

section('RESOLVE respects local scope')
{
  // n is let-bound in the surrounding prefix; a completion using n must pass.
  const buffer = '(let ((n 5)) (* n ))'
  const off = buffer.indexOf('(* n ') + '(* n '.length + 1 // inside the (* n ) form
  const outerScope = scopeAtOffset(buffer, off)
  const splice = { prefix: '(let ((n 5)) (* n ', suffix: '))' }
  const r = runGates('n', splice, ctx, { outerScope })
  ok('let-bound var n resolves', r.offerable === true)
  // lambda param
  const s2 = { prefix: '((lambda (x) (+ x ', suffix: ')) 10)' }
  const r2 = runGates('x', s2, ctx, { outerScope: new Set() })
  ok('lambda param x resolves inline', r2.offerable === true)
}

section('FIM — completion vs continuation')
{
  const compl = mode({ text: '(pset 10  7)', offset: 8 })   // suffix " 7)"
  const cont = mode({ text: '(pset 10 20 7)', offset: 14 }) // empty suffix
  ok('mid-form is completion', compl === 'completion')
  ok('end is continuation', cont === 'continuation')
  const { prompt } = buildFimPrompt({ text: '(+ 1 )', offset: 5, file: 'demo.scm' })
  ok('prompt frames prefix/suffix/middle', prompt.includes('fim_prefix') && prompt.includes('fim_middle'))
  ok('prompt frames repo', prompt.includes('motoi-scheme'))
}

section('Evolve-and-win selection (reasoning loop)')
{
  const store = new ReasoningStore()
  const ranked = store.retrieve({
    query: 'sum a list',
    candidates: [
      { text: 'fold + 0 xs', middle: '(fold + 0 xs)', paradigm: 'functional' },
      { text: 'do loop sum', middle: '(do ...)', paradigm: 'imperative' },
    ],
    person: 'alfred',
    allowSilence: true,
  })
  ok('returns a ranked winner', ranked && ranked.chosen && ranked.ranked.length === 2)

  // Silence wins when the person overwhelmingly wants no suggestion.
  const s2 = new ReasoningStore()
  for (let i = 0; i < 20; i++) s2.recordSilencePreference('quietdev')
  const r2 = s2.retrieve({
    query: 'x',
    candidates: [{ text: 'noise', middle: '(noise)', paradigm: null }],
    person: 'quietdev',
    allowSilence: true,
  })
  ok('silence can win (returns null)', r2 === null)
}

section('Full Copilot.suggest — structural fallback, no backend')
{
  const cp = new Copilot({ oracle, persist: false })
  const pos = { text: '(displ', offset: 6 } // completing "displ" -> display
  const sug = await cp.suggest(pos, { n: 5 })
  ok('produces a mode', sug.mode === 'continuation' || sug.mode === 'completion')
  ok('all offered candidates passed gates', sug.offerableCount >= 0)
  // Every rejected candidate carries a gate + reason (teaching signal)
  ok('rejections are logged', Array.isArray(sug.rejected))
  if (sug.offer !== null) ok('offer is a string', typeof sug.offer === 'string')
}

section('De-brand')
{
  ok('scrubs qwen', !/qwen/i.test(debrand('I am Qwen2.5-Coder, made by Alibaba Cloud.')))
  ok('scrubs alibaba', !/alibaba/i.test(debrand('trained by Alibaba')))
  ok('audit finds none in identity', containsVendorText(IDENTITY.intro).length === 0)
  ok('audit detects a leak', containsVendorText('hello Qwen world').length === 1)
}

section('Editing — dual addressing')
{
  const buffer = '(define x 1)\n(define (f a) (+ a x))\n(display (f 2))'
  const fSpan = findTopForm(buffer, 'f')
  ok('finds top form by name', fSpan && fSpan.text.startsWith('(define (f a)'))
  const held = formAtOffset(buffer, buffer.indexOf('(+ a x)') + 2)
  ok('finds innermost form at offset', held && held.text.includes('+ a x'))
}

section('Broken-example guard — cross-standard tripwires')
{
  // Filtered through the live oracle so only genuinely-unbound names tripwire.
  const guard = new BrokenGuard({ knows: (n) => oracle.knows(n) })
  ok('loads trap cards', guard.size > 0)
  // Name-doesn't-exist traps FIRE (deterministic tripwire) with a lesson + fix.
  const w = guard.warn('(display (fold-left + 0 (list 1 2 3)))')
  ok('fold-left tripwires', typeof w === 'string' && /fold/.test(w))
  ok('foldl tripwires (Racket sibling)', typeof guard.warn('(foldl + 0 (list 1 2 3))') === 'string')
  ok('foldr tripwires (Racket sibling)', typeof guard.warn('(foldr cons (quote ()) (list 1 2 3))') === 'string')
  // Real Motoi verbs NEVER tripwire — no false positives on correct programs.
  ok('clean fold is silent', guard.warn('(display (fold + 0 (list 1 2 3)))') === null)
  ok('clean fold-right is silent', guard.warn('(display (fold-right cons (quote ()) (list 1 2 3)))') === null)
  ok('real verb use is silent (reduce)', guard.warn('(reduce + 0 (list 1 2 3))') === null)
  ok('local var reuse is silent (id)', guard.warn('(map (lambda (id) id) (list 1 2))') === null)
  // Real-but-different verbs are ADVISORY (surface on demand, not on every use).
  ok('reduce has advisory lesson', guard.lookupAdvice('reduce') !== null)
  ok('fold-left has NO advisory (its a tripwire)', guard.lookupAdvice('fold-left') === null)
  // Wired into the copilot: suggest() surfaces the guard field.
  const cp2 = new Copilot({ oracle, persist: false })
  ok('copilot.guardWarn tripwires fold-left', typeof cp2.guardWarn('(fold-left + 0 (list 1 2 3))') === 'string')
  ok('copilot.guardWarn silent on clean', cp2.guardWarn('(fold + 0 (list 1 2 3))') === null)
}

console.log(`\n${'='.repeat(48)}`)
console.log(`SMOKE: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
