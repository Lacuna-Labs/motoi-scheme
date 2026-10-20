import { parse, Sym } from '../src/reader.js'
import { readFileSync } from 'node:fs'
const FILE='scheme/reference/01-core.slat'
const NAMES=['card-list','card-rect','card-screen-rect']
const PROG=/(code|program|composition)$/
const found=[] // {key, prog(bool), snippet}
function walk(n){
  if(Array.isArray(n)){
    for(let i=0;i<n.length;i++){
      const k=n[i], v=n[i+1]
      if(k instanceof Sym && typeof v==='string'){
        for(const nm of NAMES){
          if(v.includes(nm)){
            found.push({key:k.name, prog:PROG.test(k.name), nm,
              snippet: v.slice(Math.max(0,v.indexOf(nm)-30), v.indexOf(nm)+40).replace(/\n/g,' ')})
          }
        }
      }
      walk(n[i])
    }
  }
}
for(const f of parse(readFileSync(FILE,'utf8'))) walk(f)
found.forEach(f=>console.log(`${f.prog?'CODE':'prose'} :${f.key} [${f.nm}]  …${f.snippet}…`))
console.log('total', found.length, ' in-CODE:', found.filter(f=>f.prog).length)
