// copilot.js — the orchestrator. Ties the pieces into the two headline moves
// (completion + continuation) and the agentic edit, with the Darwinian evolve-
// and-win selection wired through the reasoning loop.
//
// The pipeline for an inline suggestion:
//
//   1. FIM-frame the edit position (completion = has suffix; continuation =
//      empty suffix).
//   2. Ask the model for a POOL of raw candidates (local, fast) — or the
//      structural fallback when there's no backend.
//   3. Screen every candidate through the 3 gates (parse → resolve → spec-run).
//      Only offerable (runnable, non-hallucinated) candidates survive.
//   4. Rank the survivors through the reasoning loop's retrieve() — text
//      relevance × graph proximity × personalization × reliability × anti-lock-in
//      — with NONE/silence as a first-class candidate. The BETTER suggestion
//      WINS; sometimes silence wins and we show nothing.
//   5. Record the episode as a reasoning-trace so the human's accept/reject
//      grades it and (if chosen + ran) it salts into a reusable skill.
//
// Voice per the pedagogy brief is applied by the surfaces; the orchestrator
// exposes the confidence label ('verified' | 'best-guess') the surfaces render.

import { GateContext, screen } from './gates.js'
import { RegistryOracle } from './registry-oracle.js'
import { proposeInline, proposeAgentic } from './model-client.js'
import { ReasoningStore, NONE } from './reasoning-loop.js'
import { splitAtCursor, mode as fimMode } from './fim.js'
import { scopeAtOffset } from './editing.js'
import { debrand } from './debrand.js'
import { BrokenGuard } from './broken-guard.js'
import { hydrateStore, persistRecord } from './cortex-bridge.js'

export class Copilot {
  /**
   * @param {object} [opts]
   * @param {RegistryOracle} [opts.oracle]
   * @param {Set<string>} [opts.verbs]        layered registry for a dialect
   * @param {ReasoningStore} [opts.store]
   * @param {boolean} [opts.speculate=true]   run Gate 3 on inline (safe default)
   * @param {string} [opts.person]            default person key for personalization
   * @param {BrokenGuard} [opts.guard]        override the broken-example guard
   * @param {boolean} [opts.persist=true]     hydrate/persist reasoning memory to
   *                                          ~/motoi/copilot/cortex.slatl so the
   *                                          copilot remembers across sessions
   */
  constructor(opts = {}) {
    this.oracle = opts.oracle instanceof RegistryOracle
      ? opts.oracle
      : new RegistryOracle({ verbs: opts.verbs })
    this.store = opts.store instanceof ReasoningStore ? opts.store : new ReasoningStore()
    this.ctx = new GateContext({ oracle: this.oracle, speculate: opts.speculate !== false })
    this.person = opts.person || 'anon'
    // RAG persistence: unless explicitly disabled (tests / stateless embeds),
    // rehydrate the reasoning memory from the ONE cortex.slatl so accept/reject
    // grades, salted skills, and person-profiles survive a restart. Soft-fails:
    // no cortex ⇒ the copilot still works, it just starts with a blank memory.
    this.persist = opts.persist !== false
    if (this.persist) { try { hydrateStore(this.store) } catch { /* soft */ } }
    // The broken-example guard reads the reference's trap cards and filters them
    // through THIS copilot's oracle, so it only tripwires genuinely-unbound
    // cross-standard names (fold-left/foldl/foldr) and never a real Motoi verb.
    // Best-effort: a slimmed package with no cards degrades to an empty guard.
    this.guard = opts.guard instanceof BrokenGuard
      ? opts.guard
      : new BrokenGuard({ knows: (name) => this.oracle.knows(name) })
  }

  /**
   * guardWarn — the deterministic cross-standard tripwire lesson for a program,
   * or null. Surfaces the WHY behind a rejection Gate 2 would give as "unbound":
   * "you reached for R6RS's fold-left; use SRFI-1 fold, and here's why the arg
   * order flips." Advisory lessons for real-but-different verbs are reachable via
   * `this.guard.lookupAdvice(name)`.
   * @param {string} program
   * @returns {string|null}
   */
  guardWarn(program) { return this.guard.warn(program) }

  /**
   * _persistTrace — write a trace (and its person-profile) to the cortex so the
   * copilot remembers this episode + the accreted preference next session. The
   * append-only log's tail is the current grade. Soft-fails; persistence off ⇒
   * no-op.
   * @param {string} traceId
   */
  _persistTrace(traceId) {
    if (!this.persist) return
    try {
      const trace = this.store.traces.get(traceId)
      if (trace) persistRecord(trace)
      const personKey = trace && trace.data && trace.data.person
        ? `person:${trace.data.person}` : null
      if (personKey && this.store.profiles.has(personKey)) {
        persistRecord(this.store.profiles.get(personKey))
      }
    } catch { /* soft */ }
  }

  /**
   * suggest — the unified inline entry point. Works for BOTH completion (cursor
   * mid-form) and continuation (cursor at end) — the FIM split decides which.
   *
   * @param {import('./fim.js').EditPosition} pos
   * @param {object} [opts]
   * @param {number} [opts.n=5]        candidate pool size (Darwinian population)
   * @param {string} [opts.person]
   * @param {boolean} [opts.allowSilence=true]
   * @returns {Promise<Suggestion>}
   */
  async suggest(pos, opts = {}) {
    const t0 = now()
    const n = opts.n ?? 5
    const person = opts.person || this.person
    const m = fimMode(pos)
    const splice = splitAtCursor(pos)
    const outerScope = scopeAtOffset(pos.text ?? '', pos.offset ?? (pos.text || '').length)

    // 2. candidate pool
    const raw = await proposeInline(pos, { n, oracle: this.oracle })

    // 3. gates — only runnable, non-hallucinated candidates survive
    const { offerable, rejected } = screen(raw, splice, this.ctx, { outerScope })

    // 4. Darwinian rank — better wins; silence may win
    const query = situationText(splice.prefix, m)
    const cands = offerable.map((g) => ({
      key: undefined,             // inline candidates aren't salted skills (yet)
      text: g.middle,
      middle: g.middle,
      program: g.program,
      run: g.run,
      paradigm: guessParadigm(g.middle),
    }))
    const ranked = this.store.retrieve({
      query, candidates: cands, person, allowSilence: opts.allowSilence !== false,
    })

    // 5. record the episode (abductive trace) for grading later
    const traceId = this.store.record({
      text: query,
      tags: [m, 'inline'],
      observed: splice.prefix.slice(-80),
      candidates: cands.map((c) => c.middle).concat([NONE]),
      chosen: ranked ? ranked.chosen.middle : NONE,
      paradigm: ranked ? ranked.chosen.paradigm : null,
      person,
    })
    // the floor grade is known immediately — offerable candidates ran
    this.store.gradeFloor(traceId, offerable.length > 0)
    // persist the episode so the copilot remembers what it did next session
    this._persistTrace(traceId)

    const chosen = ranked ? ranked.chosen : null
    // Cross-standard tripwire: if the winning program (or, when silence won, the
    // context the human is typing) trips a known trap, hand over the lesson +
    // fix. Deterministic and best-effort — never blocks the offer, just teaches.
    const guardWarning = this.guard.warn(chosen ? chosen.program : (splice.prefix + splice.suffix))
    return {
      mode: m,                          // 'completion' | 'continuation'
      offer: chosen ? debrand(chosen.middle) : null, // null ⇒ silence won
      confidence: chosen && chosen.run ? 'verified' : (chosen ? 'best-guess' : 'silent'),
      alternatives: ranked ? ranked.ranked.slice(1).map((e) => debrand(e.candidate.middle)) : [],
      guard: guardWarning,              // null when clean; a lesson string when a trap is tripped
      traceId,
      person,
      poolSize: raw.length,
      offerableCount: offerable.length,
      rejected,                         // kept as teaching signal (negative examples)
      ms: round(now() - t0),
    }
  }

  /** completion — explicit alias: cursor is mid-form (prefix + suffix known). */
  complete(pos, opts) { return this.suggest(pos, opts) }

  /** continue — explicit alias: extend the program forward (empty suffix). */
  continueForward(pos, opts) {
    // Force continuation by clearing any trailing suffix.
    const p = { ...pos, text: (pos.text ?? '').slice(0, pos.offset ?? (pos.text || '').length) }
    p.offset = p.text.length
    return this.suggest(p, opts)
  }

  /**
   * accept — the human took a suggestion. Grade the trace as preferred, and if
   * it ran, salt it into a reusable skill. This is the learning signal.
   * @param {string} traceId
   * @param {object} [opts]  { edited, register, appliesWhen }
   */
  accept(traceId, opts = {}) {
    const trace = this.store.traces.get(traceId)
    const selectedOver = trace ? (trace.data.candidates || []).filter((c) => c !== trace.data.chosen) : []
    this.store.gradePref(traceId, {
      humanChosen: true, humanEdited: !!opts.edited,
      register: opts.register, selectedOver,
      signalStrength: opts.edited ? 0.7 : 1.0,
    })
    const skill = this.store.salt(traceId, { appliesWhen: opts.appliesWhen })
    // persist the preference grade + the profile, and the salted skill (so the
    // copilot remembers it DID the right thing and can reuse the move).
    this._persistTrace(traceId)
    if (this.persist && skill) { try { persistRecord(skill) } catch { /* soft */ } }
    return skill
  }

  /**
   * reject — the human dismissed the suggestion (or wanted silence). Raises the
   * person's silence-rate so NONE grows competitive — the antidote to
   * "suggesting because suggesting is what it does".
   * @param {string} traceId
   * @param {object} [opts]  { person, wantedSilence }
   */
  reject(traceId, opts = {}) {
    const person = opts.person || this.person
    if (opts.wantedSilence) this.store.recordSilencePreference(person)
    const trace = this.store.traces.get(traceId)
    if (trace) this.store.gradePref(traceId, { humanChosen: false, signalStrength: 0.5, register: 'silent' })
    // persist the rejection grade so the copilot remembers it did NOT do right
    this._persistTrace(traceId)
  }

  /**
   * agenticEdit — a multi-form / instruction-driven edit. Escalates to the big
   * model. Every produced program still passes the 3 gates before it is offered
   * as a reviewable diff. Returns an honest "I don't know — let's run it"
   * result when no backend can produce a runnable plan.
   *
   * @param {string} instruction
   * @param {object} context  { buffer, file }
   * @returns {Promise<AgenticResult>}
   */
  async agenticEdit(instruction, context = {}) {
    const buffer = context.buffer ?? ''
    const raw = await proposeAgentic(instruction, { ...context, oracle: this.oracle })
    const splice = { prefix: '', suffix: '' } // whole-program candidates
    const { offerable, rejected } = screen(raw, splice, this.ctx, {})
    if (offerable.length === 0) {
      return {
        ok: false,
        say: debrand(
          "I don't have a verified way to do that yet. Let's run a small piece " +
          'and find out together — paste what you tried and the error.',
        ),
        rejected,
      }
    }
    // Rank by run-verified first, then relevance.
    const ranked = this.store.retrieve({
      query: instruction,
      candidates: offerable.map((g) => ({ text: g.middle, middle: g.middle, program: g.program, run: g.run })),
      person: this.person,
      allowSilence: false,
    })
    const chosen = ranked ? ranked.chosen : offerable[0]
    return {
      ok: true,
      program: debrand(chosen.program),
      diffBase: buffer,
      confidence: chosen.run ? 'verified' : 'best-guess',
      rejected,
    }
  }
}

/**
 * @typedef {object} Suggestion
 * @property {'completion'|'continuation'} mode
 * @property {string|null} offer          the winning ghost text, or null (silence)
 * @property {'verified'|'best-guess'|'silent'} confidence
 * @property {string[]} alternatives      runner-up runnable candidates
 * @property {string|null} guard          cross-standard trap lesson, or null when clean
 * @property {string} traceId             for accept()/reject() grading
 * @property {number} poolSize            raw candidates requested
 * @property {number} offerableCount      how many passed all 3 gates
 * @property {object[]} rejected          gated-out candidates (teaching signal)
 * @property {number} ms
 */

// ── small helpers ────────────────────────────────────────────────────────────

function situationText(prefix, mode) {
  // The "situation" for retrieval: the tail of the prefix + the mode.
  const tail = prefix.slice(-120).replace(/\s+/g, ' ').trim()
  return `${mode} ${tail}`
}

// A crude paradigm sniff for personalization (functional vs imperative). The
// human's accept/reject accretes the real bias; this is just a seed tag.
function guessParadigm(middle) {
  if (/\b(set!|do\b|let loop|while|for-each)\b/.test(middle)) return 'imperative'
  if (/\b(fold|map|filter|reduce|lambda)\b/.test(middle)) return 'functional'
  return null
}

function now() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now()
  const [s, ns] = process.hrtime(); return s * 1000 + ns / 1e6
}
function round(x) { return Math.round(x * 1000) / 1000 }

export default Copilot
