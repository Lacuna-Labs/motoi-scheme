// Detect fake-verb stubs inside ```scheme fences: (define (X ...)) where X is a
// namespaced name (has '/') OR a known-imaginary verb. Legit local helpers
// (plain names on real data) are NOT flagged unless in the imaginary list.
import { readFileSync } from 'node:fs'
const IMAGINARY = new Set(['wave','noise','filter','adsr','add-formant','partials','spectrum-of','spectrogram-of','transcribe','voice','record','play-tone','parse','parse-one','parse-json','form-pos','read-file','write-file','value-type','shape-of','walk','repl-read','trace','register-meta-command','register-reader-hook','contract-satisfied?','procedure-arity','error-message','error-location','record-field','knowledge/of','loam/recall','loam/remember'])
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\'));return o}
let total=0
for(const f of process.argv.slice(2)){
  let n=0
  for(const b of blocks(readFileSync(f,'utf8'))){
    const re=/\(define\s+\(([a-zA-Z][\w/!?*-]*)/g;let m
    while((m=re.exec(b))!==null){const name=m[1];if(name.includes('/')||IMAGINARY.has(name)){n++}}
  }
  if(n>0){console.log(`${n}\t${f.split('/').slice(-2).join('/')}`);total+=n}
}
console.log(`TOTAL stub-defines: ${total}`)
