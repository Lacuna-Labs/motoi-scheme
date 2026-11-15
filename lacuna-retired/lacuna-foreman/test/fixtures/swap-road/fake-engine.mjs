// fake-engine.mjs — A STAND-IN FOR `lme serve` ON A UNIX SOCKET (swap-road.test.mjs, broker-swap.test.mjs). Owns: the four
// forms the swap road and the broker send — `(health)`, `(status)`, `(drain)`, and the refusal of a `gen` while draining —
// answered as server.cpp answers them; the drain's lame duck (exit 0 once no turn runs, the socket removed); SIGTERM as a
// clean stop. Refuses: a `gen` (it is not an engine: `(error … (msg "F-LME-draining: …"))` while draining, else an error
// naming itself). Implements: the forms of lme/src/serve/server.cpp at b5337d4a (read only). Invariants: none. Faults: none.
// Usage: node fake-engine.mjs <socket> <model basename> <profile> [busy polls]
import fs from 'node:fs'
import net from 'node:net'

const [sock, model, profile = 'desk', busyPolls = '0'] = process.argv.slice(2)
if (!sock) process.exit(0)   // `node --test` runs every file under test/: with no socket there is nothing to serve
let busy = Number(busyPolls) > 0 ? 1 : 0
let polls = Number(busyPolls)
let draining = false
const t0 = Date.now()
const leave = () => { try { fs.unlinkSync(sock) } catch { /* gone already */ } process.exit(0) }
process.on('SIGTERM', leave)
try { fs.unlinkSync(sock) } catch { /* a fresh path */ }
const server = net.createServer((c) => {
  let buf = ''
  c.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 1)
      if (process.env.FAKE_ENGINE_LOG) fs.appendFileSync(process.env.FAKE_ENGINE_LOG, line + '\n')   // what the engine was sent
      const id = line.match(/\(id "([^"]*)"\)/)?.[1] ?? '-'
      if (busy && --polls <= 0) busy = 0
      if (line.startsWith('(health')) c.write(`(ok (id "${id}") (engine lme) (model "${model}") (slots 2) (held "0 0") (busy ${busy}) (served 0) (failed 0))\n`)
      else if (line.startsWith('(status')) c.write(`(ok (id "${id}") (engine lme) (model "${model}") (profile "${profile}") (qos "user-initiated") (slots 2) (held "0 0") (busy ${busy}) (served 0) (failed 0) (draining ${draining ? '#t' : '#f'}) (uptime-s ${Math.round((Date.now() - t0) / 1000)}))\n`)
      else if (line.startsWith('(drain')) { draining = true; c.write(`(ok (id "${id}") (draining #t) (busy ${busy}))\n`) }
      else c.write(`(error (id "${id}") (msg "${draining ? 'F-LME-draining: the engine is draining; send the request to its successor' : 'fake-engine: no gen here'}"))\n`)
    }
  })
  c.on('error', () => { /* the asker hung up */ })
})
server.listen(sock, () => fs.chmodSync(sock, 0o600))
// the drain's lame duck: once draining and idle, the engine stops (server.cpp stop_if_drained)
setInterval(() => { if (draining && !busy) leave() }, 50)
