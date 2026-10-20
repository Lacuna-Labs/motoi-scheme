import re, sys

path=sys.argv[1]
t=open(path).read()

def fix(m):
    body=m.group(1)
    body=body.replace('[','(').replace(']',')')
    return "```scheme\n"+body+"```"

new=re.sub(r"```scheme\n(.*?)```", fix, t, flags=re.S)
if new!=t:
    open(path,"w").write(new)
    print("debracketed:",path)
else:
    print("no change:",path)
