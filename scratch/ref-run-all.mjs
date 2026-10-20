// scratch/ref-run-all.mjs — run every runnable reference program through ./bin/motoi
// and report failures grouped by chapter file. Uses the reader (src/reader.js) to
// extract program slots exactly as the interpreter sees them.
import { parse, Sym } from '../src/reader.js'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const isKw = (x) => x instanceof Sym && x.name.startsWith(':')
const isProgramKey = (n) => /(?:code|program|composition)$/.test(n.replace(/^:/, ''))
const isNull = (s) => typeof s === 'string' &&
  (s.trimStart().startsWith(';; honest-null') || /honest-null/.test(s.slice(0, 40)))
function walk(node, file, sink) {
  if (!Array.isArray(node)) return
  for (let i = 0; i < node.length; i++) {
    const k = node[i]
    if (isKw(k) && isProgramKey(k.name) && typeof node[i + 1] === 'string' && !isNull(node[i + 1])) {
      sink.push({ file, idx: sink.length, src: node[i + 1] })
    }
    if (Array.isArray(node[i])) walk(node[i], file, sink)
  }
}

const REF = 'scheme/reference'
const dir = mkdtempSync(join(tmpdir(), 'refrun-'))
const tmp = join(dir, 'p.scm')
const byFile = {}
const fails = []
const files = readdirSync(REF).filter((f) => f.endsWith('.slat')).sort()
for (const f of files) {
  let forms
  try { forms = parse(readFileSync(join(REF, f), 'utf8')) } catch (e) {
    byFile[f] = { total: 0, fail: 1, parseError: String(e.message).slice(0, 120) }
    continue
  }
  const sink = []
  for (const form of forms) walk(form, f, sink)
  let fail = 0
  for (const p of sink) {
    writeFileSync(tmp, p.src)
    try {
      execFileSync('./bin/motoi', ['run', tmp, '--fuel', '5000000'], { stdio: 'pipe', timeout: 30000 })
    } catch (e) {
      fail++
      const out = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
      const msg = (out.split('\n').find((l) => /error|Cannot use/i.test(l)) || out.split('\n')[0] || '').trim().slice(0, 140)
      fails.push({ file: f, idx: p.idx, msg })
    }
  }
  byFile[f] = { total: sink.length, fail }
}
writeFileSync('scratch/ref-run-all.json', JSON.stringify({ byFile, fails }, null, 0))
const failFiles = Object.entries(byFile).filter(([, v]) => v.fail > 0)
console.error(`chapters: ${files.length}   chapters-with-fails: ${failFiles.length}   total-fails: ${fails.length}`)
for (const [f, v] of failFiles) console.error(`  ${f}: ${v.fail}/${v.total}${v.parseError ? '  PARSE: ' + v.parseError : ''}`)
