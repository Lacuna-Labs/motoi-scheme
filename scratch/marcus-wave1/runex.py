import os, subprocess, sys, json, tempfile
ROOT='/Users/alfred/code/motoi-scheme'
HOME=open('/tmp/marcus-home.txt').read().strip()
ENV={**os.environ,'MOTOI_HOME':HOME}
def run(code):
    p=f'/tmp/marcus-ex-{os.getpid()}.scm'
    open(p,'w').write(code)
    r=subprocess.run([f'{ROOT}/bin/motoi','run',p],capture_output=True,text=True,cwd=ROOT,env=ENV,timeout=30)
    os.unlink(p)
    return (r.stdout+r.stderr).strip(), r.returncode
if __name__=='__main__':
    cases=json.load(open(sys.argv[1]))
    for name,code in cases:
        out,rc=run(code)
        print(f'--- {name}  [rc={rc}]')
        print(f'  CODE  : {code}')
        print(f'  OUTPUT: {out!r}')
