// sentry-mode.mjs — THE SENTRY'S MODE (shadow or live), on the record. Owns: the append-only `sentry-mode.slat` in the
// foreman's folder (one `(sentry-mode (@ ("mode" …) ("at" s) ("by" …) ("sitting" …)))` line per change; the last good line
// is the mode), the read that answers the host's `sentryShadow()` (cached by the file's mtime), and the setter behind the
// door `POST /sentry/mode`. Refuses: `live` without the owner's press (`pressed: true`, sent only by the API's decided road
// for the `leave-shadow` petition) and without the id of the sitting that passed (the API checks the exam results; the
// foreman cannot read them, foreman.sb); any mode but shadow or live. Fails closed: a missing, empty or unreadable file,
// or a line the one reader refuses, reads as shadow. Going back to shadow needs no press.
// Implements: LACUNA-SENTRY-1.0 §5 ("advisory until its exam"), §7 L3 → L4; LACUNA-CARDS-2.0 §6.1 (the rail's `leave
// shadow`); lane L2 (2026-10-24). Invariants (§18 / SENTRY §5): "in shadow, nothing leaves the record" (shadow is the
// default and the fallback); "every change of mode is a line on the record". Faults (§16 / SENTRY §6): F-S2 is prevented
// here (no line, no live).
import fs from 'node:fs'
import path from 'node:path'
import { readForms, dataToJson, writeData } from '../../lacuna-scheme/src/slat-data.js'

/** The two modes; the first is the default. */
export const MODES = Object.freeze(['shadow', 'live'])

/**
 * The newest change on the record, or shadow when there is none.
 * @param {string} file the mode file
 * @return {{mode: string, at: ?number, by: ?string, sitting: ?string}}
 */
export function readMode(file) {
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch { return { mode: 'shadow', at: null, by: null, sitting: null } }
  for (const line of text.trim().split('\n').reverse()) {
    try {
      const [f, ...rest] = readForms(line)
      if (rest.length || !Array.isArray(f) || f.length !== 2 || f[0]?.name !== 'sentry-mode') continue
      const r = dataToJson(f[1])
      if (MODES.includes(r?.mode)) return { mode: r.mode, at: r.at ?? null, by: r.by ?? null, sitting: r.sitting ?? null }
    } catch { /* a line the reader refuses is skipped; the one before it stands */ }
  }
  return { mode: 'shadow', at: null, by: null, sitting: null }
}

/**
 * One change of mode, checked and appended.
 * @param {string} file the mode file
 * @param {{mode?: string, pressed?: boolean, sitting?: string, by?: string}} b the door's body
 * @param {number} now seconds
 * @return {{ok: boolean, mode?: string, why?: string}}
 */
export function setMode(file, b, now) {
  const mode = String(b?.mode || '')
  if (!MODES.includes(mode)) return { ok: false, why: `the sentry's mode is ${MODES.join(' or ')}, not '${mode.slice(0, 20)}'` }
  const sitting = typeof b.sitting === 'string' && /^[\w.:-]{1,120}$/.test(b.sitting) ? b.sitting : null
  if (mode === 'live' && b.pressed !== true) return { ok: false, why: "live takes the owner's press (the leave-shadow petition)" }
  if (mode === 'live' && !sitting) return { ok: false, why: 'live names the sitting that passed (SENTRY §5)' }
  const row = { mode, at: now, by: String(b.by || 'the owner').slice(0, 40), sitting }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, `(sentry-mode ${writeData(row)})\n`)
  return { ok: true, mode, said: mode === 'live' ? `the sentry is live on sitting ${sitting}: its kicks are sent` : 'the sentry is in shadow: nothing is sent' }
}

/**
 * The host's view: `shadow()` reads the file again only when its mtime moved.
 * @param {string} file the mode file
 * @return {{shadow: function(): boolean, mode: function(): Object, set: function(Object, number): Object}}
 */
export function sentryMode(file) {
  let seen = null; let cur = readMode(file)
  const fresh = () => {
    let m = null
    try { m = fs.statSync(file).mtimeMs } catch { /* no file: shadow */ }
    if (m !== seen) { seen = m; cur = readMode(file) }
    return cur
  }
  return { shadow: () => fresh().mode !== 'live', mode: fresh, set: (b, now) => { const r = setMode(file, b, now); seen = null; return r } }
}
