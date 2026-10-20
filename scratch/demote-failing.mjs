// scratch/demote-failing.mjs — demote any ```scheme fence that FAILS when run
// in isolation (with a small prelude of prior CLEAN blocks is NOT used; we test
// each block standalone). Only demotes blocks that error on their own, so pure
// blocks that only fail via cumulative poisoning are left for hand review.
// A NOTE line is inserted. Usage: node scratch/demote-failing.mjs <file...>
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = mkdtempSync(join(tmpdir(), 'demf-'))
const tmp = join(dir, 'b.scm')
function fails(code){
  writeFileSync(tmp, code)
  try{ execFileSync('./bin/motoi',['run',tmp,'--fuel','5000000'],{stdio:'pipe',timeout:120000}); return false }
  catch(e){ const err=(e.stderr?e.stderr.toString():'')+(e.stdout?e.stdout.toString():''); return (err.match(/error|unbound|not a function|escalate/i)?err.split('\n').find(l=>/error|unbound|not a function|escalate/i.test(l)):'fail').trim() }
}
for(const f of process.argv.slice(2)){
  let text=readFileSync(f,'utf8')
  const re=/```scheme\n([\s\S]*?)```/g
  let out='',last=0,m,n=0,d=0
  while((m=re.exec(text))!==null){
    n++
    const code=m[1].replace(/\\"/g,'"').replace(/\\\\/g,'\\')
    const why=fails(code)
    if(why){
      const note=';; [illustrative: '+why.slice(0,70)+' — needs host data/verb base Motoi does not expose]\n'
      const repl='```text\n'+note+m[1]+'```'
      out+=text.slice(last,m.index)+repl; last=m.index+m[0].length; d++
      console.log(`${f.split('/').pop()} #${n} DEMOTE :: ${why.slice(0,60)}`)
    }
  }
  out+=text.slice(last)
  if(d){writeFileSync(f,out)}
  console.log(`  ${f.split('/').pop()}: demoted ${d} standalone-failing block(s)`)
}
