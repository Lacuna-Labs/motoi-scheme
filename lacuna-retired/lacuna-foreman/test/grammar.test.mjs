// grammar.test.mjs — THE ACTION SELECTOR'S GRAMMAR (lane U2). Owns: the unit tests of grammar.mjs: which verbs a small mind
// may ever choose (`mindable`), the GBNF a job decodes under (`mindGrammar`), and the same rules in code (`readAnswer`),
// which READS an answer as data and never evaluates it. Refuses: a mock of grammar.mjs; a live mind (:8092+) — answers here
// are text the test writes, and a seeded fuzz stands in for a model's worst output.
// Implements: design §7.10 (decoder fences), §10 (small minds), §11 (action selector by grammar), law 1 (a mind never
// writes code), law 11 (untrusted input never triggers a consequential action); engineering §2 grammar.mjs row.
// Invariants (§18): none written here (a refused answer is dropped and counted by mind.mjs). Faults (§16): F-02 class
// (a verb outside the job is refused, as a tool outside a header is).
// coverage: grammar.mjs — lines 100% branches 95.70% functions 100% (2026-10-24, lane U2 files; :12 :54 :72 named test.todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { mindable, mindGrammar, readAnswer, LIMIT } from '../grammar.mjs'
import { VERBS, PURE, HAND_READS } from '../capabilities.mjs'

const job = (verbs, labels = []) => ({ verbs: new Set(verbs), labels })
const ALL = job(VERBS.map((v) => v.name), ['ok', 'real-error', 'needs-owner'])
const METRICS = VERBS.find((v) => v.name === 'subscribe').metrics

// spec: design §11 "action selector by grammar" · law 1 "a mind never writes code" · grammar.mjs "spawn, on, every, after (never mindable)"
// class: L3 an act without a press (a mind may not reach code) · W5 malformed (a verb that takes a program)
// technique: table over every verb in verbs.slat
// method: a verb is mindable exactly when it is known, not pure, and none of its argument shapes is proc, program or expr
// sre: if a small mind is asked to choose, can it ever choose a verb that runs code it wrote?
test('a verb is mindable only when it is known, reaches outside, and takes data, never a procedure, program or expression', () => {
  const want = new Set(VERBS.filter((v) => !PURE.has(v.name) && !(v.args || []).some((a) => ['proc', 'program', 'expr'].includes(a.replace(/[?*]$/, '')))).map((v) => v.name))
  for (const v of VERBS) assert.equal(mindable(v.name), want.has(v.name), v.name)
  for (const never of ['spawn', 'on', 'every', 'after', 'file', 'mail', 'get', 'recall', 'done', 'nope', '']) assert.equal(mindable(never), false, never)
  assert.deepEqual([...want].sort(), ['act', 'ask', 'hand', 'need-brain', 'remember', 'report', 'send-to', 'subscribe', 'work-order'])
})

// spec: design §7.10 "decoder fences … generated per run from the header" · §11 · llama.cpp GBNF
// class: W5 malformed (shape) — the fence itself
// technique: golden lines for one job: the verbs it holds (code verbs filtered out), labels or the sym fallback, the bounds
// method: read the GBNF text: root is one form; each kept verb has its rule with `sp`, `?` and `{0,4}` for its shapes;
//         metric and op list every subscribe metric and every hand read; str and sym carry LIMIT's numbers
// sre: if llama.cpp decodes under this text, can the mind emit anything but one form of a verb it was given?
test('the GBNF holds one form of the job\'s mindable verbs, its labels, summary and observe, with the bounds from LIMIT', () => {
  const g = mindGrammar(job(['hand', 'need-brain', 'subscribe', 'spawn', 'on'], ['ok', 'bad']))
  const lines = g.trim().split('\n')
  assert.equal(lines[0], 'root ::= "(" form ")"')
  assert.equal(lines[1], 'form ::= v-hand | v-need-brain | v-subscribe | d-label | d-summary | d-observe')
  assert.ok(lines.includes('v-hand ::= "hand" sp op (sp str){0,4}'))
  assert.ok(lines.includes('v-need-brain ::= "need-brain" (sp sym)? sp str (sp datum){0,4}'))
  assert.ok(lines.includes('v-subscribe ::= "subscribe" sp metric sp num'))
  assert.ok(lines.includes('d-label ::= "label" sp label') && lines.includes('label ::= "\'ok" | "\'bad"'))
  assert.ok(lines.includes('d-summary ::= "summary" sp str') && lines.includes('d-observe ::= "observe" sp sym sp datum'))
  assert.ok(!g.includes('v-spawn') && !g.includes('v-on '), 'code verbs never enter the fence')
  assert.ok(g.includes(`{0,${LIMIT.str}}`) && g.includes(`{0,${LIMIT.sym - 1}}`))
  assert.equal(lines.find((l) => l.startsWith('metric ::=')), `metric ::= ${METRICS.map((m) => `"'${m}"`).join(' | ')}`)
  assert.equal(lines.find((l) => l.startsWith('op ::=')).split(' | ').length, HAND_READS.size)
  const bare = mindGrammar(job([], []))
  assert.match(bare, /^form ::= d-summary \| d-observe$/m); assert.match(bare, /^label ::= sym$/m)
})

// spec: design §11 (action selector) · law 11 · grammar.mjs readAnswer "the same rules in code (Ollama ignores grammar)"
// class: W5 malformed (shape; a symbol as data; a nested expression) · L3 an act without a press (a verb outside the job)
// technique: table over answers that break each rule once: the reader, the form count, the head, the job, each shape
// method: each is {ok: false} with one sentence; nothing is evaluated (a `(begin …)`, a lambda and a dotted pair are refused
//         as data, never run)
// sre: if a small mind answers with code or a verb it was not given, is the answer dropped instead of acted on?
test('readAnswer refuses every answer outside the job\'s grammar with one sentence and evaluates nothing', () => {
  const j = job(['hand', 'subscribe', 'report', 'send-to', 'on'], ['ok'])
  let ran = false; globalThis.__ran = () => { ran = true }
  const cases = [
    ['(hand \'jobs', /does not read/], ['', /not exactly one form/], ["(hand 'jobs) (hand 'disk)", /not exactly one form/], ['"just text"', /not exactly one form/],
    ['((lambda () 1))', /not exactly one form/], ['(a . b)', /not exactly one form/], ['(1 2)', /not exactly one form/],
    ["(spawn 'x \"(on 'a 1)\")", /'spawn' is not in this job's grammar/], ["(on 'tick (lambda (x) (__ran)))", /'on' is not in this job's grammar/],
    ["(remember 'k 1)", /'remember' is not in this job's grammar/],
    ["(label 'bad)", /must be one of ok/], ['(label ok)', /must be one of ok/], ["(label 'ok 'ok)", /must be one of ok/], ['(label)', /must be one of ok/],
    ['(summary 1)', /\(summary …\) has the wrong arguments/], ['(summary "a" "b")', /wrong arguments/], ["(observe \"k\" 1)", /wrong arguments/],
    ["(hand 'rm-rf)", /\(hand …\) has the wrong arguments/], ["(hand 'jobs 1)", /wrong arguments/], ["(hand 'jobs \"a\" \"b\" \"c\" \"d\" \"e\")", /wrong arguments/],
    ["(hand 'jobs (begin (__ran)))", /wrong arguments/], ['(hand)', /wrong arguments/], ["(hand \"jobs\")", /wrong arguments/],
    ["(subscribe 'nope 30)", /wrong arguments/], ["(subscribe 'rss \"30\")", /wrong arguments/], ["(subscribe 'rss 1e400)", /wrong arguments/],
    ["(report 'Bad-Case 1)", /wrong arguments/], [`(report '${'a'.repeat(LIMIT.sym + 1)})`, /wrong arguments/], ["(report 'x (car '()))", /wrong arguments/],
    ["(report 'x #(1 2))", /wrong arguments/], [`(send-to "${'s'.repeat(LIMIT.str + 1)}" 'k 1)`, /wrong arguments/],
  ]
  for (const [text, why] of cases) { const r = readAnswer(text, j); assert.equal(r.ok, false, text); assert.match(r.why, why, text) }
  assert.equal(ran, false, 'nothing in an answer ever ran'); delete globalThis.__ran
  assert.equal(readAnswer("(label 'ok)", job(['hand'])).why, '(label …) must be one of no labels')
  assert.equal(readAnswer(null, j).ok, false)
})

// spec: design §11 · §10 small minds · grammar.mjs readAnswer → {ok, kind, verb?, args?, label?, text}
// class: L5 the record's shape (what a checked answer hands the worker) · J15 Unicode in a string argument
// technique: boundary on every bound (str 400, sym 40, star 4) at the bound; every argument shape once
// method: each answer is ok with its kind; a quoted symbol comes back as the symbol (the verb wants one), the rest as is;
//         the text is the trimmed answer
// sre: if a mind's answer is right, does the worker get exactly the data it chose, ready to use, nothing more?
test('readAnswer accepts each shape at its bounds and hands back the data: symbols as symbols, the rest as written', () => {
  const j = job(['hand', 'subscribe', 'report', 'send-to', 'need-brain', 'remember', 'ask', 'act'], ['ok', 'real-error'])
  const r = readAnswer(`  (hand 'jobs "a" "中" "${'s'.repeat(LIMIT.str)}" "")  `, j)
  assert.deepEqual([r.ok, r.kind, r.verb, r.args[0].name, r.args.slice(1, 3), r.args[3].length], [true, 'verb', 'hand', 'jobs', ['a', '中'], LIMIT.str])
  assert.equal(r.text, r.text.trim())
  assert.equal(readAnswer(`(subscribe '${METRICS[0]} 30)`, j).args[1], 30)
  const rep = readAnswer(`(report '${'a'.repeat(LIMIT.sym)} 1 -2.5 "s" #t)`, j)
  assert.deepEqual([rep.ok, rep.args[0].name.length, rep.args.slice(1)], [true, LIMIT.sym, [1, -2.5, 's', true]], 'the star takes four')
  assert.equal(readAnswer(`(report 'k 1 2 3 4 5)`, j).ok, false)
  assert.equal(readAnswer(`(report 'k 'v)`, j).args[1].name, 'v', 'a datum may be a quoted symbol')
  assert.deepEqual([readAnswer('(need-brain "why")', j).ok, readAnswer("(need-brain 'judgment \"why\" 1 2)", j).ok], [true, true])
  assert.deepEqual([readAnswer('(send-to "w-2" \'ping 1)', j).ok, readAnswer("(remember 'k #t)", j).ok, readAnswer('(ask "who?")', j).ok, readAnswer('(act)', j).ok], [true, true, true, true])
  assert.deepEqual(readAnswer("(label 'real-error)", j), { ok: true, kind: 'label', label: 'real-error', text: "(label 'real-error)" })
  assert.deepEqual(readAnswer('(summary "two jobs failed")', j), { ok: true, kind: 'summary', args: ['two jobs failed'], text: '(summary "two jobs failed")' })
  const o = readAnswer("(observe 'disk 0.4)", j); assert.deepEqual([o.kind, o.args[0].name, o.args[1]], ['observe', 'disk', 0.4])
})

// spec: design §11 (the answer is READ as data, never evaluated) · law 11 · law 1
// class: J7 hostile input (a mind's worst output) · J3 the event loop blocked (a pathological answer)
// technique: seeded bounded fuzz: 1,000 answers drawn from parens, quotes, hash forms, symbols, strings and numbers
//            (seed printed on failure; mulberry32)
// method: readAnswer never throws, answers in < 50 ms each, and every ok answer is one of the four kinds with a verb the
//         job holds and may choose — never a code verb
// sre: if a small mind is broken or poisoned and emits noise, can any of it become an action the job did not allow?
test('a 1,000-answer seeded fuzz never throws, never blocks, and never yields a verb outside the job', () => {
  const seed = Number(process.env.FUZZ_SEED || 20261024)
  let a = seed
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const ATOMS = ['(', ')', ' ', "'", '"', '#t', '#f', '#(', '.', 'hand', 'label', 'summary', 'observe', 'spawn', 'on', 'lambda', 'jobs', 'ok', 'x', '1', '-2.5', '1e400', '"s"', 'report', 'subscribe', 'rss', '\\', ';', '中']
  const j = job(['hand', 'report', 'subscribe', 'on', 'spawn'], ['ok'])
  for (let i = 0; i < 1000; i++) {
    let text = ''; const n = 1 + Math.floor(rnd() * 14)
    for (let k = 0; k < n; k++) text += ATOMS[Math.floor(rnd() * ATOMS.length)]
    if (rnd() < 0.5) text = `(${text})`
    const t0 = performance.now()
    let r
    try { r = readAnswer(text, j) } catch (e) { assert.fail(`seed ${seed} case ${i}: ${JSON.stringify(text)} threw ${e.message}`) }
    assert.ok(performance.now() - t0 < 50, `seed ${seed} case ${i}`)
    if (r.ok) {
      assert.ok(['verb', 'label', 'summary', 'observe'].includes(r.kind), `seed ${seed} case ${i}`)
      if (r.kind === 'verb') assert.ok(j.verbs.has(r.verb) && mindable(r.verb), `seed ${seed} case ${i}: ${text}`)
    }
  }
})

// spec: grammar.mjs header "mindGrammar(job) → a GBNF text … and readAnswer(text, job) → the same rules in code"
// class: W5 malformed — two readers that disagree (the fence and the code)
// technique: generation from the fence: for every mindable verb, answers built from its shape at 0, 1 and the max of a star,
//            with and without an optional
// method: every answer the grammar can produce for the job is accepted by readAnswer with that verb
// sre: if llama.cpp decodes a valid answer under the fence, will the code ever drop it as invalid (a mind that always fails)?
test('every answer the fence admits for a verb, the code admits too', () => {
  const sample = { op: "'jobs", str: '"s"', sym: "'k", num: '3', datum: '#t', metric: `'${METRICS[0]}` }
  const verbs = VERBS.filter((v) => mindable(v.name))
  const j = job(verbs.map((v) => v.name))
  assert.deepEqual(verbs.map((v) => v.name).sort(), ['act', 'ask', 'hand', 'need-brain', 'remember', 'report', 'send-to', 'subscribe', 'work-order'])
  let n = 0
  for (const v of verbs) {
    const shapes = v.args || []
    for (const fill of [0, 1, LIMIT.star]) {
      const parts = []
      for (const s of shapes) {
        const base = s.replace(/[?*]$/, '')
        if (s.endsWith('*')) for (let k = 0; k < fill; k++) parts.push(sample[base])
        else if (s.endsWith('?')) { if (fill) parts.push(sample[base]) } else parts.push(sample[base])
      }
      const text = `(${[v.name, ...parts].join(' ')})`
      const r = readAnswer(text, j)
      assert.deepEqual([r.ok, r.verb], [true, v.name], text); n++
    }
  }
  assert.equal(n, verbs.length * 3)
})

