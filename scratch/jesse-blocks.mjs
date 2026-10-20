// Extract ```scheme blocks from a book file, run cumulatively up to each block,
// print index + first line of each block + whether cumulative-through-it runs.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
function blocks(text){const out=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(text))!==null)out.push(m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\'));return out}
const f=process.argv[2]
const bs=blocks(readFileSync(f,'utf8'))
const dir=mkdtempSync(join(tmpdir(),'jb-'))
for(let i=0;i<bs.length;i++){
  const code=bs.slice(0,i+1).join('\n\n')
  const tmp=join(dir,'b.scm');writeFileSync(tmp,code)
  let status='ok'
  try{execFileSync('./bin/motoi',['run',tmp,'--fuel','5000000'],{stdio:'pipe',timeout:120000})}
  catch(e){const err=(e.stderr?e.stderr.toString():'')+(e.stdout?e.stdout.toString():'');const line=err.split('\n').find(l=>/error|unbound|mismatch|not a function|expected|missing/i.test(l))||'?';status='FAIL: '+line.trim().slice(0,80)}
  const first=bs[i].split('\n').find(l=>l.trim())||''
  console.log(`[${i}] ${status}  |  ${first.slice(0,60)}`)
}
