#!/usr/bin/env node
// A CART'S TRIAL WITH LIVE MINDS (B50) — owns a dry run of a cart in a scratch supervisor in THIS process: only its minds are real, each rung asked
//   through Lacuna's door (/api/foreman/mind, with the foreman's token), one at a time; its hand is answered from a file of lines.
//   node trial-live.mjs <cart.sks> <lines-file> [--shadow]   → each distinct line's label, the rungs climbed, the cart's own summary.
// Refuses: spawning on the foreman; setting timers; sending a report up; a record of its own — the cascade's records are kept by Lacuna
//   (~/lacuna-world/cascade/), as in a live run.
// Implements: design §12 (carts proven before a press), §10; keeps LACUNA-1.3-DESIGN §40 (B50) as history.
// Invariants (§18): none written here; a person (or the owner's exam) sees what a cart's minds say before a press.
// Faults (§16): none by id.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { brainOver } from './cascade.mjs'
import { Supervisor } from './supervisor.mjs'

const [cartFile, linesFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const SHADOW = process.argv.includes('--shadow')
if (!cartFile || !linesFile) { console.error('node trial-live.mjs <cart.sks> <lines-file> [--shadow]'); process.exit(2) }
const LACUNA = process.env.LACUNA_URL || 'http://127.0.0.1:1138'
const TOKEN = fs.readFileSync(path.join(os.homedir(), '.lacuna', 'foreman-token'), 'utf8').trim()
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }
const tables = { tiers: read(path.join(os.homedir(), 'lacuna-world', 'bench', 'agents', 'tiers.json')),
                 box: brainOver(read(new URL('../../lacuna-box/brain/box-minds.json', import.meta.url)), read(path.join(os.homedir(), '.lacuna', 'brain-profile.json'))) }

const post = async (url, body, ms) => {
  const r = await fetch(`${LACUNA}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Foreman-Token': TOKEN },
                                             body: JSON.stringify(body), signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`${url} answered ${r.status}`)
  return r.json()
}
const climbs = []
const said = []
const host = {
  now: () => Date.now() / 1000, id: () => 'trial-live', save: () => {}, trial: true, tables: () => tables, shadow: SHADOW,
  upstream: (kind, w, data) => { if (kind === 'report') said.push(data) },
  mind: async (req) => {
    const d = await post('/api/foreman/mind', { model: req.model, grammar: req.grammar, system: req.system, prompt: req.prompt, job: req.job,
                                                cascade: !!req.cascade, last: !!req.last, shadow: !!req.shadow }, req.last ? 300_000 : 60_000)
    if (!d.ok) throw new Error(d.why || 'no answer')
    return { text: d.text || '', certainty: d.certainty ?? null, box: d.box || null }
  },
  cascade: (kind, rec) => {
    if (kind === 'escalation') climbs.push(rec)
    post('/api/foreman/cascade', { kind, record: rec }, 5000).catch((e) => console.error('not kept:', e.message))
  },
}

const sup = new Supervisor(host)
// what each line was finally labeled, as the cart heard it (its (on 'mind …) handler)
const heard = new Map()
const send = sup.send.bind(sup)
sup.send = (id, kind, v, o) => {
  if (kind === 'mind') heard.set(String(v.of.line), v.ok ? String(v.label && v.label.name ? v.label.name : v.label) : 'unread')
  return send(id, kind, v, o)
}
const w = sup.spawn({ name: 'trial-live', program: fs.readFileSync(cartFile, 'utf8') })
if (w.state !== 'running') { console.error('it did not load:', w.last); process.exit(1) }
for (const [j, m] of Object.entries(w.cart?.minds || {})) console.log(`mind ${j}: ${m.job} · rungs ${m.rungs.join(' → ')}${SHADOW ? ' · shadow' : ''}`)
const lines = fs.readFileSync(linesFile, 'utf8').split('\n').filter((l) => l.trim())
const t0 = Date.now()
sup.send(w.id, 'hand', { ok: true, result: { lines } })
await sup.settle()
console.log(`\n${lines.length} lines, ${new Set(lines).size} distinct · ${climbs.length} climbed · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
for (const c of climbs) {
  console.log(`- ${String(c.input.line).slice(0, 90)}`)
  console.log(`    ${c.rungs.map((r) => `${r.model} ${r.answer ?? '—'} (${r.certainty ?? '?'}, ${r.ms} ms)${r.climbed ? ` ↑ ${r.climbed}` : ''}`).join('\n    ')}`)
  console.log(`    → ${c.accepted_by || 'no rung held'}: ${c.accepted ?? 'unread'}`)
}
const summary = said.find((r) => r.kind === 'summary')
console.log(`\nthe cart says: ${summary ? summary.data[0] : w.cart?.said || '(no summary)'}`)   // a plain program has no cart (U3, 2026-10-24: it threw here)
const tally = {}
for (const v of heard.values()) tally[v] = (tally[v] || 0) + 1
console.log(`labels heard: ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(' · ')}`)
const traces = [...heard.keys()].filter((l) => /Traceback \(most recent call last\)|^\s*([A-Za-z_][\w.]*)?(Error|Exception)\b/.test(l))
for (const l of traces) console.log(`  ${heard.get(l).padEnd(11)} ${l.slice(0, 100)}`)
console.log(`traceback/exception lines: ${traces.length} · came back as noise: ${traces.filter((l) => heard.get(l) === 'noise').length}`)
for (const id of sup.workers.keys()) sup.stop(id, 'trial over')
