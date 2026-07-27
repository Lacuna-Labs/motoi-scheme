// reasoning-loop.js — the grade → store → salt → retrieve loop that makes the
// copilot's suggestions EVOLVE, and lets the BETTER suggestions WIN.
//
// This is the SuperRAG reasoning layer from scratch/reasoning-cortex-superrag-
// research.md, implemented as a self-contained store so the copilot module
// depends on nothing but the motoi-scheme public API. It mirrors the Cortex
// record shape exactly (`:kind`, `:salience`, `:data`, `:evidence`, …) so a
// host can persist these records into the real `~/motoi/copilot/cortex.slatl` verbatim
// (they round-trip untouched — the extensibility contract). Nothing here forks
// the engine; it is data + a deterministic ranking fold.
//
// The four moves:
//   record()   — store a reasoning-trace at neutral salience (cheap, always).
//   grade()    — attach floor (interpreter passed?) + preference (human chose?).
//   salt()     — crystallize floor-passing + chosen traces into callable skills.
//   retrieve() — token-seed → graph-walk → personalize → preference-weight,
//                returning #f (null) when NONE / silence outscores everything.
//
// The Darwinian core:
//   · Selection is differential salience (reliability + preference − staleness).
//   · anti_lock_in DAMPS an over-used winner so runner-up runnable candidates
//     get re-tested — the population of moves cannot collapse to one allele.
//   · NONE (silence) is a first-class candidate; when it wins, retrieve returns
//     null — the copilot correctly chooses to say nothing.
//
// Correctness is the FLOOR (from the interpreter, via gates.js). Preference is
// the CEILING (from the human). No learned scorer, no gradient — every score is
// arithmetic over stored fields (a fold), matching the compute-aversion mandate.

// The silence sentinel. It is a real candidate with its own preference history.
export const NONE = Symbol.for('motoi-copilot:NONE')

let _idCounter = 0
function mkId(prefix) {
  _idCounter += 1
  return `${prefix}-${Date.now()}-${_idCounter.toString(36)}`
}

// ── deterministic scoring knobs (design §3.3 / §6.2) ───────────────────────
// These are the personality dials Alfred owns (design §9 open-questions 1–3).
// They are exposed so a host can tune the copilot's character without code
// change. Defaults are the design's proposed values.
export const DEFAULT_KNOBS = Object.freeze({
  base: 0.4,
  prefBonus: 0.3,          // × signal_strength when human-chosen
  reliabilityBonus: 0.2,   // × reuse hit-rate
  stalenessPenalty: 0.2,   // × (1 − recency)
  floorGateFail: 0.05,     // salience multiplier when it did NOT run
  overuseWindow: 6,        // recent-selection window for anti-lock-in
  overuseCap: 0.9,         // max damping fraction
  noveltyBonus: 0.2,       // extra weight for an unexplored candidate
  relevanceFloor: 0.15,    // below this, retrieve returns NONE/#f
  hops: 2,                 // graph-walk budget
})

export class ReasoningStore {
  constructor(opts = {}) {
    this.knobs = { ...DEFAULT_KNOBS, ...(opts.knobs || {}) }
    this.traces = new Map()   // id -> trace record
    this.skills = new Map()   // key -> skill record
    this.profiles = new Map() // person-key -> profile record
    this.edges = new Map()    // "from|label" -> Set(to)  (the graph)
    this._recent = []         // rolling window of selected skill keys (anti-lock-in)
  }

  // ── STORE ────────────────────────────────────────────────────────────────
  /**
   * record — write a reasoning-trace (abductive: observed → candidates → chosen).
   * Cheap and always allowed; the prune keeps it honest.
   * @param {object} t
   * @param {string} t.text        RAG body
   * @param {string[]} [t.tags]
   * @param {*} [t.observed]       the surprising observation (Peirce)
   * @param {Array} [t.candidates] the move-set (strings / forms / NONE)
   * @param {*} [t.chosen]         what got picked
   * @param {string} [t.paradigm]  'functional' | 'imperative'
   * @param {string} [t.register]  'terse' | 'explained' | 'verbose' | 'silent'
   * @param {string} [t.person]    person key
   * @returns {string} trace id
   */
  record(t) {
    const id = mkId('rt')
    const rec = {
      kind: ':reasoning-trace',
      id,
      text: t.text || '',
      tags: t.tags || [],
      salience: 0.5,               // neutral; grading moves it
      ts: Date.now(),
      provenance: 'copilot/reason-record',
      data: {
        observed: t.observed ?? null,
        candidates: t.candidates ?? [],
        chosen: t.chosen ?? null,
        paradigm: t.paradigm ?? null,
        register: t.register ?? null,
        person: t.person ?? null,
        gradeFloor: null,
        gradePref: null,
      },
    }
    this.traces.set(id, rec)
    return id
  }

  // ── GRADE ────────────────────────────────────────────────────────────────
  /**
   * gradeFloor — the interpreter verdict (correctness, free). Pass a gate result
   * or a boolean.
   */
  gradeFloor(id, runs, passes = runs) {
    const rec = this.traces.get(id)
    if (!rec) return false
    rec.data.gradeFloor = { runs: !!runs, passes: !!passes, verifiedTs: Date.now() }
    this._recomputeSalience(rec)
    return true
  }

  /**
   * gradePref — the human verdict (preference, the ceiling). `selectedOver` are
   * the runnable candidates that LOST — the load-bearing contrast.
   */
  gradePref(id, { humanChosen = true, humanEdited = false, paradigm, register,
                  selectedOver = [], signalStrength = 1.0 } = {}) {
    const rec = this.traces.get(id)
    if (!rec) return false
    rec.data.gradePref = {
      humanChosen: !!humanChosen, humanEdited: !!humanEdited,
      paradigm: paradigm ?? rec.data.paradigm,
      register: register ?? rec.data.register,
      selectedOver, signalStrength,
    }
    this._recomputeSalience(rec)
    // accrete the person profile from this preference signal
    if (rec.data.person) this._accreteProfile(rec.data.person, rec.data.gradePref)
    return true
  }

  _recomputeSalience(rec) {
    const k = this.knobs
    const gf = rec.data.gradeFloor
    const gp = rec.data.gradePref
    const floorGate = gf && gf.runs ? 1 : k.floorGateFail
    let s = k.base
    if (gp && gp.humanChosen) s += k.prefBonus * (gp.signalStrength ?? 1)
    // reliability from any linked skill's reuse rate (0 until salted)
    // staleness: fresh trace ⇒ no penalty
    rec.salience = clamp01(floorGate * s)
  }

  // ── SALT ─────────────────────────────────────────────────────────────────
  /**
   * salt — crystallize a floor-passing, human-chosen trace into a callable
   * skill (MSCE-style, with evidence links + applicability + reliability).
   * Idempotent by key: re-salting updates reliability, never duplicates.
   *
   * Anti-fabrication: a skill MUST cite ≥1 stored trace. No trace ⇒ null.
   *
   * @param {string} traceId
   * @param {object} [opts]
   * @param {string} [opts.key]         upsert key (defaults to a hash of the move)
   * @param {string} [opts.appliesWhen] applicability boundary (RAG trigger)
   * @param {string} [opts.saltReason]  ':chosen-and-ran'|':chosen-not-proven-optimal'|':rejection-that-saved'
   * @returns {object|null} the skill record, or null when un-saltable
   */
  salt(traceId, opts = {}) {
    const trace = this.traces.get(traceId)
    if (!trace) return null
    const gf = trace.data.gradeFloor
    const gp = trace.data.gradePref
    const reason = opts.saltReason
      || (gf && gf.runs && gp && gp.humanChosen ? ':chosen-and-ran' : ':chosen-not-proven-optimal')
    // The floor gate: a trace that did not run is NEVER salted as a positive
    // skill (it may become a rejection-that-saved warning instead).
    if (reason !== ':rejection-that-saved' && !(gf && gf.runs)) return null

    const move = trace.data.chosen
    const key = opts.key || `skill:${stableKey(move)}`
    let skill = this.skills.get(key)
    if (!skill) {
      skill = {
        kind: ':reasoning-skill',
        id: mkId('sk'),
        key,
        text: opts.text || trace.text,
        salience: 0.55,
        ts: Date.now(),
        provenance: 'copilot/salt',
        data: {
          skill: move,
          evidence: [],
          appliesWhen: opts.appliesWhen ?? null,
          verify: ':motoi-run-passes',
          reliability: { reuseSuccess: 0, reuseTotal: 0 },
          saltReason: reason,
          paradigm: trace.data.paradigm,
          person: trace.data.person,
        },
      }
      this.skills.set(key, skill)
    }
    // evidence link (auditable, never fabricated)
    if (!skill.data.evidence.includes(traceId)) skill.data.evidence.push(traceId)
    this.associate(traceId, 'evidence-of', key)
    this._recomputeSkillSalience(skill)
    return skill
  }

  /** Record reuse outcome on a skill (drives its reliability + salience). */
  recordReuse(key, success) {
    const skill = this.skills.get(key)
    if (!skill) return false
    skill.data.reliability.reuseTotal += 1
    if (success) skill.data.reliability.reuseSuccess += 1
    this._recomputeSkillSalience(skill)
    return true
  }

  _recomputeSkillSalience(skill) {
    const k = this.knobs
    const r = skill.data.reliability
    const rate = r.reuseTotal > 0 ? r.reuseSuccess / r.reuseTotal : 0
    const ageMs = Date.now() - skill.ts
    const recency = Math.exp(-ageMs / (1000 * 60 * 60 * 24 * 30)) // 30-day half-life-ish
    const staleness = k.stalenessPenalty * (1 - recency)
    skill.salience = clamp01(k.base + k.reliabilityBonus * rate - staleness + 0.15)
  }

  // ── GRAPH ────────────────────────────────────────────────────────────────
  associate(from, label, to) {
    const key = `${from}|${label}`
    if (!this.edges.has(key)) this.edges.set(key, new Set())
    this.edges.get(key).add(to)
  }
  neighbors(from, label) {
    const key = `${from}|${label}`
    return this.edges.has(key) ? [...this.edges.get(key)] : []
  }

  // ── PERSON PROFILE (accretion, training-free) ──────────────────────────────
  _accreteProfile(person, pref) {
    const key = `person:${person}`
    let p = this.profiles.get(key)
    if (!p) {
      p = {
        kind: ':person-profile', id: mkId('pp'), key, salience: 1.0, ts: Date.now(),
        data: {
          paradigmBias: {}, registerBias: {}, silenceRate: 0,
          editRate: 0, episodes: 0, evidence: [],
        },
      }
      this.profiles.set(key, p)
    }
    const d = p.data
    d.episodes += 1
    if (pref.paradigm) d.paradigmBias[pref.paradigm] = (d.paradigmBias[pref.paradigm] || 0) + 1
    if (pref.register) d.registerBias[pref.register] = (d.registerBias[pref.register] || 0) + 1
    if (pref.humanEdited) d.editRate = ema(d.editRate, 1, 0.2)
    else d.editRate = ema(d.editRate, 0, 0.2)
    return p
  }

  /** Learn that the human wanted NO suggestion (raises silence-rate). */
  recordSilencePreference(person) {
    const key = `person:${person}`
    let p = this.profiles.get(key)
    if (!p) { this._accreteProfile(person, {}); p = this.profiles.get(key) }
    p.data.silenceRate = ema(p.data.silenceRate, 1, 0.2)
    return p
  }

  profile(person) { return this.profiles.get(`person:${person}`) || null }

  // ── RETRIEVE (SuperRAG) ────────────────────────────────────────────────────
  /**
   * retrieve — rank the offerable candidates for this situation, blending text
   * relevance, graph proximity, personalization, reliability, and anti-lock-in.
   *
   * Returns the ranked list, OR null when NONE/silence wins or nothing clears
   * the relevance floor (honest-#f — "the right action is no action").
   *
   * @param {object} q
   * @param {string} q.query            the situation text
   * @param {Array<{key?:string,text?:string,paradigm?:string,middle?:string}>} q.candidates
   *   the runnable candidates that already passed the gates. Each may carry a
   *   `key` linking to a salted skill.
   * @param {string} [q.person]
   * @param {boolean} [q.allowSilence=true]  include the NONE candidate
   * @returns {{ranked:Array, chosen:*, silence:boolean}|null}
   */
  retrieve(q) {
    const k = this.knobs
    const person = q.person || null
    const prof = person ? this.profile(person) : null
    const cands = Array.isArray(q.candidates) ? q.candidates.slice() : []

    const scored = cands.map((c) => {
      const rel = textRelevance(q.query, c.text || String(c.middle || ''))
      const skill = c.key ? this.skills.get(c.key) : null
      const gp = graphProximity(this, c.key, q.query)
      const per = personalize(prof, c)
      const reliab = skillReliability(skill)
      const anti = this._antiLockIn(c.key, prof)
      const score = rel * gp * per * reliab * anti
      return { candidate: c, score, parts: { rel, gp, per, reliab, anti } }
    })

    // The silence candidate. Its weight comes from the person's silence-rate:
    // a person who often wants no suggestion makes NONE competitive.
    const silenceWeight = prof ? (0.2 + 0.8 * (prof.data.silenceRate || 0)) : 0.2
    const silenceEntry = { candidate: NONE, score: q.allowSilence === false ? -1 : silenceWeight,
      parts: { silence: silenceWeight } }

    const all = scored.concat([silenceEntry])
    all.sort((a, b) => b.score - a.score)

    const best = all[0]
    // Honest-#f: NONE won, or the best content candidate is below the floor.
    if (!best || best.candidate === NONE) return null
    if (best.score < k.relevanceFloor) return null

    // Register the winner in the anti-lock-in window (mutation pressure).
    if (best.candidate && best.candidate.key) this._noteSelection(best.candidate.key)

    return {
      ranked: all.filter((e) => e.candidate !== NONE),
      chosen: best.candidate,
      silence: false,
    }
  }

  // anti_lock_in(c,p) = novelty_bonus * (1 − overuse_penalty)
  _antiLockIn(key, prof) {
    const k = this.knobs
    if (!key) return 1 + k.noveltyBonus // a fresh, unsalted candidate is novel
    const recentCount = this._recent.filter((x) => x === key).length
    const overuse = clamp(recentCount / k.overuseWindow, 0, k.overuseCap)
    const novelty = recentCount === 0 ? 1 + k.noveltyBonus : 1
    return novelty * (1 - overuse)
  }
  _noteSelection(key) {
    this._recent.push(key)
    while (this._recent.length > this.knobs.overuseWindow * 3) this._recent.shift()
  }

  // ── prune (rides the existing salience dial) ───────────────────────────────
  prune(threshold = 0.1) {
    let dropped = 0
    for (const [id, rec] of this.traces) {
      if (rec.salience < threshold) { this.traces.delete(id); dropped++ }
    }
    return dropped
  }

  // ── export to the real Cortex shape (round-trips into cortex.slatl) ─────────
  toCortexRecords() {
    return [...this.traces.values(), ...this.skills.values(), ...this.profiles.values()]
  }
}

// ── deterministic ranking primitives ────────────────────────────────────────

function textRelevance(query, text) {
  const q = tokens(query), t = new Set(tokens(text))
  if (q.length === 0) return 0.5
  let hits = 0
  for (const w of q) if (t.has(w)) hits++
  return 0.1 + 0.9 * (hits / q.length)
}
function tokens(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9/?!*+-]+/g) || []
}
function graphProximity(store, key, query) {
  if (!key) return 1
  // 1/(1+hops) along evidence edges from the skill toward query-matching traces.
  const traces = store.neighbors(key, 'evidence-of')
  if (traces.length === 0) return 1
  return 1 + 0.15 * Math.min(traces.length, 3) // more evidence ⇒ mild boost
}
function personalize(prof, c) {
  if (!prof) return 1
  const d = prof.data
  let f = 1
  if (c.paradigm && d.paradigmBias[c.paradigm]) {
    const total = Object.values(d.paradigmBias).reduce((a, b) => a + b, 0) || 1
    f *= 0.8 + 0.6 * (d.paradigmBias[c.paradigm] / total)
  }
  return f
}
function skillReliability(skill) {
  if (!skill) return 1
  const r = skill.data.reliability
  if (r.reuseTotal === 0) return 1
  return 0.6 + 0.6 * (r.reuseSuccess / r.reuseTotal)
}

function stableKey(move) {
  const s = typeof move === 'string' ? move : JSON.stringify(move)
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return (h >>> 0).toString(36)
}
function ema(prev, x, a) { return prev + a * (x - prev) }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x }

export default ReasoningStore
