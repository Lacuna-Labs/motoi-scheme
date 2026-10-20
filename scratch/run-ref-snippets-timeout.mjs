// scratch/run-ref-snippets-timeout.mjs
// Run specific snippet index ranges with a HARD per-snippet wall-clock
// timeout (via worker thread), to catch non-terminating snippets that
// escape the fuel budget. Usage: node ... <start> <count> [timeoutMs]
// Prints HANG/FAIL lines to stdout.

import { readFile } from 'node:fs/promises'
import { Worker } from 'node:worker_threads'

const start = parseInt(process.argv[2] || '0', 10)
const count = parseInt(process.argv[3] || '200', 10)
const TIMEOUT = parseInt(process.argv[4] || '4000', 10)

const raw = await readFile('/tmp/motoi-ref-allcode.jsonl', 'utf8')
const all = raw.split('\n').filter(Boolean).map(l => JSON.parse(l))
const slice = all.slice(start, start + count)

const workerSrc = `
import { parentPort } from 'node:worker_threads'
import { parse } from '${new URL('../src/reader.js', import.meta.url).href}'
import { evaluate } from '${new URL('../src/interp.js', import.meta.url).href}'
import { makeCoreEnv } from '${new URL('../core/index.js', import.meta.url).href}'
import { expandProgram } from '${new URL('../src/macro.js', import.meta.url).href}'
parentPort.on('message', (src) => {
  const realWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = () => true
  try {
    const env = makeCoreEnv({ fuel: { n: 200000 } })
    const { forms } = expandProgram(parse(src), { fuel: { n: 200000 } })
    const fuel = { n: 200000 }
    for (const f of forms) evaluate(f, env, fuel)
    process.stdout.write = realWrite
    parentPort.postMessage({ ok: true })
  } catch (e) {
    process.stdout.write = realWrite
    parentPort.postMessage({ ok: false, error: (e && e.message) || String(e) })
  }
})
`
const workerUrl = 'data:text/javascript,' + encodeURIComponent(workerSrc)

function runOne(src) {
  return new Promise((resolve) => {
    const w = new Worker(new URL(workerUrl), { type: 'module' })
    const timer = setTimeout(() => { w.terminate(); resolve({ hang: true }) }, TIMEOUT)
    w.once('message', (m) => { clearTimeout(timer); w.terminate(); resolve(m) })
    w.once('error', (e) => { clearTimeout(timer); w.terminate(); resolve({ ok: false, error: String(e && e.message || e) }) })
    w.postMessage(src)
  })
}

let pass = 0, fail = 0, hang = 0
for (let i = 0; i < slice.length; i++) {
  const it = slice[i]
  const r = await runOne(it.code)
  if (r.hang) { hang++; console.log(`HANG idx=${start + i} [${it.chapter} ${it.verb} ${it.field}] :: ${it.code.slice(0, 90).replace(/\n/g, ' ')}`) }
  else if (r.ok) pass++
  else fail++
}
process.stderr.write(`range ${start}..${start + count}  PASS ${pass} FAIL ${fail} HANG ${hang}\n`)
