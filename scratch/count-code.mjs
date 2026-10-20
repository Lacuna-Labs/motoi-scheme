import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR='scheme/reference'
function count(node,name){let n=0
  if(Array.isArray(node)){for(const e of node)n+=count(e,name)}
  else if(node&&typeof node==='object'&&node.name===name)n++
  return n}
const which=process.argv[2]||'orig'
const suf=which==='new'?'.retag-new':'.slat'
const files=(await readdir(DIR)).filter(f=>which==='new'?f.endsWith('.retag-new'):(f.endsWith('.slat')&&!f.endsWith('.retag-new'))).sort()
let tot=0
for(const f of files){const c=count(parse(await readFile(`${DIR}/${f}`,'utf8')),':code');tot+=c}
console.log(`${which}: files=${files.length}  total :code = ${tot}`)
