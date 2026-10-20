# -*- coding: utf-8 -*-
import json
D = json.load(open('/tmp/cxr-data.json'))
ORD = {1:"first",2:"second",3:"third",4:"fourth",5:"fifth"}

# Per-verb hand-written domain material. Keyed by verb.
# (domain-noun-phrase, scenario, metaphor-domain, metaphor-code-vars, math-reading)
DOM = {
 "caar":   ("an alist of settings", "reading the KEY of the first entry of an alist", "the first word on the first line of a form", "the (1,1) entry of a matrix stored as a list of rows"),
 "cdar":   ("an alist entry with a multi-part value", "stripping the label off the first record and keeping the fields", "the first line of a form with its printed label removed", "row 1 of a matrix from column 2 onward"),
 "caaar":  ("paragraphs of lines of words", "reading the first word of the first line of the first paragraph", "the first letter of the first word of the first line", "the (1,1,1) entry of a rank-3 array"),
 "caadr":  ("a table stored as a list of rows", "reading the first cell of the SECOND row", "the first name on the second page of a register", "the entry a(2,1) of a matrix"),
 "cadar":  ("an alist whose entries are (key value) lists", "reading the VALUE out of the first (key value) entry", "the amount written on the first line of a receipt", "the entry a(1,2) of a matrix"),
 "cdaar":  ("frames of rows of channels", "keeping everything after the head of the first inner group", "the first verse of the first song, minus its opening line", "the fibre (1,1) of a rank-3 array from index 2 onward"),
 "cdadr":  ("a table stored as a list of rows", "dropping the label from the second row and keeping its data", "the second line of a table with its row-heading removed", "row 2 of a matrix from column 2 onward"),
 "cddar":  ("records with a two-field header", "dropping a two-field header off the first record", "the first shipping label with sender and recipient removed", "row 1 of a matrix from column 3 onward"),
 "cdddr":  ("a flat list walked three at a time", "advancing past one RGB triple in a flat channel stream", "uncoupling three carriages from the front of a train", "a sequence shifted by three, running from a4"),
 "caaaar": ("a sprite sheet: frames of rows of pixels of channels", "reading the red channel of the top-left pixel of the first row of the first frame", "the first letter of the first word of the first line of the first page", "the entry a(1,1,1,1) of a rank-4 array"),
 "caaadr": ("a sprite sheet of frames", "reading the first channel of the first pixel of the first row of the SECOND frame", "the first letter of the first word of the first line of page two", "the entry a(2,1,1) of a rank-3 array"),
 "caadar": ("a frame of rows of pixels", "reading the first channel of the first pixel of the SECOND row", "the first letter of the first word on the second line", "the entry a(1,2,1) of a rank-3 array"),
 "caaddr": ("a table stored as a list of rows", "reading the first cell of the THIRD row", "the first name on the third page of a register", "the entry a(3,1) of a matrix"),
 "cadaar": ("frames of rows of channels", "reading the GREEN channel of the first pixel of the first row", "the second note of the first bar of the first part", "the entry a(1,1,2) of a rank-3 array"),
 "cadadr": ("a table stored as a list of rows", "reading the second cell of the second row -- the diagonal entry", "the second column of the second line of a ledger", "the diagonal entry a(2,2) of a matrix"),
 "caddar": ("records with a three-field prefix", "reading the third field of the first record", "the third item on the first shelf", "the entry a(1,3) of a matrix"),
 "cadddr": ("a flat list", "reading the FOURTH element of a flat list", "the fourth carriage of a train", "the term a4 of a sequence"),
 "cdaaar": ("a sprite sheet: frames of rows of pixels of channels", "keeping the green and blue channels of the top-left pixel of the first frame", "the first line of the first verse of the first song, minus its first word", "the fibre (1,1,1) of a rank-4 array from index 2 onward"),
 "cdaadr": ("a sprite sheet of frames of rows", "keeping the second frame's first row minus its first pixel", "the second page's first line minus its first word", "the fibre (2,1) of a rank-3 array from index 2 onward"),
 "cdadar": ("a frame of rows of pixels", "keeping the second row of the first frame minus its first pixel", "the second line of the first page minus its opening word", "the fibre (1,2) of a rank-3 array from index 2 onward"),
 "cdaddr": ("a table stored as a list of rows", "keeping the third row minus its label cell", "the third line of a table with its row-heading removed", "row 3 of a matrix from column 2 onward"),
 "cddaar": ("frames of rows with a two-cell prefix", "dropping a two-cell prefix from the first row of the first frame", "the first verse of the first song minus its two opening lines", "the fibre (1,1) of a rank-3 array from index 3 onward"),
 "cddadr": ("a table whose rows carry a two-cell header", "dropping a two-cell header from the second row", "the second shipping label minus sender and recipient", "row 2 of a matrix from column 3 onward"),
 "cdddar": ("records with a three-field header", "dropping a three-field header off the first record", "the first form with its three heading lines torn off", "row 1 of a matrix from column 4 onward"),
 "cddddr": ("a flat list walked four at a time", "advancing past one RGBA quad in a flat channel stream", "uncoupling four carriages from the front of a train", "a sequence shifted by four, running from a5"),
}

def segments(ops):
    s=[0]
    for c in ops:
        if c=='d': s[-1]+=1
        else: s.append(0)
    return s

def gloss(name):
    o=D[name]['ops']; s=segments(o); k=len(s)-1
    parts=[]
    for i in range(k):
        parts.append("take the %s item" % ORD[s[i]+1])
    if s[-1]:
        parts.append("then drop the first %d" % s[-1])
    return ", ".join(parts) if parts else "drop the first %d" % s[-1]

def expansion(name, x):
    e = x
    for ch in reversed(name[1:-1]):
        e = "(c%sr %s)" % (ch, e)
    return e

def esc(s):
    return s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n')

def neighbours(name):
    """One-letter-different siblings that actually exist."""
    letters=name[1:-1]; out=[]
    for i in range(len(letters)):
        for c in 'ad':
            if c!=letters[i]:
                cand='c'+letters[:i]+c+letters[i+1:]+'r'
                out.append(cand)
    # shorter/longer relatives
    out += ['c'+letters[1:]+'r', 'car', 'cdr', 'list-ref', 'list-tail']
    seen=[];
    for x in out:
        if x!=name and x not in seen and len(x)>=3: seen.append(x)
    return seen[:6]

WALKER = ("(define (walk path x)\n"
          "  (cond ((null? path) x)\n"
          "        ((not (pair? x)) 'no-such-path)\n"
          "        ((eq? (car path) 'a) (walk (cdr path) (car x)))\n"
          "        (else (walk (cdr path) (cdr x)))))")

def record(name):
    d = D[name]
    ops = d['ops']; letters = d['letters']; depth = d['depth']
    IN, OUT = d['input'], d['out']
    tail = d['result_is_tail']; alld = d['all_d']
    opsq = "'(" + " ".join(ops) + ")"
    exp_in  = expansion(name, "'%s" % IN)
    exp_emp = expansion(name, "'()")
    g = gloss(name)
    dom, scen, met, mat = DOM[name]
    shape = "a LIST (a tail)" if tail else "an ELEMENT"
    reading = " then ".join("c%sr" % c for c in ops)
    # boundary wording, from OBSERVED behaviour
    if alld:
        empty_probe = "(%s '())" % name
        empty_word  = "the empty list"
        empty_note  = ("On a list too short to walk, %s answers '() -- it does not raise. "
                       "R7RS-small 6.4.1 defines it as %s, and that expansion RAISES, "
                       "because (cdr '()) raises." % (name, expansion(name, "pair")))
    else:
        empty_probe = "(if (%s '()) 'truthy-NON-VALUE 'false)" % name
        empty_word  = "a truthy NON-VALUE"
        empty_note  = ("On a mis-shaped input %s answers a value that is neither a pair nor '() "
                       "and yet is TRUE in an if -- a non-value. R7RS-small 6.4.1 defines it as %s, "
                       "and that expansion RAISES." % (name, expansion(name, "pair")))
    cs_probe = ("(display (list 'legal (%s '%s)\n"
                "               'on-empty %s\n"
                "               'r7rs-expansion (guard (e (#t 'raised)) %s)))\n(newline)"
                % (name, IN, empty_probe, exp_emp))
    R = []
    A = R.append
    A('(verb')
    A('  :name "%s" :std "R7RS-small"' % name)
    A('  :library "list"')
    A('  :tier "core"')
    A('  :kind "pure"')
    A('  :signature "(%s pair) -> object"' % name)
    A('  :summary "%s"' % esc(
        "%s: %s. Reads as %s, and answers %s."
        % (name, g, reading, shape)))
    A('  :explanation "%s"' % esc(
        "One of the twenty-eight composed accessors of R7RS-small 6.4.1. Decode the name by dropping the "
        "leading c and the trailing r, then reading the %d letters RIGHT TO LEFT: %s gives %s -- %s. "
        "Written out it is %s. The %s tells you the answer is %s: a name whose leftmost letter is a "
        "answers an element, a name whose leftmost letter is d answers the rest of a list. "
        "You meet it on %s, where the job is %s. "
        "%s That is a divergence from the standard and it is why this record is flagged: a walk that "
        "over-reaches will not stop, it will hand you something you cannot print and that passes an if. "
        "Two neighbouring jobs get mistaken for this one. For a depth that is not fixed, list-ref (for an "
        "element) or list-tail (for a tail) takes the number instead of spelling it in letters. For a path "
        "that mixes both, write the %d steps out as car and cdr -- they raise where the standard says to."
        % (depth, letters, " then ".join("c%sr" % c for c in ops), g,
           expansion(name, "pair"), "leading letter %s" % letters[0], shape,
           dom, scen, empty_note, depth)))
    A('  :examples (')
    A('    (:dialect "motoi" :tier "novice" :code "%s" :note "%s")'
      % (esc("(%s '%s)" % (name, IN)),
         esc(("%s. %s." % (OUT, g[0].upper()+g[1:])) if not OUT.startswith("(")
             else ("%s -- %s." % (OUT, g)))))
    A('    (:dialect "motoi" :tier "intermediate" :code "%s" :note "%s")'
      % (esc("(equal? (%s '%s) %s)" % (name, IN, exp_in)),
         esc("#t -- on a WELL-SHAPED input %s agrees exactly with its R7RS expansion %s. "
             "The agreement is what the name promises; the next example is where it breaks."
             % (name, expansion(name, "x")))))
    A('    (:dialect "motoi" :tier "expert" :code "%s" :note "%s")'
      % (esc(cs_probe),
         esc("The boundary, run three ways. The legal input answers %s. The empty list answers %s "
             "instead of raising. The spelled-out expansion beside it DOES raise. Keep your own "
             "pair? or null? guard; %s will not stop you." % (OUT, empty_word, name))))
    A('  )')
    cav = ['"%s"' % esc("Read the letters right to left after dropping c and r: %s means %s." % (letters, reading)),
           '"%s"' % esc("%s answers %s, because its leftmost letter is %s." % (name, shape, letters[0])),
           '"%s"' % esc("DIVERGENCE from R7RS-small 6.4.1: %s Guard the shape yourself." % empty_note),
           '"%s"' % esc("The argument must be nested at least %d deep along this exact path; a flat list of the right length is NOT enough." % depth)]
    if tail:
        cav.append('"%s"' % esc("An empty result is a legitimate answer here, not a failure -- it means the input had exactly enough to drop and nothing after."))
    else:
        cav.append('"%s"' % esc("Because the answer is an element, a caller cannot tell a real answer from an over-reach by looking at its shape. Test before you reach."))
    A('  :caveats (%s)' % " ".join(cav))
    A('  :usecases ("%s" "%s" "%s")' % (
        esc(scen[0].upper() + scen[1:] + "."),
        esc("Naming one fixed path into %s so the call site reads as a coordinate." % dom),
        esc("Replacing %d hand-written car/cdr calls with one name." % depth)))
    A('  :related (%s)' % " ".join('"%s"' % x for x in neighbours(name)))
    A('  :learn (:concept "%s" :prerequisites ("car" "cdr") :progression "%s")' % (
        esc("A composed accessor: %d car/cdr steps fused into one name, decoded right to left." % depth),
        esc("Learn car and cdr, then write %s out by hand as %s, then use the short name -- and keep the guard you would have written anyway." % (name, expansion(name, "x")))))
    A('  :status "needs-alfred"')
    A('  :provenance "%s"' % esc(
        "R7RS-small 6.4.1; reference record added 2026-08-02, every example executed. "
        "FLAGGED: R7RS-small defines %s as %s, and that expansion raises on a mis-shaped input. "
        "Motoi's %s does not raise -- %s Verified by execution 2026-08-02."
        % (name, expansion(name, "pair"), name,
           "it answers '()." if alld else "it answers a truthy non-value that is neither a pair nor '().")))
    # ── row 2 ──
    A('  :row-2-audit (')
    A('    (:eng-program "%s"' % esc(
        "(define data '%s)\n(define (pick s) (%s s))\n(display (list 'path '%s 'gives (pick data)))\n(newline)" % (IN, name, letters)))
    A('     :math-program "%s"' % esc(
        "(define (agrees? x) (equal? (%s x) %s))\n(display (agrees? '%s))\n(newline)" % (name, expansion(name, "x"), IN)))
    A('     :cs-program "%s"' % esc(cs_probe))
    A('     :problem "%s"' % esc(
        "The operator is working with %s and needs one fixed spot: %s. Candidates: %s (one name, %d steps, "
        "and the reader must decode the letters), the spelled-out chain %s (identical on well-shaped input "
        "and correctly strict on everything else), or list-ref / list-tail when the depth is a number rather "
        "than a shape. For a path that is fixed at authoring time and short, %s is the honest verb -- with "
        "the standing caveat that it will not raise when the shape is wrong."
        % (dom, scen, name, depth, expansion(name, "x"), name)))
    A('     :explanation "%s"' % esc(
        "eng: %s, named once at the call site. math: the same reach written as %s and compared -- they agree "
        "on well-shaped input. cs: the boundary probe, which is where the two stop agreeing."
        % (scen, expansion(name, "x"))))
    A('     :meta "%s")' % esc(
        "Why %s and not the spelled-out chain: %d nested calls read as machinery, one name reads as a "
        "coordinate. Why you still write the guard: only the chain is strict." % (name, depth)))
    A('    (:eng "%s"' % esc("Name a fixed path once; recompute it nowhere. But never let the accessor be your shape check."))
    A('     :math "%s"' % esc("%s is the composition %s, and %s." % (name, reading, mat)))
    A('     :cs "%s"))' % esc("A composed accessor is only as safe as its least-defined step, and this family drops that guarantee."))
    # ── row 3 ──
    A('  :row-3-dimension (')
    A('    (:setup "%s"' % esc("%s -- one fixed route into a nested arrangement, taken in %d steps." % (g[0].upper()+g[1:], depth)))
    A('     :rungs ((:domain "list" :code "%s")' % esc("(%s '%s)" % (name, IN)))
    A('             (:domain "%s" :code "%s")' % (esc(met), esc(
        "(define page '%s)\n(display (list 'reached (%s page)))\n(newline)" % (IN, name))))
    A('             (:domain "%s" :code "%s"))' % (esc(mat), esc(
        "(define arr '%s)\n(display (list 'index '%s 'entry (%s arr) 'same (equal? (%s arr) %s)))\n(newline)"
        % (IN, letters, name, name, expansion(name, "arr")))))
    A('     :explanation "%s"' % esc(
        "In list, %s takes the route %s. In the everyday reading it is %s -- the same route, walked through "
        "something you can point at. In mathematics it is %s. All three share: a nesting deep enough to have "
        "levels, a route named once, and an answer that is %s."
        % (name, letters, met, mat, shape)))
    A('     :meta "%s"' % esc(
        "What transfers is the ROUTE, not the data. What does not transfer is safety: a page you can point "
        "at tells you when you have run off the end, and this accessor does not."))
    A('    )')
    A('    (:eng "%s"' % esc("A fixed route deserves a name; a variable route deserves a number and list-ref."))
    A('     :math "%s"' % esc("Indexing a nested structure is function composition, and composing partial functions narrows the domain at every step."))
    A('     :cs "%s"))' % esc("Related patterns: x[0][0] chains in Python (which raise), .flatMap in JS (which does not), and Haskell's fst/snd (total, because the tuple type guarantees the shape)."))
    # ── row 4 ──
    A('  :row-4-proof (')
    A('    (:eng-program "%s"' % esc(
        "(display (list 'matches-expansion (equal? (%s '%s) %s)\n               'answer (%s '%s)))\n(newline)"
        % (name, IN, exp_in, name, IN)))
    A('     :math-program "%s"' % esc(
        "%s\n(display (list 'walker (walk %s '%s)\n               'verb (%s '%s)\n               'same (equal? (walk %s '%s) (%s '%s))))\n(newline)"
        % (WALKER, opsq, IN, name, IN, opsq, IN, name, IN)))
    A('     :cs-program "%s"' % esc(
        "%s\n(display (list 'verb-on-empty %s\n               'walker-on-empty (walk %s '())\n               'expansion-on-empty (guard (e (#t 'raised)) %s)))\n(newline)"
        % (WALKER, empty_probe, opsq, exp_emp)))
    A('     :claim "%s"' % esc(
        "On any input nested deeply enough along the route %s, %s equals its R7RS expansion %s and equals a "
        "hand-written path walker. Below that depth the three part company: the expansion raises, the walker "
        "reports 'no-such-path, and %s %s"
        % (letters, name, expansion(name, "x"), name,
           "answers '()." if alld else "answers a truthy non-value.")))
    A('     :invariant "%s"' % esc(
        "For all x nested at least %d deep along %s. %s(x) = %s = walk(%s, x). Outside that domain the identity FAILS in Motoi"
        % (depth, letters, name, expansion(name, "x"), letters)))
    A('     :meta "%s"' % esc(
        "The pattern is a composed accessor proved against two independent spellings of the same route. What "
        "would falsify it: a disagreement with the expansion on a well-shaped input. The third program is the "
        "evidence for the :status flag -- three spellings of one route, three different answers off-domain."))
    A('    )')
    A('    (:eng "%s"' % esc("State the domain with the invariant. An identity asserted more widely than it holds is worse than none."))
    A('     :math "%s"' % esc("Composition of partial functions is defined only where every step is; a looser composition is a different function wearing the same name."))
    A('     :cs "%s"))' % esc("Two independent implementations of one route make a differential test, and differential tests are how silent divergences surface."))
    # ── row 5 ──
    A('  :row-5-emergence (')
    A('    (:eng-composition "%s"' % esc(
        "%s\n(define (safe-%s x) (walk %s x))\n(display (list 'legal (safe-%s '%s) 'broken (safe-%s '())))\n(newline)"
        % (WALKER, name, opsq, name, IN, name)))
    A('     :math-composition "%s"' % esc(
        "%s\n(define (route-agrees? path x verb) (equal? (walk path x) (verb x)))\n(display (route-agrees? %s '%s %s))\n(newline)"
        % (WALKER, opsq, IN, name)))
    A('     :cs-composition "%s"' % esc(
        "%s\n(display (map (lambda (p) (walk p '%s)) (list %s '(a) '(d))))\n(newline)" % (WALKER, IN, opsq)))
    A('     :base "%s"' % esc("%s walks the fixed route %s and answers %s." % (name, letters, shape)))
    A('     :emergent "%s"' % esc(
        "eng: a TOTAL version of %s -- the same route, taken one step at a time, with a named sentinel where "
        "the shape runs out. math: the route as data, checked against the verb, which is the differential test "
        "written as a function. cs: one walker serves the whole family, because the route is an argument rather "
        "than part of the name." % name))
    A('     :emergent-name "the path walker"')
    A('     :meta "%s"' % esc(
        "The composition is car and cdr plus an explicit pair? test plus the route as a list. What emerges is "
        "the accessor-as-data family: %s is one frozen instance of walk, and there are twenty-eight of them in "
        "R7RS-small. Freezing the route buys brevity and costs you the error." % name))
    A('    )')
    A('    (:eng "%s"' % esc("When a library accessor is looser than the standard says, wrap it once with a sentinel rather than guarding at every call site."))
    A('     :math "%s"' % esc("Turning an index into an argument turns twenty-eight functions into one function of two arguments."))
    A('     :cs "%s"))' % esc("A sentinel you chose beats a non-value you did not: 'no-such-path prints, compares and fails loudly."))
    A(')')
    return "\n".join(R)

if __name__ == '__main__':
    import sys
    names = sys.argv[1:]
    print("\n\n".join(record(n) for n in names))
