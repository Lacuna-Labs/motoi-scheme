// hacker-mode.js — runtime flag verbs for Motoi hacker mode.
//
// The IDE + TUI paint the palette shift; these verbs let Scheme code
// toggle the flag. Kept minimal on purpose — the persona-shift lives
// in the trained model (corpus bucket hacker-mode-*), the palette lives
// in the IDE, and this file is the runtime hinge.
//
// Wiring authorized 2026-07-19 so the pairs teaching motoi/hacker-mode-on!
// can run through motoi and exit 0.

import { Sym } from '../../src/reader.js'

let _state = { on: false }

export function isHackerModeOn() { return _state.on }

export function installHackerMode(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  def('motoi/hacker-mode-on!',  () => { _state.on = true;  return new Sym('ok') })
  def('motoi/hacker-mode-off!', () => { _state.on = false; return new Sym('ok') })
  def('motoi/hacker-mode?',     () => _state.on)

  return env
}

export default installHackerMode
