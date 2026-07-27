// cortex-roundtrip.mjs — proves RAG persistence round-trips across sessions.
//
// The concrete guarantee Alfred asked for: the copilot must "remember what it
// did / if it did the right thing" BETWEEN sessions, not just in-memory. This
// test drives the real Copilot pipeline (suggest -> accept -> salt), then
// throws that Copilot away and builds a FRESH one. The second copilot hydrates
// from the ONE cortex.slatl and must see the graded trace, the salted skill,
// and the person profile the first one wrote.
//
// Confinement is proven too: MOTOI_HOME points at a throwaway temp dir, so the
// real ~/motoi/copilot/cortex.slatl is never touched. Run:
//   node motoi-copilot/test/cortex-roundtrip.mjs

import assert from 'node:assert'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// MUST be set before importing anything that resolves the cortex path — cortex.js
// captures PATH at module load. This redirects the whole user tree to a temp dir.
const home = mkdtempSync(join(tmpdir(), 'motoi-roundtrip-'))
process.env.MOTOI_HOME = home

let pass = 0, fail = 0
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}`) }
}
function section(t) { console.log(`\n${t}`) }

// Dynamic import AFTER MOTOI_HOME is set.
const { Copilot, RegistryOracle } = await import('../index.js')
const { userCortexSlatlPath } = await import('../../src/paths.js')
const { cortexReadRecords } = await import('../../lib/ai/cortex.js')
const { configure, resetBackends } = await import('../src/model-client.js')

const cortexFile = userCortexSlatlPath()
ok('cortex path is under the temp MOTOI_HOME (confined)', cortexFile.startsWith(home))

// A minimal local backend that fills the hole with a runnable middle. The middle
// shares a token with the situation ("display") so it clears the relevance floor,
// and (display display) runs — a real, gate-passing, floor-passing candidate so
// accept() can crystallize it into a salted skill, exercising the full persist path.
configure({ local: { complete: () => ['display'] } })

const oracle = new RegistryOracle()
const PERSON = 'alfred-roundtrip'

section('Session 1 — suggest, accept, and persist')
let traceId, skillKey
{
  const cp = new Copilot({ oracle }) // persist defaults on
  const pos = { text: '(display )', offset: 9 } // hole between "(display " and ")"
  // allowSilence:false forces the runnable candidate to win over NONE so we get
  // a salted skill to round-trip (cold-start default is to stay silent).
  const sug = await cp.suggest(pos, { n: 5, person: PERSON, allowSilence: false })
  ok('session-1 produced a traceId', typeof sug.traceId === 'string')
  ok('session-1 offered a runnable candidate', sug.offer !== null && sug.confidence === 'verified')
  traceId = sug.traceId

  // Accept the suggestion — grades the trace as preferred + salts a skill.
  // accept() returns the salted skill record itself.
  const skill = cp.accept(traceId, { register: 'terse' })
  skillKey = skill?.key ?? null
  ok('session-1 accept salted a skill', typeof skillKey === 'string')

  // The trace, skill, and profile must be on disk now.
  ok('cortex file was written', existsSync(cortexFile))
  const recs = cortexReadRecords()
  ok('trace persisted', recs.some((r) => r.id === traceId && r.kind === ':reasoning-trace'))
  ok('skill persisted', recs.some((r) => r.key === skillKey && r.kind === ':reasoning-skill'))
  ok('person profile persisted', recs.some((r) => r.key === `person:${PERSON}` && r.kind === ':person-profile'))

  // No personal-data leak: only reasoning kinds live in this file.
  const kinds = new Set(recs.map((r) => r.kind))
  ok('only reasoning kinds persisted (no :memory leak)',
    [...kinds].every((k) => k === ':reasoning-trace' || k === ':reasoning-skill' || k === ':person-profile'))
}

section('Session 2 — a FRESH copilot hydrates the prior session')
{
  const cp2 = new Copilot({ oracle }) // fresh in-memory store, hydrates from disk
  ok('session-2 hydrated the graded trace', cp2.store.traces.has(traceId))
  ok('session-2 hydrated the salted skill', cp2.store.skills.has(skillKey))
  ok('session-2 hydrated the person profile', cp2.store.profiles.has(`person:${PERSON}`))

  // "Did it do the right thing?" — the hydrated trace carries its human verdict.
  const trace = cp2.store.traces.get(traceId)
  ok('hydrated trace remembers the accept verdict',
    !!(trace && trace.data && trace.data.gradePref && trace.data.gradePref.humanChosen))

  // The hydrated skill is callable-shaped (has the move + verify tag).
  const skill = cp2.store.skills.get(skillKey)
  ok('hydrated skill keeps its verify contract', skill?.data?.verify === ':motoi-run-passes')
}

section('Confinement — nothing escaped the temp home')
{
  const raw = readFileSync(cortexFile, 'utf8')
  ok('cortex file has content', raw.length > 0)
  const dataLines = raw.split('\n').filter((l) => l.trim() && !l.trimStart().startsWith(';;'))
  ok('every non-comment line is a cortex form',
    dataLines.length > 0 && dataLines.every((l) => l.trimStart().startsWith('(cortex-')))
}

resetBackends()
rmSync(home, { recursive: true, force: true })

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
