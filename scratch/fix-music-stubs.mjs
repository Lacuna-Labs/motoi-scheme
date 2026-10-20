// Transform book-of-music .book.slatl files: eliminate forbidden stubs.
// Operates ONLY on ```scheme fenced blocks (in the escaped :prose form, so the
// literal file text is what we edit). Two operations:
//  (A) DELETE stub-define lines for verbs that bind natively (real verb takes
//      over): audio/play, note/strike, note/place-at, synth/play, transport/tempo
//  (B) RENAME local-helper names off namespaced/imaginary names to plain
//      non-reserved local-helper names, at define + call sites, INSIDE code only.
// 'wave symbol (quoted hash key) is preserved; quoted symbols never renamed.
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)

// Namespaced/absent verbs -> plain local-helper name. Order longest-first so
// e.g. voice/filter-sweep is handled before voice/filter.
const RENAME = [
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
  ['voice-3/4', 'voice-3-4'],
  ['voice-4/4', 'voice-4-4'],
]

// Verbs whose STUB DEFINE line must be removed so the real verb binds.
// We remove the entire (define (VERB ...) ...) top-level form. All these stubs
// are single-line in the corpus.
const DELETE_STUB = ['audio/play', 'note/strike', 'note/place-at', 'synth/play', 'transport/tempo']

function esc(s){ return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') }

// Rename a symbol token inside code text. We rename occurrences of `name`
// that are NOT immediately preceded by a quote (') and NOT part of a longer
// token. Boundaries: not preceded/followed by [\w/!?*-]. A leading '(' or space
// is fine. This treats `wave`, `adsr`, `pluck`, `voice`, and namespaced names.
function renameToken(code, name, to){
  const e = esc(name)
  // negative lookbehind for token chars and for a single-quote (symbol)
  const re = new RegExp("(?<![\\w/!?*'-])" + e + "(?![\\w/!?*-])", 'g')
  return code.replace(re, to)
}

// Transform ONE code block's decoded text.
function transformBlock(code, fileName){
  // (A) delete stub-define lines for native verbs.
  const lines = code.split('\n')
  const kept = []
  for(const ln of lines){
    let drop = false
    for(const v of DELETE_STUB){
      const re = new RegExp('^\\s*\\(define\\s+\\(' + esc(v) + '[\\s)]')
      if(re.test(ln)){ drop = true; break }
    }
    if(!drop) kept.push(ln)
  }
  code = kept.join('\n')

  // (B) namespaced / voice-3\4 renames (safe: never appear as prose or symbols).
  for(const [from, to] of RENAME){
    code = renameToken(code, from, to)
  }

  // (C) plain imaginary helper names. These are also local vars in ch08 but
  // renaming consistently preserves semantics; quoted 'wave key is protected by
  // the lookbehind for '.
  code = renameToken(code, 'wave', 'wave-samples')
  code = renameToken(code, 'adsr', 'adsr-env')
  code = renameToken(code, 'pluck', 'pluck-samples')

  return code
}

// Special-case plain `voice` define+calls: only rename `(define (voice ...`
// and its sibling call forms `(voice <num> ...)`. `voice` is elsewhere a
// legit lambda parameter, so we DON'T touch bare `voice` generally. We detect
// files that DEFINE (voice ...) as a global helper and rename only there.
function renamePlainVoice(code){
  const defRe = /\(define\s+\(voice[\s)]/
  if(!defRe.test(code)) return code
  // rename `(define (voice` -> `(define (voice-part`
  code = code.replace(/\(define\s+\(voice(?=[\s)])/g, '(define (voice-part')
  // rename call sites `(voice <digit or (>` -> `(voice-part `
  // In ch09 calls look like `(voice 0 soprano 0.8)`.
  code = code.replace(/\(voice(?=\s+[\d(])/g, '(voice-part')
  return code
}

for(const file of files){
  let text = readFileSync(file, 'utf8')
  const fileName = file.split('/').pop()
  const re = /```scheme\n([\s\S]*?)```/g
  let out = ''
  let last = 0
  let m
  while((m = re.exec(text)) !== null){
    out += text.slice(last, m.index)
    const raw = m[1]
    // decode escaped prose form. Newlines are already real bytes; only " and \
    // are escaped. Decode \\ LAST so \" is handled first (matches file form).
    let code = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    code = transformBlock(code, fileName)
    code = renamePlainVoice(code)
    // re-encode: newlines are REAL bytes in these files (only " and \ are
    // escaped in the :prose form), so we must NOT convert newlines.
    const enc = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    out += '```scheme\n' + enc + '```'
    last = m.index + m[0].length
  }
  out += text.slice(last)
  writeFileSync(file, out)
  console.log('transformed ' + fileName)
}
