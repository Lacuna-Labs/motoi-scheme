// grammar-step.test.mjs — THE LATCH COMPILED TO THE GRAMMAR (K1.4; ROAD category 5 D1; SENTRY-2.0 §2–§3). Owns: the proofs
// that a step's grammar decodes only the step's calls (a call inside the allows reads; one outside is refused by name; one
// whose arguments are not data is refused with the reason); that the grammar text is the intent grammar narrowed to the
// allows and loads as rules; that the ticket's hash is the ladder's `allowsSha`; that a step with no allows has no grammar
// (one sentence); that the mind grammar exists only when a step allows a verb a mind may choose. Refuses: a mock of the
// grammar; the rules are loaded by lacuna-scheme's own grammar reader.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_S, LINE_GBNF, stepGrammar } from '../grammar-step.mjs'
import { allowsSha, loadLadder } from '../ladder.mjs'
import { mindable } from '../grammar.mjs'
import { VERBS } from '../capabilities.mjs'

const disk1 = loadLadder('DISK').steps[0]   // (allows disk disk-eaters jobs), budget s 120

// spec: D1 "a mind cannot emit a call outside its step" · class: E · technique: the DISK ladder's first step · method: in, out, not data
test('a step\'s grammar accepts a call inside its allows and refuses one outside it or with arguments that are not data', () => {
  const g = stepGrammar(disk1)
  assert.deepEqual([g.step, g.allows], [1, ['disk', 'disk-eaters', 'jobs']])
  assert.deepEqual(g.readCall('disk', {}), { ok: true })
  assert.deepEqual(g.readCall('jobs', { limit: 5 }), { ok: true })
  assert.deepEqual(g.readCall('disk-eaters', ['~/.lacuna', 3]), { ok: true })
  assert.deepEqual(g.readCall('shell', { cmd: 'rm -rf ~' }), { ok: false, why: "shell is outside step 1's allows (disk disk-eaters jobs)" })
  assert.equal(g.readCall(undefined, {}).ok, false)
  const cyclic = {}; cyclic.self = cyclic
  const r = g.readCall('disk', cyclic)
  assert.equal(r.ok, false); assert.match(r.why, /not data|does not fit/)
  assert.ok(Object.isFrozen(g))
})

// spec: "one grammar text, three enforcers" · class: E · technique: read the text · method: it names only the allows and the deadline
test('the grammar text is the intent grammar narrowed to the step\'s allows and its deadline; it loads as rules', () => {
  const g = stepGrammar(disk1)
  assert.ok(typeof g.text === 'string' && g.text.length > LINE_GBNF.length)
  const toolRule = g.text.split('\n').find((l) => /^tool\s*::=/.test(l))
  assert.equal(toolRule, 'tool      ::= "\\"disk\\"" | "\\"disk-eaters\\"" | "\\"jobs\\""', 'the tool rule names the allows and nothing else')
  assert.ok(!g.text.includes('shell') && !g.text.includes('patch'))
  const noBudget = stepGrammar({ n: 9, allows: ['disk'] })
  assert.equal(noBudget.text, stepGrammar({ n: 9, allows: ['disk'], budget: { s: DEFAULT_S } }).text, 'no budget decodes with the default deadline')
  assert.notEqual(noBudget.text, stepGrammar({ n: 9, allows: ['disk'], budget: { s: 7 } }).text, 'the deadline is in the grammar')
  assert.ok(g.rules && typeof g.rules === 'object')
})

// spec: the ticket carries the allows' hash · class: E · method: the same function, the same bytes
test('the step\'s sha is the ladder\'s allowsSha over the allows in ladder order', () => {
  const g = stepGrammar(disk1)
  assert.equal(g.sha, allowsSha(['disk', 'disk-eaters', 'jobs']))
  assert.notEqual(g.sha, stepGrammar({ n: 1, allows: ['jobs', 'disk', 'disk-eaters'] }).sha)
})

// spec: "Refuses: a step with no allows" · class: E · method: the sentence
test('a step with no allows has no grammar: one sentence names the step', () => {
  assert.throws(() => stepGrammar({ n: 4, allows: [] }), /step 4 allows nothing: there is no grammar to decode under/)
  assert.throws(() => stepGrammar({ n: 5 }), /step 5 allows nothing/)
})

// spec: the mind grammar for the worker verbs a step allows · class: E · technique: reads only vs a mindable verb · method: null or a grammar
test('the mind grammar exists only when a step allows a verb a mind may choose', () => {
  assert.equal(stepGrammar(disk1).mind, disk1.allows.some(mindable) ? stepGrammar(disk1).mind : null)
  assert.equal(stepGrammar(disk1).mind, null, 'the DISK reads are hands, not verbs a mind chooses')
  const verb = VERBS.map((v) => v.name).find(mindable)
  assert.ok(verb, 'the verb table holds a verb a mind may choose')
  const g = stepGrammar({ n: 2, allows: ['disk', verb], budget: { s: 30 } })
  assert.equal(typeof g.mind, 'string')
  assert.ok(g.mind.includes(verb))
  assert.deepEqual(g.readCall(verb, []).ok, true)
})
