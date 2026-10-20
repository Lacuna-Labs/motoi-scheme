import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR = 'scheme/reference'
const TARGETS = new Set(['eng-program','math-program','cs-program','program',
  'eng-composition','math-composition','cs-composition','composition'])
function walk(node,c){ if(Array.isArray(node)){for(const e of node)walk(e,c)}
  else if(node&&typeof node==='object'&&typeof node.name==='string'&&node.name.startsWith(':')){
    const k=node.name.slice(1);c[k]=(c[k]||0)+1}}
function topForms(src){const f=parse(src);return Array.isArray(f)?f.length:1}
const files=(await readdir(DIR)).filter(f=>f.endsWith('.retag-new')).sort()
let fails=0, totTgt=0
for(const nf of files){
  const orig=nf.replace('.retag-new','')
  const so=await readFile(`${DIR}/${orig}`,'utf8')
  const sn=await readFile(`${DIR}/${nf}`,'utf8')
  let fo,fn,err=null
  try{fo=topForms(so)}catch(e){err='ORIG-PARSE '+e.message}
  try{fn=topForms(sn)}catch(e){err=(err||'')+' NEW-PARSE '+e.message}
  const c={};walk(parse(sn),c)
  const tgt=[...TARGETS].reduce((a,k)=>a+(c[k]||0),0)
  totTgt+=tgt
  const ok = !err && fo===fn && tgt===0
  if(!ok){fails++;console.log(`FAIL ${orig}  forms ${fo}->${fn}  targets=${tgt}  ${err||''}`)}
}
console.log(`\n${files.length} files checked | fails=${fails} | total-targets-remaining=${totTgt}`)
process.exit(fails?1:0)
