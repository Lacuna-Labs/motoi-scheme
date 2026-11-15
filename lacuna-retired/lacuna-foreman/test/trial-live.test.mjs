// trial-live.test.mjs — U3: A CART'S TRIAL WITH LIVE MINDS, run as the command it is. Owns: the tests that run
// `node trial-live.mjs <cart> <lines> [--shadow]` as a scratch child with HOME in scratch (its token file and tiers table are
// scratch files) and LACUNA_URL on a scriptable door playing `/api/foreman/mind` and `/api/foreman/cascade`, and read what
// it prints, what it asked and what it kept. Refuses: the live door, the brain and ~/.lacuna; a mock of trial-live.mjs.
// Implements: unit-test work order §3 row trial-live.mjs (design §12 carts proven before a press, §10 the minds; eng §3.2
// row 7). Invariants (§18): "if a mind's gate is below 90% per class, then its verdicts are advice" (shadow reaches every
// rung). Faults (§16): F-09, F-16 by their records (a mind that does not answer is "unread", never a guess).
// coverage: trial-live.mjs — lines 100% branches 95.74% functions 100% (2026-10-24; gaps named as todos)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { scratch, scriptDoor } from './foreman-box.mjs'

const TRIAL = new URL('../trial-live.mjs', import.meta.url).pathname
const CART = `(lacuna-cart 'trial
  '((does . "labels lines") (agent . ((tier . watch) (verbs . (on report mind-job mind done))))
    (minds . ((label . ((job . signal->label) (labels . (noise real-error new-thing)) (untrusted . #t))))) (done . "read")))
(mind-job 'label '(:ask "what is this line?" :needs (line) :labels (noise real-error new-thing) :untrusted #t))
(on 'hand (lambda (r) (for-each (lambda (l) (mind 'label (list (cons 'line l)))) (get (get r 'result) 'lines)) SUMMARY))
(on 'mind (lambda (m) (report 'heard (get m 'label 'unread))))`
const TIERS = { models: [{ model: 'functiongemma:latest', params_b: 0.27 }, { model: 'gemma3:1b', params_b: 1.0 }, { model: 'lacuna-worker-lite', params_b: 25.2 }],
  classes: { label: { pick: 'lacuna-worker-lite', ranked: [{ model: 'lacuna-worker-lite', params_b: 25.2, pct: 100 }, { model: 'gemma3:1b', params_b: 1.0, pct: 70 }, { model: 'functiongemma:latest', params_b: 0.27, pct: 40 }] } } }
const LINES = ['GET /healthz 200', 'Traceback (most recent call last):', 'ValueError: the bundle is torn', 'mystery line', 'GET /healthz 200', 'broken rung line']

/** The door's minds: a healthz line is noise at once; a traceback is unsure below the 26B; a mystery line is unreadable everywhere. */
async function door(t, o = {}) {
  const d = await scriptDoor((p, b) => {
    if (p === '/api/foreman/cascade') return o.cascade === 'fail' ? { status: 500 } : { body: { ok: true } }
    if (p !== '/api/foreman/mind') return { status: 404 }
    const line = String(b.prompt || '')
    if (o.mind === '500') return { status: 500 }
    if (line.includes('broken rung')) return b.last ? { body: { ok: false } } : { body: { ok: false, why: 'the rung is busy' } }
    if (line.includes('mystery')) return { body: { ok: true } }
    if (line.includes('healthz')) return { body: { ok: true, text: "(label 'noise)", certainty: 0.97, box: 'studio' } }
    return { body: b.last ? { ok: true, text: "(label 'real-error)", certainty: 0.95 } : { ok: true, text: "(label 'noise)", certainty: 0.2 } }
  })
  t.after(() => d.close())
  return d
}
/** Run the trial as a child; resolves {code, out, err}. */
function run(args, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [TRIAL, ...args], { env: { PATH: process.env.PATH, NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''; p.stdout.on('data', (x) => { out += x }); p.stderr.on('data', (x) => { err += x })
    p.on('exit', (code) => resolve({ code, out, err }))
  })
}
function home(t, { tiers = true, summary = '(report \'summary "6 lines labeled")', program = null } = {}) {
  const dir = scratch('trial'); t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.mkdirSync(path.join(dir, '.lacuna'), { recursive: true }); fs.writeFileSync(path.join(dir, '.lacuna', 'foreman-token'), 't'.repeat(48), { mode: 0o600 })
  if (tiers) { fs.mkdirSync(path.join(dir, 'lacuna-world', 'bench', 'agents'), { recursive: true }); fs.writeFileSync(path.join(dir, 'lacuna-world', 'bench', 'agents', 'tiers.json'), JSON.stringify(TIERS)) }
  fs.writeFileSync(path.join(dir, 'cart.sks'), program ?? CART.replace('SUMMARY', summary))
  fs.writeFileSync(path.join(dir, 'lines.txt'), `${LINES.join('\n')}\n\n`)
  return { dir, cart: path.join(dir, 'cart.sks'), lines: path.join(dir, 'lines.txt') }
}

// spec: design §12 (a cart proven before a press) · design §10 (the ladder; the 26B the last rung) · eng §3.2 row 7 (token header; 60 s / 300 s)
// class: J18 a Promise that never settles (each rung has its deadline); E9 a message lost (a rung that refuses)
// technique: a scriptable door per line: one answers at once, one climbs to the 26B, one is unreadable on every rung, one refuses
// method: run the trial; read the ladder line, the count line ("6 lines, 5 distinct · N climbed"), each climb with its rungs
//         ("—" for no answer, "?" for no certainty, "↑"), "no rung held: unread" for the mystery line, the cart's summary,
//         the tally and the traceback lines; the door saw the token header and both deadlines' kinds (last and not)
// sre: if a cart's minds are tried before a press, does a person see exactly what each rung said and which held?
test('a trial climbs each line as far as it must and prints every rung, the cart\'s summary and the traceback tally', async (t) => {
  const d = await door(t); const h = home(t)
  const r = await run([h.cart, h.lines], { HOME: h.dir, LACUNA_URL: d.url })
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^mind label: signal->label · rungs functiongemma( → [\w:.-]+)* → lacuna-worker-lite$/m)   // the box's list decides the middle rungs
  assert.match(r.out, /^6 lines, 5 distinct · \d+ climbed · \d+ s$/m)
  assert.match(r.out, /→ lacuna-worker-lite: \(label 'real-error\)/)
  assert.match(r.out, /— \(\?, \d+ ms\)/, 'a rung with no answer and no certainty')
  assert.match(r.out, /→ no rung held: unread/)
  assert.match(r.out, /^the cart says: 6 lines labeled$/m)
  assert.match(r.out, /^labels heard: .*real-error 2/m)
  assert.match(r.out, /^traceback\/exception lines: 2 · came back as noise: 0$/m)
  const minds = d.seen.filter((x) => x.path === '/api/foreman/mind')
  assert.ok(minds.every((x) => x.headers['x-foreman-token'] === 't'.repeat(48)))
  assert.ok(minds.some((x) => x.body.last) && minds.some((x) => !x.body.last))
  assert.ok(d.seen.some((x) => x.path === '/api/foreman/cascade' && x.body.kind === 'escalation'))
})

// spec: §9 ("shadow until the gate": every rung answers every job) · design §10 · I-08
// class: L4 a claim in `said` (a shadow answer is advice, never the verdict)
// technique: the --shadow flag with the cascade road refusing (500) and no tiers table
// method: run with --shadow and no tiers file: the ladder line says shadow, every mind request carries shadow: true, each
//         record the door refuses is printed "not kept: …" on stderr; the cart with no summary prints its own `said` or "(no summary)"
// sre: if the calibration pass runs while Lacuna cannot keep the records, does the trial say so instead of losing them quietly?
test('--shadow asks every rung with shadow on; records the door will not keep are said on stderr; no summary prints "(no summary)"', async (t) => {
  const d = await door(t, { cascade: 'fail' }); const h = home(t, { tiers: false, summary: '#t' })
  const r = await run([h.cart, h.lines, '--shadow'], { HOME: h.dir, LACUNA_URL: d.url })
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^mind label: .* · shadow$/m)
  assert.ok(d.seen.filter((x) => x.path === '/api/foreman/mind').every((x) => x.body.shadow === true))
  assert.match(r.err, /not kept: \/api\/foreman\/cascade answered 500/)
  assert.match(r.out, /^the cart says: \(no summary\)$/m)
})

// spec: design §12 (a trial refuses what does not load; a person reads why) · design §17 (12 refused by form: a program that does not load)
// class: J12 process exit codes (2 usage, 1 not loaded); E1 a handler throws (at load)
// technique: boundary on the command line and the program
// method: no arguments → exit 2 and the usage line; a cart whose load throws → exit 1 "it did not load"; a plain program
//         (no header, no minds) → exit 0, no ladder, "the cart says: (no summary)"; the mind door at 500 → lines unread
// sre: if someone runs the trial wrong or on a broken cart, does it say what is wrong and exit non-zero, never hang?
test('usage is exit 2; a cart that does not load is exit 1; a plain program and a mind door at 500 still end with a report', async (t) => {
  const d = await door(t, { mind: '500' })
  const u = await run([], { HOME: '/nonexistent' })
  assert.equal(u.code, 2); assert.match(u.err, /node trial-live\.mjs <cart\.sks> <lines-file> \[--shadow\]/)
  const bad = home(t, { program: "(car '())" })
  const b = await run([bad.cart, bad.lines], { HOME: bad.dir, LACUNA_URL: d.url })
  assert.equal(b.code, 1); assert.match(b.err, /it did not load/)
  const plain = home(t, { program: "(on 'hand (lambda (r) #t))" })
  const p = await run([plain.cart, plain.lines], { HOME: plain.dir, LACUNA_URL: d.url })
  assert.equal(p.code, 0, p.err); assert.doesNotMatch(p.out, /^mind /m); assert.match(p.out, /^the cart says: \(no summary\)$/m)
  const h = home(t)
  const r = await run([h.cart, h.lines], { HOME: h.dir, LACUNA_URL: d.url })
  assert.equal(r.code, 0, r.err); assert.match(r.out, /^labels heard: unread 5$/m)
})

