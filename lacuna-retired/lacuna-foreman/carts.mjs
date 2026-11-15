// carts.mjs — THE CARTS AT BOOT (design §12.3, §12.4; work order §5.5). Owns: the scan of the carts directory into index
// rows (inventory.mjs), the regenerated `INDEX.slat` written inside the foreman's folder (the repo copy is the committed
// one), the list of carts that serve (the header's place `.`, and the serving list when the host names one), one living
// worker per serving cart (by name: a cart already living is left alone, never spawned twice), a letter when a cart does
// not load. Refuses: a cart whose header does not read (a draft row, said in the index, never spawned); a second worker
// for a name already living. Implements §12.3 (inventory regenerated on load), §12.4 (the first five). Invariants (§18):
// "one living worker per serving cart". Faults (§16): F-02 via readCart's sentence.
import fs from 'node:fs'
import path from 'node:path'
import { scanCarts, indexText, examUnits } from './inventory.mjs'
import { sendMail } from './mail.mjs'

/** The first five (design §12.4). Three STAND under the foreman from boot; backup and cleanup are one-pass carts the triggers
 *  cart files on their schedule (V7, 2026-10-23: spawning them at every boot re-ran cleanup on each restart). */
export const FIRST_FIVE = Object.freeze(['triggers', 'sentry-watch', 'forge-tender', 'backup', 'cleanup'])
// the watchdog sweep joins the standing carts (CL-H17, merged 2026-11-02 in d3773cd2): every 300 s every watchdog read, a red reported
// once, its rows in the alerts ledger through the API (D13); the memory audit joins them (R1.7, 2026-11-02): once a week each
// retention class's size and growth, the plan, a warn for rows past their time; it never removes
export const STANDING = Object.freeze(['triggers', 'sentry-watch', 'forge-tender', 'watchdog-sweep', 'memory-audit'])

/**
 * Scan, index, and spawn what serves. → {rows, index, spawned: [name…], kept: [name…], refused: [{name, why}…]}
 * @param {object} sup the supervisor
 * @param {string} root the carts directory (`lacuna-foreman/carts`)
 * @param {{indexDir?: string, serve?: string[]|null, tables?: object, log?: function}} o `serve` null = every serving row
 */
export function loadCarts(sup, root, o = {}) {
  const log = o.log || (() => {})
  const rows = scanCarts(root, { tables: o.tables || {} })
  const index = indexText(rows)
  if (o.indexDir) {
    try { fs.mkdirSync(o.indexDir, { recursive: true }); fs.writeFileSync(path.join(o.indexDir, 'INDEX.slat'), index) } catch (e) { log('could not write INDEX.slat:', e.message) }
    try {                                                                  // §7.9: one exam unit per exam id the headers name (curated from carts/units.json)
      let curated = {}; try { curated = JSON.parse(fs.readFileSync(path.join(root, 'units.json'), 'utf8')) } catch { /* none curated */ }
      fs.writeFileSync(path.join(o.indexDir, 'units.jsonl'), examUnits(rows, curated).map((u) => JSON.stringify(u)).join('\n') + '\n')
    } catch (e) { log('could not write units.jsonl:', e.message) }
  }
  const serve = o.serve === undefined ? [...STANDING] : o.serve
  const out = { rows, index, spawned: [], kept: [], refused: [] }
  for (const r of rows) {
    if (r.state !== 'serving' || (serve && !serve.includes(r.name))) continue
    const living = sup.living().find((w) => w.cart && w.cart.name === r.name)
    if (living) { out.kept.push(r.name); continue }
    try {
      const program = fs.readFileSync(path.join(root, r.place === '.' ? '' : r.place, `${r.name}.sks`), 'utf8')
      const w = sup.spawn({ name: r.name, program, by: 'foreman' })
      if (w.state === 'grave') { out.refused.push({ name: r.name, why: w.last }); sendMail(sup, null, { kind: 'self-report', severity: 'sick', what: `cart ${r.name} did not load: ${w.last}`, run: r.name }) }
      else out.spawned.push(r.name)
    } catch (e) {
      out.refused.push({ name: r.name, why: String(e.message || e) })
      sendMail(sup, null, { kind: 'self-report', severity: 'sick', what: `cart ${r.name} refused at load: ${String(e.message || e).slice(0, 300)}`, run: r.name })
    }
  }
  log(`carts: ${rows.length} indexed, ${out.spawned.length} spawned (${out.spawned.join(' ') || '-'}), ${out.kept.length} already living, ${out.refused.length} refused`)
  return out
}

/** The index rows the desk shows (`GET /carts`): never the programs. */
export function cartRows(sup, root, o = {}) {
  const rows = scanCarts(root, { tables: o.tables || {} })
  const living = new Map(sup.living().filter((w) => w.cart).map((w) => [w.cart.name, w]))
  return rows.map((r) => ({ ...r, meaning: undefined, living: living.has(r.name) ? { id: living.get(r.name).id, state: living.get(r.name).state } : null }))
}
