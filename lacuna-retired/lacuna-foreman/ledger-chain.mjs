// ledger-chain.mjs — THE FOREVER LEDGER'S CHAIN (order 2026-11-06 E14 row 10; records-01). Owns: the writer the foreman's
// `ledger()` is (`ledgerWriter`): each row of `~/lacuna-world/foreman/ledger/runs.slat` written with the sha256 of the line
// before it, as the floor's day file and the grid's ledger half already are (`floor-log.mjs`, `grid-ledger.mjs`); the row's
// form kept for every reader: a `(kind (@ …))` row carries `("prev" "sha256:…")` as its alist's last pair, so a reader of two
// elements still reads it; a field row (`(verdict (run …) …)`) carries `(prev "sha256:…")` as its last field (`runs.mjs`
// readRow drops it). The prev is read from the file's own last line at every append, so a restart and a run foreman's
// process go on one chain. `verifyLedger`, the check: the rows before the first chained row are the ledger before the chain
// (10,352 on 2026-11-06), counted and never judged; from it on, every row names the hash of the line before. Refuses: a row
// that is not one form a line; rewriting a written row. Implements: E14 §5 row 10, `lacuna.ledger.chain.01`. Invariants
// (§18): "a hash-chained ledger is never rewritten". Faults (§16): none; a broken line is the verify's answer.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** The bytes of a file's tail read for its last line (a ledger row is under 8 KB; the tail holds several). */
const TAIL = 64 * 1024
const ALIST = /^\([^\s()]+ \(@ .*\)\)$/
const PREV = /\((?:"prev"|prev) "(genesis|sha256:[0-9a-f]{64})"\)\)\)?$/

/** The hash a row's successor names. @param {string} line @return {string} */
export const sha = (line) => 'sha256:' + createHash('sha256').update(line).digest('hex')

/**
 * One row with its prev: inside the alist of a `(kind (@ …))` row, else as the form's last field.
 * @param {string} line one form, no newline
 * @param {string} prev the hash of the line before, or `genesis`
 * @return {string}
 * @throws {Error} the line is not one form
 */
export function chainRow(line, prev) {
  if (ALIST.test(line)) return `${line.slice(0, -2)} ("prev" "${prev}")))`
  if (line.startsWith('(') && line.endsWith(')')) return `${line.slice(0, -1)} (prev "${prev}"))`
  throw new Error(`a ledger row is one form a line, not ${JSON.stringify(line.slice(0, 40))}`)
}

/** The prev a row names, or null for a row before the chain. @param {string} line @return {?string} */
export const prevOf = (line) => line.match(PREV)?.[1] ?? null

// the file's last line, read from its tail; null when the file is empty or absent
function lastLine(file) {
  let fd
  try { fd = fs.openSync(file, 'r') } catch (e) { if (e.code === 'ENOENT') return null; throw e }
  try {
    const size = fs.fstatSync(fd).size
    const n = Math.min(size, TAIL)
    const buf = Buffer.alloc(n)
    fs.readSync(fd, buf, 0, n, size - n)
    return buf.toString('utf8').split('\n').filter(Boolean).at(-1) ?? null
  } finally { fs.closeSync(fd) }
}

/**
 * The ledger's writer: `(text)` appends each line of `text`, each chained to the line before it.
 * @param {string} file
 * @return {function(string): void}
 */
export function ledgerWriter(file) {
  return (text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    for (const line of String(text).split('\n').filter((l) => l.trim())) {
      const last = lastLine(file)
      fs.appendFileSync(file, chainRow(line, last === null ? 'genesis' : sha(last)) + '\n')
    }
  }
}

/**
 * The chain over a ledger's text: the rows before the chain, the rows on it, and the first broken row.
 * @param {string} text
 * @return {{ok: boolean, rows: number, before: number, chained: number, broken: ?{line: number, why: string}}}
 */
export function verifyLedger(text) {
  const lines = String(text).split('\n').filter((l) => l.trim())
  const first = lines.findIndex((l) => prevOf(l) !== null)
  const before = first < 0 ? lines.length : first
  for (let i = before; i < lines.length; i++) {
    const want = i === 0 ? 'genesis' : sha(lines[i - 1])
    const got = prevOf(lines[i])
    if (got !== want) {
      const why = got === null ? 'the row names no prev after the chain began' : 'its prev is not the hash of the line before'
      return { ok: false, rows: lines.length, before, chained: i - before, broken: { line: i + 1, why } }
    }
  }
  return { ok: true, rows: lines.length, before, chained: lines.length - before, broken: null }
}
