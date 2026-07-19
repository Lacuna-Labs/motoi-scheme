// mock-server.mjs — tiny OpenAI-compatible mock server for LLM tests.
//
// Launched as a child process by tests/llm/llm.test.js so the parent
// test can make synchronous curl calls (via execFileSync) without
// deadlocking on itself.
//
// Argv: <port>
// Emits: JSON on stdout in the shape { port, pid } once ready.

import { createServer } from 'node:http'

const port = Number(process.argv[2] || 0)

const server = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    let payload = {}
    try { payload = JSON.parse(body) } catch { /* ignore */ }
    res.setHeader('content-type', 'application/json')
    if (req.url && req.url.includes('/embeddings')) {
      res.end(JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }],
      }))
      return
    }
    // Default: chat completions echo. Also echo any system role so tests
    // can assert on the persona-context prefix that (copilot/ask) prepends.
    const msgs = Array.isArray(payload?.messages) ? payload.messages : []
    const userMsg = msgs.slice(-1)[0]?.content || '(no prompt)'
    const systemMsg = msgs.find((m) => m?.role === 'system')?.content || ''
    // The "MOCK:" prefix preserves back-compat with earlier tests; a
    // "SYSTEM:" suffix carries the first ~200 chars of the system prompt
    // so copilot/ask can be verified end-to-end.
    const systemTail = systemMsg ? `\nSYSTEM: ${systemMsg.slice(0, 200)}` : ''
    res.end(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: `MOCK: ${userMsg.slice(0, 200)}${systemTail}`,
        },
      }],
    }))
  })
})

server.listen(port, '127.0.0.1', () => {
  const actual = server.address().port
  // Emit ready line so the parent knows the port.
  process.stdout.write(JSON.stringify({ port: actual, pid: process.pid }) + '\n')
})

// Exit cleanly on SIGTERM/SIGINT.
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
