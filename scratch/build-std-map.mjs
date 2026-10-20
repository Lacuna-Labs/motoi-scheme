// scratch/build-std-map.mjs — build a deterministic verb -> standard map from
// the wired parts registry. Every verb a part declares (SRFI-1/13/27/125,
// R7RS-completions-core) is stamped with that part's STD constant. Verbs wired
// in src/base.js (the R7RS-small core) are stamped R7RS-small. Everything else
// wired but not in a standard part is Motoi-own console stdlib -> "Motoi".
// Emits scratch/std-map.json  { verb: "SRFI-1" | "R7RS-small" | "Motoi" | ... }
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const map = {}
const parts = ['srfi-1', 'srfi-13', 'srfi-27', 'srfi-125', 'r7rs-completions-core']
for (const p of parts) {
  const mod = await import(resolve(ROOT, 'lib/std', p + '.js'))
  const std = mod.STD || p
  for (const v of (mod.VERBS || [])) if (!(v in map)) map[v] = std
}

// R7RS-small core primitives + forms wired in src/base.js and the interpreter.
// Harvest def('name'... ) and defmacro/keyword names from base.js.
const base = await readFile(resolve(ROOT, 'src/base.js'), 'utf8')
for (const m of base.matchAll(/\bdef\(\s*'([^']+)'/g)) {
  if (!(m[1] in map)) map[m[1]] = 'R7RS-small'
}

await writeFile(resolve(ROOT, 'scratch/std-map.json'), JSON.stringify(map, null, 0))
const counts = {}
for (const v of Object.values(map)) counts[v] = (counts[v] || 0) + 1
console.log('verbs mapped:', Object.keys(map).length)
console.log(counts)
