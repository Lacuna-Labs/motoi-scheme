import subprocess, sys, os, tempfile
ROOT='/Users/alfred/code/motoi-scheme'
HOME=tempfile.mkdtemp(prefix='abel-home-')
ENV={**os.environ,'MOTOI_HOME':HOME}
def run(code):
    p=f'{ROOT}/scratch/abel-numeric/_t.scm'
    open(p,'w').write(code)
    r=subprocess.run([f'{ROOT}/bin/motoi','run',p],capture_output=True,text=True,cwd=ROOT,env=ENV,timeout=30)
    return (r.stdout+r.stderr).strip()
for line in sys.stdin.read().split('\n'):
    line=line.strip()
    if not line: continue
    print(f'{line}\n    => {run(line)}')
