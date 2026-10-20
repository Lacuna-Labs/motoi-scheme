// scratch/verify-http.mjs — one-shot smoke test to prove the http/serve
// verb actually serves via a real browser-style HTTP client. Run:
//   node scratch/verify-http.mjs
// Prints the landing page's <h1> line + the play endpoint's status.

import { makeCoreEnv } from '../core/index.js'
import { Sym } from '../src/reader.js'
import { get } from 'node:http'

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
console.log('bound port:', record.port)

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const r = get(`http://127.0.0.1:${record.port}${path}`, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    r.on('error', reject)
  })
}

const landing = await httpGet('/')
console.log('\n=== GET / (status:', landing.status, ') ===')
// Just show a few key lines.
const lines = landing.body.split('\n').slice(0, 30)
console.log(lines.join('\n'))

const play = await httpGet('/play/composer%2Fsynth-patch')
console.log('\n=== GET /play/composer/synth-patch (status:', play.status, ') ===')
console.log(play.body.split('\n').slice(0, 10).join('\n'))

stop(record)
console.log('\n[stopped]')
