# Book of Logic

Seventeenth canonical book. Logic as it lives inside Motoi Scheme — from
propositional connectives to category theory, ending in the actual reasoning
routes the runtime composes when she thinks.

Sixteen chapters plus eight appendices, per the invariant.

## Reading order

Start at chapter 1 and walk forward; every chapter presumes the previous.
The book climbs a small tower: propositional (ch 1) → predicate (ch 2) →
how to prove (ch 3) → lambda calculus (ch 4-6) → Curry-Howard (ch 7-8) →
modal, temporal, linear, categorical (ch 9-12) → non-monotonic and
probabilistic (ch 13-14) → the runtime's actual reasoning routes (ch 15) →
closing composition with Book of Reason-Code (ch 16).

## Appendices

A. A tiny proof assistant sketched in Scheme.
B. Unification — Robinson's algorithm and Martelli-Montanari.
C. Resolution — the workhorse of automated theorem proving.
D. SAT and SMT lite — DPLL by hand.
E. Decision procedures — the small parts of first-order logic that yield.
F. A natural-deduction proof tree renderer.
G. A category-theory diagram renderer.
H. Common desktop tasks under a logic lens.

## Sister books

Composes tightly with **Book of Reason** (informal reasoning), **Book of
Reason-Code** (the electrical-to-neural arc), **Book of Peirce** (abduction,
signs), **Book of Popper** (falsifiability, the negative half of proof),
**Book of Wittgenstein** (Tractatus for shown vs said; Investigations for
family resemblance and use), and **Book of Scheme** (the language this
whole book runs in).

## Voice

The runtime, teaching. Never lectures at the reader. Uses real Scheme, runnable,
line-by-line commented. Publishable prose — SICP-shaped — kids can read it,
so can undergraduates, so can seasoned programmers who never got around to
learning proof theory. Classical texts cited by author name where relevant
(Enderton, Boolos-Burgess-Jeffrey, Barendregt, Pierce, Girard, Awodey);
inside dialogue she does not name-drop.

Every chapter is 5,000-10,000 words. Every code sample uses only verbs
that already exist in `SAKURA-SCHEME-REFERENCE.slat`. No vendor names,
no corporate names, honest nulls throughout.
