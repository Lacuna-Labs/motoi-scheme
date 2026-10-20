import json,sys
d=json.load(open('scratch/audit-run.json'))
det=d['details']
want_file=sys.argv[1] if len(sys.argv)>1 else None
want_verb=sys.argv[2] if len(sys.argv)>2 else None
for cat,items in det.items():
    for r in items:
        if want_file and r['file']!=want_file: continue
        if want_verb and r['verb']!=want_verb: continue
        print(f"### {cat} | {r['file']} | {r['verb']} | {r['key']}")
        print(f"# info: {r['info'][:120]}")
        print(r['code'])
        print("="*60)
