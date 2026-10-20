import re, glob, os
# map library -> (impl files, reference chapter)
libs = {
  'artifact': (['lib/system/artifact.js'], 'scheme/reference/05-artifact.slat'),
  'cortex':   (['lib/ai/cortex.js','lib/ai/cortex-io.js'], 'scheme/reference/19-cortex.slat'),
  'entity':   (['lib/game/world.js','lib/game/game.js'], 'scheme/reference/24-entity.slat'),
  'matrix':   (['lib/math/matrix.js'], 'scheme/reference/41-matrix.slat'),
  'animation':(glob.glob('lib/**/*.js', recursive=True), 'scheme/reference/04-animation.slat'),
  'world':    (['lib/game/world.js','lib/game/game.js'], 'scheme/reference/72-world.slat'),
  'easing':   (glob.glob('lib/**/*.js', recursive=True), 'scheme/reference/22-easing.slat'),
  'text':     (glob.glob('lib/**/*.js', recursive=True), 'scheme/reference/64-text.slat'),
  'ai':       (['lib/ai/ai.js'], 'scheme/reference/02-ai.slat'),
  'sprite':   (glob.glob('lib/**/*.js', recursive=True), 'scheme/reference/58-sprite.slat'),
  'floor':    (glob.glob('lib/**/*.js', recursive=True), 'scheme/reference/27-floor.slat'),
  'transport':(glob.glob('lib/**/*.js', recursive=True), 'scheme/reference/68-transport.slat'),
}
defpat = re.compile(r"""(?:def|define|register|env\.set)\(\s*['"]([a-zA-Z0-9/?!*_+.<>=-]+)['"]""")
def wired_for(prefix, files):
    s=set()
    for f in files:
        if not os.path.exists(f): continue
        for m in defpat.finditer(open(f,encoding='utf-8',errors='ignore').read()):
            n=m.group(1)
            if n.startswith(prefix+'/') or (prefix in ('animation','easing','text','sprite','floor','transport') and (n.startswith(prefix+'/'))):
                s.add(n)
    return s
def documented(chapter):
    if not os.path.exists(chapter): return set()
    return set(re.findall(r':name\s+"([^"]+)"', open(chapter,encoding='utf-8').read()))
total=0
for lib,(files,chap) in libs.items():
    w=wired_for(lib,files)
    d=documented(chap)
    gap=sorted(w-d)
    print(f"### {lib}: wired={len(w)} documented={len(d)} GAP={len(gap)}")
    for g in gap: print("   ",g)
    total+=len(gap)
print("TOTAL GAP:",total)
