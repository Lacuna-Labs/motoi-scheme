// scratch/serve-long.mjs — start the composer HTTP server and keep it
// running until SIGTERM. Prints the bound port so a shell script can
// hit it with curl.

import { makeCoreEnv } from '../core/index.js'
import { Sym } from '../src/reader.js'

const env = makeCoreEnv()
const serve = env.get('http/serve')
const waitReady = env.get('http/wait-until-ready')
const stop = env.get('http/stop')

const record = serve(
  new Sym(':port'), 0,
  new Sym(':cart-dir'), 'carts',
  new Sym(':compose-perm'), new Sym('local-only')
)
await waitReady(record)
console.log(`PORT=${record.port}`)

// Keep alive.
process.on('SIGTERM', () => { stop(record); process.exit(0) })
process.on('SIGINT', () => { stop(record); process.exit(0) })
setInterval(() => {}, 60_000)
