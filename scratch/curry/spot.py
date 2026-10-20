import sys, importlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import run
for m in sys.argv[1:]:
    for v in importlib.import_module(m).VERBS:
        for tier, code, note in v['examples']:
            ok, out = run(code)
            print('=== %s / %s ===' % (v['name'], tier))
            print('NOTE: %s' % note)
            print('OUT : %s' % out.replace('\n', ' | '))
            print()
