import { parse, Sym } from '../src/reader.js'
import { readFileSync, writeFileSync } from 'node:fs'
const FILE='scheme/reference/01-core.slat'
const CARD=/card-list|card-rect|card-screen-rect|card-set!|card-id-of|card\/[a-z-]+|glow-with-audio|\bcard-do\b/
const PROG=/(code|program|composition)$/
const hits=[]
function walk(n){
  if(Array.isArray(n)){
    for(let i=0;i<n.length;i++){
      const k=n[i], v=n[i+1]
      if(k instanceof Sym && typeof v==='string' && CARD.test(v)){
        hits.push({key:k.name, prog:PROG.test(k.name), code:v})
      }
      walk(n[i])
    }
  }
}
for(const f of parse(readFileSync(FILE,'utf8'))) walk(f)
writeFileSync('scratch/card-slots.json', JSON.stringify(hits,null,2))
console.log('total slots:', hits.length, '| CODE:', hits.filter(h=>h.prog).length, '| prose:', hits.filter(h=>!h.prog).length)
console.log('keys:', [...new Set(hits.map(h=>h.key))].join(', '))
