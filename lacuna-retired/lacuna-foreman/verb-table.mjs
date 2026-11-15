// verb-table.mjs — THE VERB TABLE'S JSON COPY (K1.13). Owns: reading `verbs.slat` (the one source of the foreman's verbs)
// with the one reader, writing `verbs.json` from it byte for byte (`JSON.stringify(table, null, 1)` and a newline, the
// form the retiring Python API reads), and the check that the two agree (`--check` exits 1 on a drift).
// Refuses: writing the slat from the JSON (the slat is the source; an edit to verbs.json is overwritten by `--write`);
// a table that does not read as data (slat-data throws, the copy is not written); a table without a `verbs` list.
// Implements: LACUNA-ENGINEERING-1.0 §3.3 (the verbs), COMMON §2 law 12 (no JSON in a config: the JSON is a generated
// copy until its last reader moves), law 5 (the one reader). Invariants (design §18): none of its own; the copy is
// never edited by hand. Faults (§16): none by id; a drift is a sentence on stderr and exit 1.
// Usage: node lacuna-foreman/verb-table.mjs --write | --check
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readData } from '../../lacuna-scheme/src/slat-data.js'

/** Where the source and its JSON copy live, beside this module. */
export const VERB_FILES = Object.freeze({
  slat: fileURLToPath(new URL('./verbs.slat', import.meta.url)),
  json: fileURLToPath(new URL('./verbs.json', import.meta.url)),
})

/**
 * The verb table from its slat text.
 * @param {string} text the contents of verbs.slat
 * @return {{_: string, verbs: Array<Object>}} the table, keys in the file's order
 * @throws {Error} the text is not slat data, or it holds no `verbs` list.
 */
export function readVerbTable(text) {
  const table = readData(String(text))
  if (!table || typeof table !== 'object' || !Array.isArray(table.verbs)) throw new Error('verbs.slat holds no ("verbs" (…)) list')
  return table
}

/**
 * The JSON copy of a verb table, as the file holds it.
 * @param {Object} table from readVerbTable
 * @return {string} one-space indented JSON and a trailing newline
 */
export function verbsJson(table) {
  return JSON.stringify(table, null, 1) + '\n'
}

/**
 * Compares a JSON copy with the copy its source makes.
 * @param {{slat: string, json: string}=} files the two paths (default: the foreman's own)
 * @return {{same: boolean, want: string, have: ?string}} `want` is the copy the slat makes; `have` is null when the copy is missing
 */
export function checkVerbTable(files = VERB_FILES) {
  const want = verbsJson(readVerbTable(readFileSync(files.slat, 'utf8')))
  let have = null
  try { have = readFileSync(files.json, 'utf8') } catch (e) { if (e.code !== 'ENOENT') throw e }
  return { same: have === want, want, have }
}

/**
 * Writes the JSON copy from the source when it differs.
 * @param {{slat: string, json: string}=} files the two paths (default: the foreman's own)
 * @return {boolean} true when the copy was rewritten
 */
export function writeVerbTable(files = VERB_FILES) {
  const c = checkVerbTable(files)
  if (!c.same) writeFileSync(files.json, c.want)
  return !c.same
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2]
  if (mode === '--write') {
    console.log(writeVerbTable() ? 'info: verbs.json rewritten from verbs.slat' : 'info: verbs.json already matches verbs.slat')
  } else if (mode === '--check') {
    const c = checkVerbTable()
    if (!c.same) { console.error(`error: verbs.json ${c.have == null ? 'is missing' : 'differs from verbs.slat'}; run node lacuna-foreman/verb-table.mjs --write`); process.exit(1) }
    console.log('info: verbs.json matches verbs.slat byte for byte')
  } else {
    console.error('usage: node lacuna-foreman/verb-table.mjs --write | --check'); process.exit(2)
  }
}
