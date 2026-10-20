import json
reps=json.load(open('/Users/alfred/code/motoi-scheme/scratch/fix924-replacements.json'))
why="Row-3 rung :code authored as a pseudo-code fragment with undefined free variable(s); errors with unbound symbol when run in base Motoi."
lesson=("Reference code must run. A rung that names an undefined variable is not a program. "
        "Replace it with a runnable example (here cribbed from the same verb's own verified-passing "
        "programs) while keeping the :domain framing.")
path='/Users/alfred/code/motoi-scheme/scheme/reference/broken-examples/rung-freevar-fragments-2026-07-25.jsonl'
with open(path,'w') as out:
    for e in reps:
        rec={'file':e['file'],'verb':e['verb'],'domain':e['domain'],
             'broken_code':e['old'],'unbound_symbol':e['sym'],
             'why':why,'fix':e['new'],'lesson':lesson}
        out.write(json.dumps(rec)+"\n")
print('preserved',len(reps),'broken originals ->',path)
