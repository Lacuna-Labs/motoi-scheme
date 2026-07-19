// tests/tui/ide-server-wave-2.test.mjs — Wave 2 IDE endpoints.
//
// Provenance: 2026-07-19 (Marcus). Verifies the new endpoints the
// browser IDE relies on for pair mode, ambient completions, explain,
// and reading state.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, unlinkSync } from 'node:fs'
import { startIdeServer } from '../../src/ide-server.js'
import { READING_STATE_PATH, _resetSharedStateForTests } from '../../lib/system/reading-state.js'

function cleanState() {
  _resetSharedStateForTests()
  try { if (existsSync(READING_STATE_PATH)) unlinkSync(READING_STATE_PATH) } catch { /* fine */ }
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts)
  return r.json()
}

test('IDE server — pair mode: on → user-drives, state reflects it', async () => {
  cleanState()
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    const set = await fetchJson(url + 'api/pair/mode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'user-drives' }),
    })
    assert.equal(set.ok, true)
    const stateResp = await fetchJson(url + 'api/pair/state')
    assert.equal(stateResp.ok, true)
    assert.equal(stateResp.state.mode, 'user-drives')
  } finally {
    server.close()
  }
})

test('IDE server — /api/pair/explain returns [motoi] paragraph', async () => {
  cleanState()
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    const r = await fetchJson(url + 'api/pair/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '(define x 5)' }),
    })
    assert.equal(r.ok, true)
    assert.match(String(r.value), /motoi/)
  } finally {
    server.close()
  }
})

test('IDE server — /api/pair/complete returns candidates for vec/', async () => {
  cleanState()
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    const r = await fetchJson(url + 'api/pair/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: 'vec/' }),
    })
    assert.equal(r.ok, true)
    assert.match(String(r.value), /vec\//)
  } finally {
    server.close()
  }
})

test('IDE server — /api/reading-state returns snapshot alist', async () => {
  cleanState()
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    // Seed some state via evaluation.
    await fetchJson(url + 'api/eval', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '(motoi/mark-read! "code" 6 (quote intro))' }),
    })
    const r = await fetchJson(url + 'api/reading-state')
    assert.equal(r.ok, true)
    assert.ok(r.state)
    assert.ok(Array.isArray(r.state.chapters))
  } finally {
    server.close()
    cleanState()
  }
})

test('IDE server — /api/reading-progress with total returns read + total', async () => {
  cleanState()
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    await fetchJson(url + 'api/eval', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '(motoi/mark-read! "code" 6 (quote a))' }),
    })
    const r = await fetchJson(url + 'api/reading-progress?book=code&n=6&total=5')
    assert.equal(r.ok, true)
    assert.equal(r.progress.read, 1)
    assert.equal(r.progress.total, 5)
  } finally {
    server.close()
    cleanState()
  }
})

test('IDE server — /api/bookmark round-trips through eval', async () => {
  cleanState()
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    const r = await fetchJson(url + 'api/bookmark', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-mark', context: 'ml/12' }),
    })
    assert.equal(r.ok, true)
    // Now list them
    const list = await fetchJson(url + 'api/eval', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '(motoi/bookmarks)' }),
    })
    assert.match(String(list.value), /test-mark/)
  } finally {
    server.close()
    cleanState()
  }
})

test('IDE server — static assets: index.html + ide.css + ide.js all serve', async () => {
  const { server, url } = await startIdeServer({ port: 0, silent: true })
  try {
    const html = await (await fetch(url)).text()
    assert.match(html, /Motoi Scheme/)
    assert.match(html, /btn-explain/)
    assert.match(html, /btn-pair-toggle/)
    const css = await (await fetch(url + 'ide.css')).text()
    assert.match(css, /motoi-ghost/)
    const js = await (await fetch(url + 'ide.js')).text()
    assert.match(js, /setPairMode/)
    assert.match(js, /explainSelection/)
  } finally {
    server.close()
  }
})
