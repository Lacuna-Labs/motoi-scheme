// one-upstream.test.mjs — the foreman reads Lacuna Scheme from the one upstream, `lacuna-scheme/src`, and from nowhere else
// (postmortem 2026-10-30 "the fork that broke the one-upstream rule"; ROAD-TO-1.0 category 4, "Also decided for 1.0").
// owns: the guard against a second copy of the engine inside the foreman. refuses: to mock scheme.mjs.
// implements: LACUNA-3.0-WORK-ORDER §2 (one upstream; Sakura inherits it back). invariants: "one engine, one reader".
// faults: none.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sym, parse } from '../scheme.mjs'
import { Sym as UpstreamSym, Pair as UpstreamPair } from '../../../lacuna-scheme/src/reader.js'

const FOREMAN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Every .mjs and .js under the foreman, without node_modules. */
function sources(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...sources(p))
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p)
  }
  return out
}

// spec: ROAD-TO-1.0 category 4 (one upstream) · postmortem 2026-10-30 (the fork)
// class: a second copy of a dependency (two Sym classes in one process: instanceof false across them)
// technique: identity of the classes the foreman hands out; a scan of every import the foreman's sources make
// method: scheme.mjs's Sym is the upstream reader's Sym, and a parsed list's symbols are upstream instances; no source imports a
//         Scheme module by a path outside ../lacuna-scheme/src; no engine file (reader, interp, core) lives in the foreman
// sre: could the foreman drift onto a private copy of the engine again without a red test?
test('the foreman reads Lacuna Scheme from lacuna-scheme/src only: one Sym class, no private copy', () => {
  assert.equal(Sym, UpstreamSym)
  const [form] = parse('(a b)')
  assert.ok(form[0] instanceof UpstreamSym)
  assert.equal({ car: 1, cdr: 2 } instanceof UpstreamPair, false, 'a plain object is not a Pair (no duck-typed instanceof)')
  const stray = []
  for (const f of sources(FOREMAN)) {
    const text = fs.readFileSync(f, 'utf8')
    for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1]
      if (!spec.startsWith('.')) continue
      const to = path.resolve(path.dirname(f), spec)
      const rel = path.relative(FOREMAN, to)
      if (/(^|\/)(reader|interp|core|macro|dispatch)\.js$/.test(rel) && !rel.startsWith(`..${path.sep}lacuna-scheme${path.sep}src`)) stray.push(`${path.relative(FOREMAN, f)} → ${spec}`)
    }
  }
  assert.deepEqual(stray, [])
  assert.equal(fs.existsSync(path.join(FOREMAN, 'scheme')), false, 'lacuna-foreman/scheme/ is gone')
})
