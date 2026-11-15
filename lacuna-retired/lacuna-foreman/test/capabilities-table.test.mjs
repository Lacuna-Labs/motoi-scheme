// capabilities-table.test.mjs — U1 unit test for `capabilities.mjs` against a verbs table it does not expect, in a scratch
// child process.
// owns: the proof that a verb whose tier the table misspells is held by no tier (fail closed).
// refuses: to edit verbs.slat; inside one scratch child a resolve hook gives `capabilities.mjs` an `fs` whose verbs.slat
//   is a three-verb table (a dependency mocked, never the module under test); the module itself runs from disk.
// implements: design §3 law 11 (capabilities only shrink), §11 (tiers); eng §2 row capabilities.mjs.
// invariants: law 11.
// faults: F-02 (a verb the tier does not hold is refused).
// coverage: capabilities.mjs — lines 100% branches 97.83% functions 100% (2026-10-24, with capabilities.test.mjs; :37 todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeData } from '../../../lacuna-scheme/src/slat-data.js'

const CAPS = new URL('../capabilities.mjs', import.meta.url).href
const TABLE = { verbs: [{ name: 'report', tier: 'watch' }, { name: 'ask', tier: 'Act' }, { name: 'act', tier: 'act' }] }
const FAKE_FS = `import * as real from 'node:fs'
export const readFileSync = (p, e) => (String(p).endsWith('verbs.slat') ? ${JSON.stringify(writeData(TABLE))} : real.readFileSync(p, e))`
const HOOK = `import { registerHooks } from 'node:module'
registerHooks({ resolve(spec, ctx, next) {
  if (spec === 'node:fs' && ctx.parentURL?.endsWith('/capabilities.mjs')) return { url: 'data:text/javascript,' + ${JSON.stringify(encodeURIComponent(FAKE_FS))}, shortCircuit: true }
  return next(spec, ctx) } })`
const PROBE = `const c = await import(${JSON.stringify(CAPS)})
let refused = null
try { c.capsFor({ name: 'w', tier: 'watch', asked: ['ask'] }) } catch (e) { refused = e.message }
console.log(JSON.stringify({ verbs: c.VERBS.map((v) => v.name), watch: c.tierVerbs('watch'), act: c.tierVerbs('act'), refused }))`

// spec: design §11 (capabilities only shrink) · law 11 · F-02
// class: J13 env unset, empty, non-numeric (a configuration value the code does not recognise)
// technique: process kill of a scratch child with a resolve hook: verbs.slat answers a table with the tier "Act" (a typo)
// method: the child imports capabilities.mjs over the typo'd table and prints tierVerbs for watch and act and the
//         sentence capsFor throws for a watch worker asking `ask`; the misspelled verb must be in neither ceiling
// sre: if a hand edit of verbs.slat misspells a tier, does every watch worker silently gain `ask`? It must gain nothing.
test('a verb whose tier the table misspells is held by no tier: the table fails closed', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '--import', `data:text/javascript,${encodeURIComponent(HOOK)}`, '-e', PROBE],
    { encoding: 'utf8', timeout: 10_000 })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.deepEqual(out.verbs, ['report', 'ask', 'act'], 'the fake table is the one read')
  assert.deepEqual(out.watch, ['report'])
  assert.deepEqual(out.act, ['report', 'act'])
  assert.match(out.refused, /may not have ask — a watch worker may not have it/)
})
