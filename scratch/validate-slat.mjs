// scratch/validate-slat.mjs — validate reference/book .slat files with the REAL
// Motoi reader (src/reader.js parse), which handles multi-line forms + strings.
// Usage: node scratch/validate-slat.mjs <file> [<file> ...]
// Prints one line per file: OK <n-forms>  |  FAIL <error> (@line)
import { parse } from '../src/reader.js'
import { readFile } from 'node:fs/promises'

let anyFail = false
for (const path of process.argv.slice(2)) {
  let src
  try { src = await readFile(path, 'utf8') } catch (e) { console.log(`MISSING ${path}`); anyFail = true; continue }
  try {
    const forms = parse(src)
    const n = Array.isArray(forms) ? forms.length : 1
    console.log(`OK   ${n}\t${path}`)
  } catch (e) {
    anyFail = true
    console.log(`FAIL ${e.message}\t${path}`)
  }
}
process.exit(anyFail ? 1 : 0)
