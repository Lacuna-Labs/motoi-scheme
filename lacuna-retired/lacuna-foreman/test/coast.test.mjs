// coast.test.mjs — unit tests for `coast.mjs`, the "is the coast clear" reading (MINDS §4.6).
// owns: the proofs that ours and theirs are told apart, that the three levels fall from the lines, that the sentry's
//   sentence names the heaviest outsider with units, that the slat form reads back, that a stale reading is re-read.
// refuses: to run ps on the box inside a test (text is injected; one test runs the real commands and asserts only shape).
// implements: MINDS §4.6; SENTRY §2.5. invariants: "if the desk stepped down, then a coast row said why". faults: F-C1.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoast, sentrySays, coastSlat, coast, COAST } from '../coast.mjs'
import { parse } from '../scheme.mjs'

const GB = 1073741824, TOTAL = 32 * GB
const vm = (freePages) => `Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: ${freePages}.\nPages active: 100000.\nPages inactive: 0.\nPages speculative: 0.\nPages wired down: 1600000.\n`
const PS_HEAD = '  PID %CPU    RSS COMMAND\n'
const row = (pid, cpu, mb, cmd) => `${pid} ${cpu} ${mb * 1024} ${cmd}\n`
const OURS = row(1, 80, 17000, '/opt/homebrew/bin/llama-server -m x --port 8091') + row(2, 3, 400, '/opt/homebrew/bin/node /Users/alfred/code/lacuna/lacuna-foreman/foreman.mjs') + row(3, 1, 30, '/usr/bin/caddy run')

// spec: MINDS §4.6 · class: J2 a wrong record · technique: a planted ps with ours and theirs
test('ours and theirs are told apart; a quiet box is clear and the sentry says so with units', async () => {
  const ps = PS_HEAD + OURS + row(9, 2, 50, '/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder')
  const c = await readCoast({ ps, vm: vm(2 * GB / 16384), memsize: TOTAL, now: 1000 })
  assert.equal(c.level, 'clear'); assert.equal(c.clear, true)
  assert.deepEqual(c.ours.map((r) => r.name), ['llama-server', 'node'])
  assert.deepEqual(c.others, [])
  assert.match(c.say, /^The coast is clear: 6\.3% of 32 GB free/)
})

// spec: MINDS §4.6 "if anything else is eating the box, the desk chills out" · class: J5 contention
test('heavy outside work makes the box busy and the sentence names the heaviest outsider first', async () => {
  const ps = PS_HEAD + OURS + row(20, 180, 6400, '/Applications/Final Cut Pro.app/Contents/MacOS/Final Cut Pro') + row(21, 30, 2100, '/System/Library/Frameworks/WebKit.framework/Versions/A/XPCServices/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent')
  const c = await readCoast({ ps, vm: vm(3 * GB / 16384), memsize: TOTAL, now: 1000 })
  assert.equal(c.level, 'busy')
  assert.equal(c.others[0].name, 'Final Cut Pro'); assert.equal(c.others[0].gb, 6.25)
  assert.match(c.say, /^Other work has the box: Final Cut Pro at 180% CPU and 6\.25 GB; com\.apple\.WebKit\.WebContent at 30% CPU and 2\.05 GB\. The desk keeps its mind; the OS shares the box/)
})

// spec: MINDS §4.6 · class: J4 memory · technique: free below the line with nobody heavy outside
test('free memory under the line is tight whatever the CPU, and the sentry holds what is loaded', async () => {
  const c = await readCoast({ ps: PS_HEAD + OURS, vm: vm(0.5 * GB / 16384), memsize: TOTAL, now: 1000 })
  assert.equal(c.level, 'tight'); assert.equal(c.clear, false)
  assert.match(c.say, /^Memory is tight: 1\.6% of 32 GB free\. The OS clears it; a mind the owner asks for still loads\.$/)
})

// spec: law 5 one reader · technique: the slat form parses and carries the level and the say
test('the slat form reads back as data with the level, the say and the rows', async () => {
  const c = await readCoast({ ps: PS_HEAD + OURS + row(20, 180, 6400, '/Applications/X.app/Contents/MacOS/X'), vm: vm(3 * GB / 16384), memsize: TOTAL, now: 1000 })
  const [f] = parse(coastSlat(c))
  assert.equal(String(f[0].name ?? f[0]), 'coast')
  const text = coastSlat(c)
  assert.match(text, /\("level" "busy"\)/); assert.match(text, /\("others" \(\(\("name" "X"\)/); assert.match(text, /\("say" "Other work has the box/)
})

// spec: F-C1 a stale reading is never handed out · technique: two calls under COAST.staleS, a third past it
test('a reading is reused inside the stale window and re-read past it', async () => {
  const a = await coast({ ps: PS_HEAD + OURS, vm: vm(2 * GB / 16384), memsize: TOTAL, now: 5000 })
  const b = await coast({ ps: PS_HEAD + OURS + row(20, 180, 6400, '/Applications/X.app/Contents/MacOS/X'), vm: vm(2 * GB / 16384), memsize: TOTAL, now: 5000 + COAST.staleS - 1 })
  assert.equal(b, a, 'reused')
  const d = await coast({ ps: PS_HEAD + OURS + row(20, 180, 6400, '/Applications/X.app/Contents/MacOS/X'), vm: vm(2 * GB / 16384), memsize: TOTAL, now: 5000 + COAST.staleS + 1 })
  assert.notEqual(d, a); assert.equal(d.level, 'busy')
})

// spec: the real commands answer a shape (never asserted on values: the box varies) · technique: one real read
test('the real ps and vm_stat answer a well-formed reading on this box', async () => {
  const c = await readCoast()
  assert.ok(['clear', 'busy', 'tight'].includes(c.level)); assert.ok(c.free_pct >= 0 && c.free_pct <= 100); assert.ok(c.total_gb > 0)
  assert.ok(typeof sentrySays(c) === 'string' && c.say.length > 10)
})

test('J1: the hands sample (rows already classified, base names) reads the same as ps text', async () => {
  const rows = [{ pid: 11, cpu: 3, rss_kb: 17_000_000, name: 'llama-server', ours: true }, { pid: 20, cpu: 180, rss_kb: 6_553_600, name: 'X', ours: false }]
  const c = await readCoast({ rows, vm: vm(3 * GB / 16384), memsize: TOTAL, now: 1000 })
  assert.equal(c.level, 'busy')
  assert.deepEqual(c.others.map((r) => r.name), ['X'])
  assert.deepEqual(c.ours.map((r) => r.name), ['llama-server'])
})

test('J1: no reading at all fails closed (unknown, not clear), never "tight" from zeros', async () => {
  const c = await readCoast({ ps: '', vm: '', memsize: TOTAL, now: 1000 })
  assert.equal(c.level, 'unknown')
  assert.equal(c.clear, false)
  assert.match(c.say, /no reading/)
})

test('vmMemory: available and wired from vm_stat pages, null on no page counts (D1, D4)', async () => {
  const { vmMemory } = await import('../coast.mjs')
  const vm = 'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free:      10000.\nPages active:  5.\nPages inactive:   20000.\nPages speculative:   2000.\nPages wired down:   1000000.\n'
  assert.deepEqual(vmMemory(vm), { availMB: Math.round(32000 * 16384 / 1e6), wiredMB: Math.round(1000000 * 16384 / 1e6), compressedMB: null, swapouts: null, pageBytes: 16384 })
  // video A2: the compressor's pages and the swap-outs counter, when vm_stat prints them
  const more = vmMemory(`${vm}\nPages occupied by compressor:            336769.\nSwapouts:                             216471621.`)
  assert.deepEqual([more.compressedMB, more.swapouts], [Math.round(336769 * 16384 / 1e6), 216471621])
  assert.equal(vmMemory(''), null)
})
