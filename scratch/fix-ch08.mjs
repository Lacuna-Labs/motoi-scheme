// ch08-specific: note/strike is a RICH multi-line local reimplementation (takes
// keyword args + voice records the host verb doesn't accept), so RENAME it to a
// local helper `strike-note` rather than delete. Delete only the trivial
// single-line preamble stubs (audio/play, synth/play, note/place-at). Apply the
// same namespaced/imaginary helper renames as the main pass.
import { readFileSync, writeFileSync } from 'node:fs'
const file = process.argv[2]

const RENAME = [
  ['note/place-at', null], // handled by delete below (dead stub)
]

const RENAME_HELPERS = [
  ['base/land-on-downbeat', 'land-on-downbeat'],
  ['base/across-beats', 'across-beats'],
  ['base/at-beat', 'at-beat'],
  ['transport/tempo-curve', 'tempo-curve'],
  ['voice/detune-spread', 'voice-detune-spread'],
  ['voice/filter-sweep', 'voice-filter-sweep'],
  ['voice/pan-sweep', 'voice-pan-sweep'],
  ['voice/waveform', 'voice-waveform'],
  ['voice/envelope', 'voice-envelope'],
  ['voice/tremolo', 'voice-tremolo'],
  ['voice/vibrato', 'voice-vibrato'],
  ['voice/render', 'voice-render'],
  ['voice/filter', 'voice-filter'],
  ['voice/create', 'make-voice-spec'],
  ['chord/build', 'chord-freqs'],
  ['chord/play', 'chord-freqs-play'],
  ['pedal/press', 'pedal-press'],
  ['pedal/release', 'pedal-release'],
  ['note/strike', 'strike-note'],
]

// single-line stubs to delete so real verb binds
const DELETE_STUB = ['audio/play', 'synth/play', 'note/place-at']

function esc(s){ return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') }
function renameToken(code, name, to){
  const re = new RegExp("(?<![\\w/!?*'-])" + esc(name) + "(?![\\w/!?*-])", 'g')
  return code.replace(re, to)
}

function transform(code){
  // delete single-line trivial stubs
  const kept = []
  for(const ln of code.split('\n')){
    let drop = false
    for(const v of DELETE_STUB){
      if(new RegExp('^\\s*\\(define\\s+\\(' + esc(v) + '[\\s)]').test(ln)){ drop = true; break }
    }
    if(!drop) kept.push(ln)
  }
  code = kept.join('\n')
  for(const [from,to] of RENAME_HELPERS) code = renameToken(code, from, to)
  code = renameToken(code, 'wave', 'wave-samples')
  code = renameToken(code, 'adsr', 'adsr-env')
  code = renameToken(code, 'pluck', 'pluck-samples')
  return code
}

let text = readFileSync(file, 'utf8')
const re = /```scheme\n([\s\S]*?)```/g
let out = '', last = 0, m
while((m = re.exec(text)) !== null){
  out += text.slice(last, m.index)
  let code = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  code = transform(code)
  const enc = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  out += '```scheme\n' + enc + '```'
  last = m.index + m[0].length
}
out += text.slice(last)
writeFileSync(file, out)
console.log('transformed ch08 (note/strike -> strike-note)')
