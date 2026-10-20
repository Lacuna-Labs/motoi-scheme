import { parse, Sym } from '../src/reader.js'
import { readFileSync } from 'node:fs'
const FILE='scheme/reference/01-core.slat'
const PROG=/(code|program|composition)$/
const hits=[]
function walk(n){
  if(Array.isArray(n)){
    for(let i=0;i<n.length;i++){
      const k=n[i]
      if(k instanceof Sym && PROG.test(k.name) && typeof n[i+1]==='string' && n[i+1].includes('card-emit'))
        hits.push({key:k.name, code:n[i+1]})
      walk(n[i])
    }
  }
}
for(const f of parse(readFileSync(FILE,'utf8'))) walk(f)
console.log('SLOTS WITH card-emit IN CODE:', hits.length)
hits.forEach((h,i)=>{console.log(`\n--- [${i}] ${h.key} ---\n${h.code}`)})
