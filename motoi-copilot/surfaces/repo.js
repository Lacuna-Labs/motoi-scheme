// surfaces/repo.js — the in-repo / batch surface.
//
// The agentic surface: PR-style whole-diff review, ONE atomic change per logical
// edit (so a kid can "undo the robot"), plan → checklist → execute → self-verify,
// and a persistent project-memory file (our CLAUDE.md equivalent). It never
// touches files outside the stated task; it always shows the diff first.
//
// SELF-VERIFY is the load-bearing property: after producing an edit, the surface
// RUNS the resulting file through the sandbox (the same interpreter the gates
// use) and reports pass/fail. A change that doesn't run is never presented as
// done — it is surfaced with the honest "ran but errored" state.
//
// This surface is filesystem-aware but SIDE-EFFECT-FREE by default: `plan()` and
// `review()` produce diffs + verdicts; `apply()` writes only when the host
// explicitly calls it (and only within the task's declared files).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { Copilot } from '../src/copilot.js'
import { speculativeRun } from '../src/sandbox.js'
import { listTopForms, findTopForm, splice as spliceForm } from '../src/editing.js'
import { debrand } from '../src/debrand.js'

export class RepoSurface {
  /**
   * @param {object} [opts]
   * @param {Copilot} [opts.copilot]
   * @param {string} [opts.memoryFile]  path to the persistent project-memory file
   */
  constructor(opts = {}) {
    this.cp = opts.copilot instanceof Copilot ? opts.copilot : new Copilot(opts)
    this.memoryFile = opts.memoryFile || null
  }

  // ── persistent project memory (CLAUDE.md-equivalent) ────────────────────────
  loadMemory() {
    if (this.memoryFile && existsSync(this.memoryFile)) {
      try { return readFileSync(this.memoryFile, 'utf8') } catch { return '' }
    }
    return ''
  }

  /**
   * plan — turn an instruction into a checklist of atomic edits. With no big
   * backend, the honest plan is a single-step "propose an edit and verify it";
   * the structure is what matters — it's the same shape a backend fills.
   * @param {string} instruction
   * @param {string[]} files   the ONLY files this task may touch
   * @returns {{instruction:string, files:string[], steps:object[], memory:string}}
   */
  plan(instruction, files = []) {
    const steps = files.map((f, i) => ({
      n: i + 1,
      file: f,
      action: 'propose + self-verify an edit',
      status: 'pending',
    }))
    if (steps.length === 0) steps.push({ n: 1, file: null, action: instruction, status: 'pending' })
    return { instruction, files, steps, memory: this.loadMemory() }
  }

  /**
   * review — produce a whole-file diff for a proposed edit to ONE named form in
   * a file, and SELF-VERIFY the result by running it. Returns the reviewable
   * artifact; writes nothing.
   *
   * @param {string} file
   * @param {string} formName   the top-level form to edit
   * @param {string} instruction
   * @returns {Promise<ReviewResult>}
   */
  async review(file, formName, instruction) {
    const buffer = existsSync(file) ? readFileSync(file, 'utf8') : ''
    const target = formName ? findTopForm(buffer, formName) : null
    const res = await this.cp.agenticEdit(
      `${instruction}${formName ? ` (form: ${formName})` : ''}`,
      { buffer, file },
    )
    if (!res.ok) {
      return { ok: false, file, say: res.say }
    }
    // For a form-scoped edit, splice the proposed program into the form's span;
    // otherwise treat the whole program as the new buffer.
    let nextBuffer = res.program
    if (target) nextBuffer = spliceForm(buffer, target, res.program).buffer
    // SELF-VERIFY: run the resulting file.
    const run = speculativeRun(nextBuffer, { timeoutMs: 1000, fuel: 500000 })
    return {
      ok: true,
      file,
      diff: unifiedDiff(file, buffer, nextBuffer),
      before: buffer,
      after: nextBuffer,
      verified: run.ok,
      runVerdict: run.ok ? 'runs' : `ran-but-errored: ${debrand(run.error || '')}`,
      confidence: run.ok ? 'verified' : 'best-guess',
    }
  }

  /**
   * apply — WRITE a reviewed edit to disk. Refuses to write a file outside the
   * declared task set, and (by default) refuses to write an unverified edit.
   * @param {ReviewResult} review
   * @param {object} [opts]  { allow: string[], force?:boolean }
   * @returns {{ok:boolean, wrote?:string, reason?:string}}
   */
  apply(review, opts = {}) {
    if (!review || !review.ok) return { ok: false, reason: 'nothing to apply' }
    const allow = opts.allow || []
    if (allow.length && !allow.includes(review.file)) {
      return { ok: false, reason: `refused: ${review.file} is outside the task's file set` }
    }
    if (!review.verified && !opts.force) {
      return { ok: false, reason: 'refused: edit did not self-verify (pass force:true to override)' }
    }
    writeFileSync(review.file, review.after, 'utf8')
    return { ok: true, wrote: review.file }
  }

  /** map — a file's top-level forms, for the planner + PR summary. */
  map(file) {
    const buffer = existsSync(file) ? readFileSync(file, 'utf8') : ''
    return listTopForms(buffer).map((f) => ({ name: f.name, start: f.span.start, end: f.span.end }))
  }
}

/**
 * @typedef {object} ReviewResult
 * @property {boolean} ok
 * @property {string} file
 * @property {string} [diff]
 * @property {string} [before]
 * @property {string} [after]
 * @property {boolean} [verified]     did the resulting file RUN?
 * @property {string} [runVerdict]
 * @property {string} [confidence]
 * @property {string} [say]           honest "I don't know" when un-producible
 */

// A minimal unified diff (line granularity) — enough for a reviewable,
// atomic-change PR view. Not a full LCS; a simple prefix/suffix + middle diff,
// which is exact for the single-form splices this surface produces.
function unifiedDiff(file, before, after) {
  const a = before.split('\n'), b = after.split('\n')
  let lo = 0
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++
  let ha = a.length, hb = b.length
  while (ha > lo && hb > lo && a[ha - 1] === b[hb - 1]) { ha--; hb-- }
  const out = [`--- a/${file}`, `+++ b/${file}`, `@@ -${lo + 1},${ha - lo} +${lo + 1},${hb - lo} @@`]
  for (let i = lo; i < ha; i++) out.push('-' + a[i])
  for (let i = lo; i < hb; i++) out.push('+' + b[i])
  return out.join('\n')
}

export default RepoSurface
