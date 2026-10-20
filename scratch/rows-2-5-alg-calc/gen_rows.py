#!/usr/bin/env python3
"""Generate verb-tailored row-2..row-5 records from a per-verb dictionary.

Each verb has fields:
  cat     : the mathematical category (group, perm, pcset, ring, calc-1d, calc-nd, ...)
  claim4  : one-line algebraic invariant for row-4
  formal4 : ∀-notation for the invariant
  prog4   : Scheme program that tests the invariant
  chain5  : one line of Scheme chaining this verb with 1-2 others
  emerges : one-word emergent pattern name (cache, orbit, quotient, ...)
  family  : familiar-analog citation for row-5 meta
  problem : a real operator problem for row-2
  prog2   : Scheme program solving that problem
  sibling : sibling verb that would have failed the audit
  shape3  : short name of the shape at play in row-3
  rung2   : metaphor domain rung and code
  rung3   : math/logic domain rung and code
  math-book: book-of-math chapter number and title
  more-books: optional list of extra book cites

The generator wraps each field in the SLAT keyword syntax and produces four
row records. Programs come verbatim; meta sentences are stitched.
"""
import sys
from pathlib import Path


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')


def emit(v):
    name = v['name']
    cat = v['cat']
    lib = name.split('/')[0]

    # Row 2 — audit
    p2 = v['problem']
    prog2 = v['prog2']
    exp2 = v.get('exp2', f"The program uses {name} to solve the stated problem; the operator inspects the output and confirms the audit lane's expectation.")
    meta2 = v.get('meta2', f"The sibling {v['sibling']} would have looked plausible here but would fail the audit — see caveats. {name} is the honest answer because it directly encodes the operator's requirement.")
    eng2 = v.get('eng2', f"The operator gets one line per call; failure surfaces the exact input that broke the expectation.")
    math2 = v.get('math2', f"Category: {cat}; the verb operates within its declared algebraic type.")
    cs2 = v.get('cs2', f"Complexity as declared in the signature; deterministic and testable.")

    # Row 3 — dimension
    shape = v['shape3']
    rung1_code = v.get('rung1', v['prog2'].split('\n')[0])
    rung2_dom, rung2_code = v['rung2']
    rung3_dom, rung3_code = v['rung3']
    exp3 = v.get('exp3', f"Rung 1 is {name} in its native library. Rung 2 shows the same '{shape}' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover.")
    meta3 = v.get('meta3', f"The shape transfers because '{shape}' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    eng3 = v.get('eng3', f"Engineers who have met the shape elsewhere already know when to reach for {name}.")
    math3 = v.get('math3', f"The shape is captured by a small equation set; each rung is a model of that equation set.")
    cs3 = v.get('cs3', f"Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung.")

    # Row 4 — proof
    claim = v['claim4']
    prog4 = v['prog4']
    inv = v['formal4']
    math_book = v.get('math_book', 'ch-advanced-04 (Groups & Symmetry)')
    more_books = v.get('more_books', '')
    meta4 = v.get('meta4', f"The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math {math_book}.{(' Also ' + more_books) if more_books else ''}")
    eng4 = v.get('eng4', f"The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted.")
    math4 = v.get('math4', f"The invariant is the {v.get('cs_pattern', 'defining property')} in the {cat} category.")
    cs4 = v.get('cs4', f"Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer.")

    # Row 5 — emergence
    chain = v['chain5']
    emerges = v['emerges']
    family = v.get('family', f"See book-of-composition for the composition pattern; see book-of-code for the CS family.")
    base5 = v.get('base5', f"{name} — see :summary.")
    meta5 = v.get('meta5', f"The emergent {emerges} belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. {family}")
    eng5 = v.get('eng5', f"The composition is short enough to inline in a callsite yet meaningful enough to name and reuse.")
    math5 = v.get('math5', f"Under composition, the {cat} operations close into the {emerges} pattern.")
    cs5 = v.get('cs5', f"The emergent {emerges} is a first-class named pattern; recognize it once and it reappears everywhere.")

    def block(s):
        return '"' + esc(s) + '"'

    def prog(s):
        # Preserve newlines as \n in the string literal.
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'

    out = f'''  :row-2-audit (
    (:problem {block(p2)}
     :program {prog(prog2)}
     :explanation {block(exp2)}
     :meta {block(meta2)})
    (:eng {block(eng2)}
     :math {block(math2)}
     :cs {block(cs2)}))
  :row-3-dimension (
    (:setup {block(shape)}
     :rungs (
       (:domain "{lib} native" :code {prog(rung1_code)})
       (:domain "{esc(rung2_dom)}" :code {prog(rung2_code)})
       (:domain "{esc(rung3_dom)}" :code {prog(rung3_code)}))
     :explanation {block(exp3)}
     :meta {block(meta3)})
    (:eng {block(eng3)}
     :math {block(math3)}
     :cs {block(cs3)}))
  :row-4-proof (
    (:claim {block(claim)}
     :program {prog(prog4)}
     :invariant {block(inv)}
     :meta {block(meta4)})
    (:eng {block(eng4)}
     :math {block(math4)}
     :cs {block(cs4)}))
  :row-5-emergence (
    (:base {block(base5)}
     :composition {prog(chain)}
     :emergent {block(emerges)}
     :meta {block(meta5)})
    (:eng {block(eng5)}
     :math {block(math5)}
     :cs {block(cs5)}))'''
    return out


def build(verbs):
    return {v['name']: emit(v) for v in verbs}
