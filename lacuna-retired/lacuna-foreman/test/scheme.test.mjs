// scheme.test.mjs — U1 unit tests for `scheme.mjs`, the bridge between the engine (lacuna-scheme) and the worker verbs.
// owns: the proofs that a worker's base env withholds every host-reaching verb, that values cross JS ↔ Scheme in shape
//   and in bounds, and that a symbol is one symbol.
// refuses: to mock the bridge; every test drives the real engine through `scheme.mjs` or a real `Supervisor`.
// implements: design §5, §6 (the kernel's reader and evaluator), §12 (carts are Scheme), law 3 (the brain never executes);
//   eng §2 row `scheme.mjs`, §3.7 (the engine is imported, never copied).
// invariants: none written in the module; law 3 is held by the refusals tested here.
// faults: F-02 (a verb outside the worker's set is refused with a sentence).
// coverage: scheme.mjs — lines 100% branches 100% functions 100% (2026-10-24, with scheme-engine.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, evaluate, baseEnv, toScheme, toJson, symOf, Sym, ENGINE_RANGE } from '../scheme.mjs'
import { makeSup } from '../../../test/conformance/fake-host.mjs'

const REFUSED = /^(llm|persona|sakura|artifact|completion|completions)\//
const run = (src, env = baseEnv({ n: 100_000 })) => evaluate(parse(src)[0], env, { n: 100_000 })

/** Every name the env chain can resolve. */
function namesOf(env) {
  const out = new Set()
  for (let e = env; e; e = e.parent) for (const k of e.vars?.keys() || []) out.add(k)
  return [...out]
}

// spec: design §6 · law 3 · eng §2 row scheme.mjs · F-02
// class: E1 a handler throws (the refusal is a throw inside the worker's handler)
// technique: exhaustive enumeration of the base env (every name, not a sample)
// method: walk the env chain; for each name under llm/ persona/ sakura/ artifact/ completion(s)/, call it and read the
//         sentence it throws; assert at least one such name exists so the walk cannot pass on an empty env
// sre: if the engine grows a new llm/* verb that shells out to curl, does every worker still refuse it before it runs?
test('every host-reaching name in the base env throws "not a worker\'s verb" before it runs', () => {
  const env = baseEnv({ n: 1000 })
  const reach = namesOf(env).filter((n) => REFUSED.test(n))
  assert.ok(reach.length >= 10, `the engine names ${reach.length} host verbs; the walk must see them`)
  for (const name of reach) {
    const f = env.get(name)
    assert.throws(() => f('hi'), new RegExp(`^Error: ${name.replace(/[/]/g, '\\/')} is not a worker's verb — ask the brain with \\(need-brain …\\)$`))
  }
})

// spec: design §6 · law 3 (the brain never executes) · eng §3.7
// class: E1 a handler throws
// technique: fault injection through a real supervisor on a fake clock (makeSup)
// method: spawn a worker whose handler calls (sakura/ask …); send it one event; read the upstream `crashed` row and its
//         sentence; assert the worker restarted (permanent) and nothing reached the host but the crash record
// sre: if a cart tries to think around the brain, is the attempt on the record as a crash with the reason, not silent?
test('a worker that calls sakura/ask crashes with the refusal on the record, and restarts', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'sneaky', program: `(on 'go (lambda (x) (sakura/ask "me")))` })
  const r = s.send(w.id, 'go', 1)
  assert.equal(r.restarted, true)
  const crashed = h.up.filter((u) => u.kind === 'crashed')
  assert.equal(crashed.length, 1)
  assert.match(crashed[0].data.why, /sakura\/ask is not a worker's verb/)
  assert.equal(w.state, 'running')
})

// spec: design §6 ("there is no eval") · law 11 (runtime data never becomes code)
// class: E1 a handler throws
// technique: boundary: the one verb that would turn text into code, and the data reader beside it
// method: evaluate (eval …) in the base env and read the unbound-name error; read text with (slat-load …) and assert
//         the result is data (a list), never a value computed from the text
// sre: if a hostile log line says (shell "rm -rf ~"), can any worker turn it into code? It must stay a string.
test('there is no eval: text a worker receives is read as data, never run', () => {
  assert.throws(() => run(`(eval '(+ 1 2))`), /eval/)
  const env = baseEnv({ n: 100_000 })
  const v = run(`(slat-load "(shell \\"rm -rf ~\\")")`, env)
  assert.ok(Array.isArray(v) && v.length === 1, 'one form read as data')
  assert.equal(JSON.stringify(toJson(v)).includes('rm -rf'), true, 'the text is still there, as data')
})

// spec: design §6 · law 10 of the box (no outside sites) · eng §3.7
// class: J9 socket errors (a verb that would open a connection)
// technique: boundary: the one engine verb documented as "replaced with the real fetch" one day
// method: call (load-community-cart 'x) and read its record: an error of kind not-yet-implemented, never a fetch
// sre: if the engine wires its community registry, does this test fail before a worker can reach the network?
test('load-community-cart answers not-yet-implemented and reaches nothing', () => {
  const v = toJson(run(`(load-community-cart 'x)`))
  assert.match(JSON.stringify(v), /not-yet-implemented/)
})

// spec: design §7 (forms; symbols are not body data) · eng §3.3 worker events
// class: J7 JSON.parse on hostile input (prototype-pollution keys)
// technique: hostile input: a JSON body carrying `__proto__` and `constructor` as own keys
// method: JSON.parse the hostile text, pass it through toScheme, and read the alist; assert both keys became symbols in
//         the alist and Object.prototype gained nothing
// sre: if a hand's reply carries {"__proto__": {"admin": true}}, does any object in the foreman become an admin?
test('toScheme turns a hostile object into an alist and pollutes no prototype', () => {
  const hostile = JSON.parse('{"__proto__": {"admin": true}, "constructor": {"prototype": {"x": 1}}, "ok": 1}')
  const a = toScheme(hostile)
  assert.deepEqual(a.map(([k]) => k.name), ['__proto__', 'constructor', 'ok'])
  assert.ok(a.every(([k]) => k instanceof Sym))
  assert.equal({}.admin, undefined)
  assert.equal({}.x, undefined)
})

// spec: design §7 · eng §3.3 (a hand's op comes back as a symbol)
// class: J7 JSON.parse on hostile input (shape)
// technique: state walk over every JS shape: Sym, array, nested object, null, number, string, boolean
// method: convert each shape and read the Scheme value; a Sym passes through as the same object
// sre: if a mind's label is already a symbol, does it stay the symbol a cart's case compares with eq?
test('toScheme keeps a symbol, lists stay lists, objects become alists of symbols, scalars pass', () => {
  const s = symOf('jobs')
  assert.equal(toScheme(s), s)
  const v = toScheme({ op: 'jobs', rows: [{ n: 1 }], none: null })
  assert.equal(v[0][0], symOf('op'))
  assert.equal(v[1][1][0][0][0], symOf('n'))
  assert.deepEqual([toScheme(null), toScheme(3), toScheme('x'), toScheme(false)], [null, 3, 'x', false])
})

// spec: design §5 · eng §3.5 (rings; nothing that only grows) · B5
// class: J3 the event loop blocked (a cyclic value walked without a bound)
// technique: boundary: depth 12 and 13; a cyclic structure
// method: build a list nested 14 deep and a list that contains itself; toJson both; read '…' at depth 13 and assert the
//         cyclic walk returns at once
// sre: if a worker builds a cyclic list and reports it, does the foreman hang serialising it?
test('toJson stops at depth 12 with "…", so a cyclic value cannot hang the foreman', () => {
  let deep = 'leaf'
  for (let i = 0; i < 14; i++) deep = [deep]
  let out = toJson(deep)
  let d = 0
  while (Array.isArray(out)) { out = out[0]; d++ }
  assert.equal(out, '…')
  assert.equal(d, 13)
  const cyc = []; cyc.push(cyc)
  const t0 = performance.now()
  toJson(cyc)
  assert.ok(performance.now() - t0 < 50)
})

// spec: design §7 (symbols are not body data) · eng §3.3
// class: W8 a reply that cannot be sealed
// technique: state walk over every Scheme shape the engine makes: Sym, Pair, Closure, builtin, undefined, NaN
// method: evaluate real engine values and toJson them; read the JSON each becomes
// sre: if a worker reports a closure or (void), does the report still serialise to something a person can read?
test('toJson: a symbol by name, a pair as two items, a procedure named, undefined as null', () => {
  assert.equal(toJson(symOf('pass')), 'pass')
  assert.deepEqual(toJson(run(`(cons 1 'b)`)), [1, 'b'])
  assert.equal(toJson(run(`(lambda (x) x)`)), '#<procedure>')
  assert.equal(toJson(run(`car`)), '#<procedure>')
  assert.equal(toJson(undefined), null)
  assert.ok(Number.isNaN(toJson(NaN)), 'NaN passes through; the protocol refuses it at the seal (U2)')
})

// spec: design §4 (one word, one meaning) · eng §3.3 (an op comes back as a symbol)
// class: E10 a duplicate message (two symbols for one name would make a duplicate compare unequal)
// technique: identity check
// method: intern the same name twice and compare by identity; compare with an engine-read symbol
// sre: if a hand's op comes back twice, does (eq? op 'jobs) hold both times?
test('symOf interns: one name is one symbol, the same the reader makes', () => {
  assert.equal(symOf('jobs'), symOf('jobs'))
  assert.equal(symOf(42).name, '42')
  assert.equal(run(`'jobs`), symOf('jobs'))
  assert.equal(ENGINE_RANGE, '^3.0.0')
})

// spec: design §5, §12 (carts are Scheme text, read from files) · eng §3.7 (the engine is imported; the bridge reads text in)
// class: J15 Unicode and bytes (BOM, NUL, CRLF, multi-byte, a lone surrogate)
// technique: state walk over the text encodings an editor or a hand can produce
// method: spawn a worker from a program saved with a BOM (it must load, not be buried for "unbound symbol: ﻿"), one
//         with CRLF line ends, and report strings holding NUL, emoji, accents, CJK and a lone surrogate; read each
//         `report` row upstream and the parse of a BOM text (the same forms as without it)
// sre: if a cart is saved by an editor that writes a BOM, does the foreman bury it for an invisible character?
test('a program saved with a BOM or CRLF loads; NUL, emoji and a lone surrogate pass through a report intact', () => {
  assert.deepEqual(toJson(parse('﻿(define x 1)')), toJson(parse('(define x 1)')))
  const { h, s } = makeSup()
  const bom = s.spawn({ name: 'bom', program: `﻿(on 'go (lambda (x) (report 'ok x)))` })
  assert.equal(bom.state, 'running', String(bom.last))
  const crlf = s.spawn({ name: 'crlf', program: "(on 'go\r\n  (lambda (x)\r\n    (report 'ok \"a\u0000b\" \"🦊 é 日本\" \"\uD800\")))" })
  s.send(bom.id, 'go', 1)
  s.send(crlf.id, 'go', 1)
  const rows = h.up.filter((u) => u.kind === 'report').map((u) => u.data.data)
  assert.deepEqual(rows[0], [1])
  assert.equal(rows[1][1], '🦊 é 日本')
  assert.equal(rows[1][2], '\uD800')
  assert.equal(rows[1][0].length, 3, 'the NUL stays one character between a and b')
})
