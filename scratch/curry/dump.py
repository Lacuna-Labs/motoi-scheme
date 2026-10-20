import sys, importlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import cells, run
for m in sys.argv[1:]:
    for v in importlib.import_module(m).VERBS:
        for label, code in cells(v):
            ok, out = run(code)
            print('%-18s %-28s %s' % (v['name'], label, out.replace('\n',' | ')))
