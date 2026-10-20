import re, sys, subprocess, os, glob

os.chdir('/Users/alfred/code/motoi-scheme')
files = sorted(glob.glob('scheme-books/book-of-animation/*.slatl'))
target = sys.argv[1] if len(sys.argv) > 1 else None

for f in files:
    if target and target not in f:
        continue
    lines = open(f).read().split('\n')
    i = 0
    blocks = []
    while i < len(lines):
        if lines[i].strip() == '```scheme':
            start = i+1
            j = i+1
            while j < len(lines) and lines[j].strip() != '```':
                j += 1
            blocks.append((start+1, lines[start:j]))  # 1-based start line
            i = j+1
        else:
            i += 1
    for (ln, body) in blocks:
        code = '\n'.join(body).replace('\\"', '"')
        with open('scratch/_blk.scm','w') as fh:
            fh.write(code)
        r = subprocess.run(['./bin/motoi','run','scratch/_blk.scm'],
                           capture_output=True, text=True, timeout=30)
        out = (r.stdout+r.stderr)
        status = 'OK'
        if 'unbound symbol' in out:
            status = 'FAIL'
        elif 'error:' in out:
            status = 'ERR'
        if status != 'OK':
            print(f'=== {f}:{ln} [{status}] ===')
            print(code)
            print('--- output ---')
            print(out.strip()[:400])
            print()
