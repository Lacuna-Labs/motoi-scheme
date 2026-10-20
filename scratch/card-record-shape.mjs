import { parse, Sym } from '../src/reader.js'
import { readFileSync } from 'node:fs'
const FILE='scheme/reference/01-core.slat'
const CARD=/card-list|card-rect|card-screen-rect|card-set!|card-id-of|card\/[a-z-]+|glow-with-audio|card-do/
function canonOf(node){
  if(!Array.isArray(node)) return null
  for(let i=0;i<node.length;i++){
    if(node[i] instanceof Sym && node[i].name===':canonical' && typeof node[i+1]==='string') return node[i+1]
  }
  return null
}
// find top-level records (have :canonical) and whether they reference card-*
const recs=new Map() // canon -> {cardHits, isCardVerb}
function walk(node, canon){
  if(Array.isArray(node)){
    const c=canonOf(node)||canon
    if(c && !recs.has(c)) recs.set(c,{hits:0, isCardVerb:CARD.test(c)})
    for(let i=0;i<node.length;i++){
      const v=node[i+1]
      if(typeof v==='string' && CARD.test(v) && c) recs.get(c).hits++
      walk(node[i], c)
    }
  }
}
for(const f of parse(readFileSync(FILE,'utf8'))) walk(f,null)
const affected=[...recs.entries()].filter(([c,r])=>r.hits>0)
affected.forEach(([c,r])=>console.log(`${r.isCardVerb?'CARD-VERB-RECORD':'motoi-record  '}  hits=${r.hits}  :canonical="${c}"`))
console.log('affected records:', affected.length, ' of which card-verb-records:', affected.filter(([c,r])=>r.isCardVerb).length)
