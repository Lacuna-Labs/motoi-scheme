// bad-lines.mjs — THE STATELESS BAD LINES OF A2 §10.3 (lane F5-A, units A.1 and A.4). Owns: one hand-made line per malformed
// shape that needs no state (the form, the kind, the producer and the schema: A2 §4.2's steps 1–3), each with the reason the
// validator names, and the two lines that read although they look wrong. The validator's test (validate.test.mjs) reads them
// through `readEventLine`; the admit's test (lacuna-node/test/floor-events.test.mjs) reads them through the door, which adds
// the quarantine. Refuses: a case that needs a clock, a cursor or a gate (those are the admit's test's own).

/** A time in the catalog's range (ms, 13 digits). */
export const T = 1793388001209
/** A coordinate in its print form (coordinate.mjs, K1's day-1 contract). */
export const AT = 'lacuna:/1/4096/995779/1/1/8/8'

const step = (data, more = '') => `(ev (seq 9) (t ${T}) (kind run.step) (actor "w-5f0c6c") (at "${AT}") (ref "w-5f0c6c") (src "foreman-bus" 9) (data (@ ${data})))${more}`
const line = (kind, src, data, at = '-', ref = 'null') => `(ev (seq 9) (t ${T}) (kind ${kind}) (actor "e4b") (at "${at}") (ref ${ref}) (src "${src}" 9) (data (@ ${data})))`

/** The malformed shapes: [name, line, reason]. */
export const BAD_LINES = Object.freeze([
  ['not slat', '(ev (seq 1) (t 17', 'malformed'],
  ['two forms', `${step('("n" 1) ("status" "running")')} ${step('("n" 1) ("status" "running")')}`, 'malformed'],
  ['a tag in data', step('("n" 1) ("status" "running") ("text" #inst "2026-10-31T19:00:00Z")'), 'malformed'],
  ['a symbol in data', step('("n" 1) ("status" running)'), 'malformed'],
  ['field order', `(ev (t ${T}) (seq 9) (kind run.step) (actor "w-5f0c6c") (at "${AT}") (ref "w-5f0c6c") (src "foreman-bus" 9) (data (@)))`, 'malformed'],
  ['prev supplied', step('("n" 1) ("status" "running")').replace(/\)$/, ' (prev "sha256:00"))'), 'prev-set'],
  ['2,049 bytes', step(`("n" 1) ("status" "running") ("text" "${'x'.repeat(2000)}")`), 'too-long'],
  ['unknown kind', line('run.sealed', 'foreman-bus', ''), 'unknown-kind'],
  ['kind as string', `(ev (seq 9) (t ${T}) (kind "run.step") (actor "w-5f0c6c") (at "${AT}") (ref "w-5f0c6c") (src "foreman-bus" 9) (data (@)))`, 'malformed'],
  ['wrong producer', line('mind.slot', 'cortex-log', '("slot" 0) ("busy" #t)'), 'producer'],
  ['missing required', `(ev (seq 9) (t ${T}) (kind run.ticket.open) (actor "w-5f0c6c") (at "${AT}") (ref "w-5f0c6c") (src "foreman-bus" 9) (data (@ ("kind" "hand"))))`, 'schema:op'],
  ['extra key', `(ev (seq 9) (t ${T}) (kind foreman.beat) (actor "foreman") (at "-") (ref null) (src "foreman-health" 9) (data (@ ("living" 4) ("mood" "fine"))))`, 'schema:mood'],
  ['wrong type', line('mind.turn.done', 'engine-front', '("ms" "145")', AT), 'schema:ms'],
  ['float where int', line('mind.turn.done', 'engine-front', '("ms" 5307) ("tokens" 11.5)', AT), 'schema:tokens'],
  ['out of bounds', `(ev (seq 9) (t ${T}) (kind box.coast) (actor "box") (at "-") (ref null) (src "coast" 9) (data (@ ("level" "clear") ("free-pct" 140))))`, 'schema:free-pct'],
  ['enum', step('("n" 1) ("status" "won")'), 'schema:status'],
  ['at missing where mandatory', `(ev (seq 9) (t ${T}) (kind run.step) (actor "w-5f0c6c") (at "-") (ref "w-5f0c6c") (src "foreman-bus" 9) (data (@ ("n" 1) ("status" "running"))))`, 'schema:at'],
  ['ref missing', `(ev (seq 9) (t ${T}) (kind press.wait) (actor "w-5f0c6c") (at "-") (ref null) (src "petitions" 9) (data (@ ("id" "p-1"))))`, 'schema:ref'],
  ['non-NFC', step('("n" 1) ("status" "running") ("text" "café")'), 'malformed'],
  ['an actor off its rule', `(ev (seq 9) (t ${T}) (kind foreman.beat) (actor "hands") (at "-") (ref null) (src "foreman-health" 9) (data (@ ("living" 4))))`, 'schema:actor'],
  ['a coordinate in the old form', step('("n" 1) ("status" "running")').replace(AT, 'studio·foreman·w-5f0c6c·1·8·-'), 'schema:at'],
  ['t as seconds', `(ev (seq 9) (t 1793388001) (kind run.step) (actor "w-5f0c6c") (at "${AT}") (ref "w-5f0c6c") (src "foreman-bus" 9) (data (@ ("n" 1) ("status" "running"))))`, 'schema:t'],
])

/** Two lines that read although they look wrong: [name, line, readEventLine's options]. */
export const GOOD_LINES = Object.freeze([
  ['11.0 reads as 11', line('mind.turn.done', 'engine-front', '("ms" 5307) ("tokens" 11.0)', AT), {}],
  ["a day file's prev", step('("n" 1) ("status" "running")').replace(/\)$/, ' (prev "sha256:00"))'), { log: true }],
])
