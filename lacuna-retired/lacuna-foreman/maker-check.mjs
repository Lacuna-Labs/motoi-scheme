// maker-check.mjs — THE MAKER'S DONE-CHECK (lane L3; LACUNA-CARDS-2.0 §6.16, §6.21). Owns: the done-check of a playbook
// whose `(done-check …)` starts with `maker:` — `maker: files` (C13's files rules over the folder the run's last
// `make-files` read returned; a product is held to the same rules with `fixtures.json` as its entry and no kit), `maker:
// exam` (X1's `foldExam` over the `.exam.slat` that read returned), `maker: bundle` (X1's `checkBundle`, less the manual
// rule for a game; a game's files rules too; a product's `mayBundle`). The rules are imported from
// lacuna-foreman/maker-rules.mjs, the one rule set the card draws with (through lacuna-home/src/arcade/maker.js). Refuses: judging anything but the hands' read
// (a claim in a mind's answer is never read here); a `maker:` form it does not know; passing when the rules do not load
// (fail closed: a refused import is a sentence, never a pass); writing `pass` (law 6:
// this file answers {pass, why, check}; playbook-run.mjs writes the outcome). Implements: CARDS-2.0 §6.16 (the done-check:
// files · kit · ≤ 2 MB · no network · stays in its pane), §6.21 (no bundle without a passed exam); LACUNA-3.0-DESIGN §6
// change 5 (`pass` only from the done-check). Invariants (§18): "a claim is not a record" (the check reads the folder by
// lstat through the hands, never the maker's word). Faults (§16): none raised; a failed rule is a row.

/** Where the rules live, from this folder. */
export const RULES_PATH = './maker-rules.mjs'
/** The forms a playbook may name after `maker:`. */
export const MAKER_FORMS = Object.freeze(['files', 'exam', 'bundle'])
/** The read whose answer the check judges. */
export const READ_OP = 'make-files'

/**
 * The rule module; a refused import is an answer, never a throw (Node keeps a loaded module, so a second call is cheap).
 * @param {function(string): Promise<Object>=} load an importer (tests pass their own to prove the refusal)
 * @return {Promise<{ok: true, m: Object} | {ok: false, why: string}>}
 */
export async function loadRules(load = (p) => import(p)) {
  try {
    return { ok: true, m: await load(RULES_PATH) }
  } catch (e) {
    return { ok: false, why: `the rules did not load in the foreman (${e.code || e.name}): the foreman's jail did not read lacuna-foreman/maker-rules.mjs (foreman.sb)` }
  }
}

/**
 * The form a playbook's done-check names, or null when it is not a maker check.
 * @param {string} text the playbook's `(done-check …)`
 * @return {?string} files · exam · bundle, or `?` for an unknown `maker:` form
 */
export function makerForm(text) {
  const m = String(text || '').match(/^maker:\s*([a-z]+)/)
  if (!m) return null
  return MAKER_FORMS.includes(m[1]) ? m[1] : '?'
}

/** The bundle record as the hands read it: each sha256 crossed the hop as base64 (reads/make.mjs `toHop`; the hands redact
 *  long hex as a key, law 7), turned back to hex here for X1's rules. */
export function bundleFromHop(bundle) {
  if (!bundle || typeof bundle !== 'object' || !bundle.parts || typeof bundle.parts !== 'object') return bundle || null
  const hex = (b64) => Buffer.from(String(b64 || ''), 'base64').toString('hex')
  return { ...bundle, parts: Object.fromEntries(Object.entries(bundle.parts).map(([k, list]) => [k, (Array.isArray(list) ? list : [])
    .map((f) => ({ path: f?.path, bytes: f?.bytes, sha256: hex(f?.sha256b64) }))])) }
}

/** A product is held to the files rules with fixtures.json as its entry; the kit row is a game's only. */
const productRules = (R) => ({ ...R.RULES, entry: 'fixtures.json' })

/**
 * Judges the run's last `make-files` read by the playbook's `maker:` form.
 * @param {string} form files · exam · bundle
 * @param {!Array<{unit: string, exit: ?number, value: *}>} receipts the run's receipts, in order
 * @param {function(string): Promise<Object>=} load the importer (tests)
 * @return {Promise<{pass: boolean, why: string, check: {ok: boolean, rows: !Array<{rule: string, ok: boolean, why: string}>}}>}
 */
export async function makerCheck(form, receipts, load = undefined) {
  const fail = (why) => ({ pass: false, why, check: { ok: false, rows: [{ rule: form, ok: false, why }] } })
  if (!MAKER_FORMS.includes(form)) return fail(`the done-check names maker: ${form}, which is not one of ${MAKER_FORMS.join(' · ')}`)
  const read = [...receipts].reverse().find((r) => r.unit === READ_OP && r.exit === 0)
  const item = read?.value?.rows
  if (!item || !Array.isArray(item.files)) return fail(`no ${READ_OP} read answered in this run: nothing to judge`)
  if (!item.exists) return fail(`the folder ${item.kind}/${item.id} is not on the shelf`)
  const r = await loadRules(load)
  if (!r.ok) return fail(r.why)
  const R = r.m
  const product = item.kind === 'factory'
  let rows
  if (form === 'files') {
    rows = R.checkFiles(item.files, product ? productRules(R) : R.RULES).rows.filter((x) => !(product && x.rule === 'kit'))
  } else if (form === 'exam') {
    const e = R.foldExam(item.records?.exam || null)
    rows = [{ rule: 'exam', ok: e.ok, why: e.ok ? `L${e.level} · ${e.passed} of ${e.n} fixtures` : e.why }]
  } else {
    const bundle = bundleFromHop(item.records?.bundle || null)
    rows = R.checkBundle(bundle).rows.filter((x) => !(!product && x.rule === 'manuals'))
    if (product) {
      const may = R.mayBundle({ state: 'made', exam: item.records?.exam || null, bundle })
      rows.push({ rule: 'exam', ok: may.ok, why: may.why })
    } else {
      rows.push(...R.checkFiles(item.files, R.RULES).rows)
    }
  }
  const bad = rows.filter((x) => !x.ok)
  const check = { ok: !bad.length, rows }
  return bad.length
    ? { pass: false, why: `the maker's ${form} check failed: ${bad.map((x) => `${x.rule}${x.why ? ` (${x.why})` : ''}`).join('; ').slice(0, 300)}`, check }
    : { pass: true, why: `the maker's ${form} check passed: ${rows.length} rules over ${item.kind}/${item.id} read by lstat`, check }
}
