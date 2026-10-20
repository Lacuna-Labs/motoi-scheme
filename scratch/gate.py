import re,sys,subprocess,tempfile,os
f=sys.argv[1]
raw=open(f,encoding='utf-8').read()
# grab prose string content between :prose " ... " (last quoted block)
m=re.search(r':prose\s*"(.*)"\s*\)\s*$',raw,re.S)
prose=m.group(1)
prose=prose.replace('\\"','"').replace('\\\\','\\')
blocks=re.findall(r'```motoi\n(.*?)```',prose,re.S)
print(f"{len(blocks)} motoi blocks")
allok=True
for i,b in enumerate(blocks,1):
    code=b
    if code.count('(')!=code.count(')'):
        print(f"  block {i}: PAREN IMBALANCE ({code.count('(')} vs {code.count(')')})"); allok=False; continue
    with tempfile.NamedTemporaryFile('w',suffix='.scm',delete=False) as t:
        t.write(code); p=t.name
    r=subprocess.run(['./bin/motoi','run',p],capture_output=True,text=True)
    os.unlink(p)
    out=(r.stdout+r.stderr).strip()
    status='OK' if r.returncode==0 else 'FAIL'
    if r.returncode!=0: allok=False
    print(f"  block {i}: {status} -> {out!r}")
sys.exit(0 if allok else 1)
