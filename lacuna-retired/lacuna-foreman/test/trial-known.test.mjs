// trial-known.test.mjs — U1 unit tests for the trial's table of known metrics and hand ops (`KNOWN`), read from
// verbs.slat at import, in scratch child processes.
// owns: the proofs that a trial with no readable table still runs every handler and timer (checking no names), and that
//   a table with no `subscribe` row knows no metric.
// refuses: to edit verbs.slat; inside each scratch child a resolve hook gives `trial.mjs` (and only it) an `fs`
//   whose verbs.slat throws or answers a short table (a dependency mocked, never the module under test).
// implements: design §6 (a dry run before anyone is asked); eng §2 row trial.mjs (moved out of supervisor.mjs 2026-10-24).
// invariants: none of §18 (the trial writes nothing).
// faults: none by id; the trial names problems in sentences.
// coverage: trial.mjs — lines 100% functions 100% (2026-10-24, with supervisor-wire.test.mjs and cart.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const SUP = new URL('../trial.mjs', import.meta.url).href
/** Run `probe` in a child where trial.mjs reads verbs.slat through `fakeFs` (module source). → parsed stdout. */
function child(fakeFs, probe) {
  const hook = `import { registerHooks } from 'node:module'
registerHooks({ resolve(spec, ctx, next) {
  if (spec === 'node:fs' && ctx.parentURL?.endsWith('/trial.mjs')) return { url: 'data:text/javascript,' + ${JSON.stringify(encodeURIComponent(fakeFs))}, shortCircuit: true }
  return next(spec, ctx) } })`
  const r = spawnSync(process.execPath, ['--input-type=module', '--import', `data:text/javascript,${encodeURIComponent(hook)}`,
    '-e', `const { trial } = await import(${JSON.stringify(SUP)})\n${probe}`], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

// spec: design §6 (the dry run) · eng §2 row trial.mjs (moved out of supervisor.mjs 2026-10-24)
// class: J11 fs ENOENT (the table cannot be read)
// technique: process kill of a scratch child with a resolve hook: trial.mjs's readFileSync throws ENOENT
// method: the child runs trial() over a program with an unknown metric, an unknown hand op and a throwing handler;
//         the names are not checked (no table), the throwing handler still is
// sre: if verbs.slat goes missing under a running foreman, does the trial still catch the crash it can see?
test('a trial with no readable table checks no names but still runs every handler', () => {
  const out = child(`export const readFileSync = () => { const e = new Error('ENOENT: no such file, open verbs.slat'); e.code = 'ENOENT'; throw e }`,
    `console.log(JSON.stringify(trial("(subscribe 'cpu_temp 60) (hand 'teleport) (on 'go (lambda (x) (car '())))")))`)
  assert.equal(out.ok, false)
  assert.equal(out.problems.length, 1)
  assert.match(out.problems[0], /^\(on 'go\) with 1: on go: car/)
})

// spec: design §6 (the dry run) · eng §3.3 (the metrics a worker may subscribe to)
// class: J13 env unset, empty, non-numeric (a table with a row missing)
// technique: process kill of a scratch child with a resolve hook: verbs.slat has no `subscribe` row
// method: the child runs trial() over a program that subscribes; with no row the trial knows no metric and says so
// sre: if the table loses its metrics row, does the trial refuse every subscription instead of passing them blind?
test('a table with no subscribe row knows no metric: every subscription is a problem', () => {
  const out = child(`import * as real from 'node:fs'
export const readFileSync = (p, e) => (String(p).endsWith('verbs.slat') ? '(@ ("verbs" ((@ ("name" "on") ("tier" "watch")))))' : real.readFileSync(p, e))`,
    `console.log(JSON.stringify(trial("(subscribe 'disk_free_gb 60)")))`)
  assert.deepEqual(out.problems, ["there is no metric 'disk_free_gb — use one of "])
})
