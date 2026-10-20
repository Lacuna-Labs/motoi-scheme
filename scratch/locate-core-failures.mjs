// Reader-based, correctly-attributed failure map for one chapter.
// For every program-bearing string slot, run it through ./bin/motoi and record
// verb :name + the key it sits under + tier + pass/fail + first error line.
import { parse, Sym } from '../src/reader.js'
import fs from 'fs'
import { execFileSync } from 'child_process'

const FILE = process.argv[2] || 'scheme/reference/01-core.slat'
const isKw = (x) => x instanceof Sym && x.name.startsWith(':')
const isProgKey = (n) => /(?:code|program|composition)$/.test(n.replace(/^:/, ''))
const isNull = (s) => typeof s === 'string' && (s.trimStart().startsWith(';; honest-null') || /honest-null/.test(s.slice(0, 40)))

const kv = (form, key) => {
  if (!Array.isArray(form)) return undefined
  for (let i = 0; i < form.length; i++) if (isKw(form[i]) && form[i].name === key) return form[i + 1]
  return undefined
}

function run(code) {
  try {
    execFileSync('./bin/motoi', ['run', '/dev/stdin'], { input: code, timeout: 25000, stdio: ['pipe', 'pipe', 'pipe'] })
    return null
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).toString().trim()
    return out.split('\n').find((l) => /error/i.test(l)) || out.split('\n')[0] || 'FAIL'
  }
}

const forms = parse(fs.readFileSync(FILE, 'utf8'))
const fails = []
let n = 0
for (const f of forms) {
  if (!(Array.isArray(f) && f[0] instanceof Sym && f[0].name === 'verb')) continue
  const name = kv(f, ':name')
  // walk, tracking the key each program string sits under, plus nearest :tier
  const walk = (node, tier) => {
    if (!Array.isArray(node)) return
    let localTier = tier
    for (let i = 0; i < node.length; i++) {
      if (isKw(node[i]) && node[i].name === ':tier' && typeof node[i + 1] === 'string') localTier = node[i + 1]
    }
    for (let i = 0; i < node.length; i++) {
      const k = node[i]
      if (isKw(k) && isProgKey(k.name) && typeof node[i + 1] === 'string' && !isNull(node[i + 1])) {
        n++
        const code = node[i + 1]
        const err = run(code)
        if (err) fails.push({ name, key: k.name, tier: localTier, code, err })
      }
      if (Array.isArray(node[i])) walk(node[i], localTier)
    }
  }
  walk(f, '?')
}
console.log(`ran ${n} real program slots in ${FILE}; FAIL=${fails.length}`)
for (const x of fails) console.log(`\n[${x.name}] key=${x.key} tier=${x.tier}\n  ERR: ${x.err}\n  CODE: ${JSON.stringify(x.code.slice(0, 200))}`)
fs.writeFileSync('scratch/core-failures-located.json', JSON.stringify(fails, null, 1))
