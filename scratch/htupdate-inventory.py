import sys, glob, re
sys.argv = ['x']
import importlib.util
spec = importlib.util.spec_from_file_location("m", "scratch/htref-migrate.py")
m = importlib.util.module_from_spec(spec)
# prevent main() running
src = open("scratch/htref-migrate.py").read().replace("if __name__ == \"__main__\":\n    main()","")
exec(compile(src, "htref", "exec"), m.__dict__)

HEAD="hash-table-update!"
files = m.target_files()
n3=n4_plain=n4_thunk=n5=0
sites=[]
for f in files:
    text=open(f).read()
    for (a,b,call) in m.find_calls(text, HEAD):
        args=m.split_args(call, HEAD)
        argc=len(args)
        if argc==3:
            n3+=1; sites.append((f,"3ARG(raises-if-miss): "+call[:80]))
        elif argc==4:
            if args[3].startswith("(lambda"):
                n4_thunk+=1
            else:
                n4_plain+=1; sites.append((f,"4ARG-PLAIN->/default: "+call[:80]))
        elif argc>=5:
            n5+=1; sites.append((f,"5ARG: "+call[:80]))
print(f"3-arg (strict raise): {n3}")
print(f"4-arg plain -> /default: {n4_plain}")
print(f"4-arg thunk (strict): {n4_thunk}")
print(f"5-arg: {n5}")
print("--- sites needing review ---")
for f,c in sites:
    print(f"  {f}\n    {c}")
