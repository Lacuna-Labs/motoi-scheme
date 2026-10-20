import json
reps=json.load(open('/Users/alfred/code/motoi-scheme/scratch/fix426-replacements.json'))
why=("Row-3 rung :code authored as a cross-domain metaphor fragment (Curator-dialect verb "
     "or bare notation) that names an undefined free variable / unbound symbol when run in base Motoi.")
lesson=("Reference code must run. A rung that names an undefined variable or a non-base-dialect verb "
        "is not a runnable program. Replace it with a runnable example cribbed from the same verb's own "
        "verified-passing programs while keeping the :domain framing. The eventual chapter rewrite may "
        "restore a distinct cross-domain example; this is the runnable stopgap.")
path='/Users/alfred/code/motoi-scheme/scheme/reference/broken-examples/rung-residue-2026-07-25.jsonl'
with open(path,'w') as out:
    for e in reps:
        rec={'file':e['file'],'verb':e['verb'],'domain':e['domain'],
             'broken_code':e['old'],'unbound_symbol':e['sym'],
             'why':why,'fix':e['new'],'lesson':lesson}
        out.write(json.dumps(rec)+"\n")
print('preserved',len(reps),'broken originals ->',path)
