#!/usr/bin/env python3
"""rewrite-stale-tower-prose.py — retire the "Motoi has one number type" prose.

Twenty passages across five chapters explain a behaviour by citing a limitation
the engine no longer has: before the exactness tower landed (2026-08-03) `1` and
`1.0` were the same JS double, so contagion was unobservable, `(exact-integer?
3.0)` was #t, and `(/ 1 3)` was a float. All three are now false.

Every replacement below was measured against the engine before it was written.
Exact-match only: a pair that does not hit is reported, never guessed at.

    python3 scratch/rewrite-stale-tower-prose.py          # dry run
    python3 scratch/rewrite-stale-tower-prose.py --write
"""

import sys

ROOT = '/Users/alfred/code/motoi-scheme/scheme/reference'

PAIRS = {
'40-math.slat': [
  # min — contagion is observable now
  ("Motoi has no exact/inexact distinction for integral values, so R7RS's 'inexact if any argument is inexact' rule is unobservable: (min 1 2.0) answers 1 and (exact? (min 1 2.0)) answers #t.",
   "R7RS's 'inexact if any argument is inexact' rule is observable: (min 1 2.0) answers 1.0, not 1, and (exact? (min 1 2.0)) answers #f. min hands back the SMALLEST argument, and then exactness contagion makes the answer inexact because one of the arguments was."),
  # max — same rule, stated twice
  ("The R7RS inexactness-contagion rule is unobservable in Motoi for the same reason it is unobservable for min -- there is no exact/inexact distinction for integral values, so (max 1.0 2) answers 2.",
   "The R7RS inexactness-contagion rule is observable here for the same reason it is observable for min -- an inexact argument forces an inexact answer, so (max 1.0 2) answers 2.0 rather than 2."),
  ("Motoi has no exact/inexact distinction for integral values, so R7RS's inexactness-contagion rule is unobservable: (max 1.0 2) answers 2.",
   "R7RS's inexactness-contagion rule is observable: (max 1.0 2) answers 2.0, because one argument was inexact and the answer must be too."),
  # sqrt — right answer, wrong reason
  ("Motoi computes it over machine floats, and the exactness question a learner will ask has a clean answer: (sqrt 4) is 2 and (sqrt 9) is 3, printed with no decimal point, and (exact? (sqrt 4)) answers #t -- because Motoi has no exact/inexact distinction for integral values, a perfect square simply comes back looking like the integer it is.",
   "The exactness question a learner will ask has a clean answer: (sqrt 4) is 2 and (sqrt 9) is 3, printed with no decimal point, and (exact? (sqrt 4)) answers #t -- R7RS-small 6.2.6 requires an EXACT root when the argument is exact and the root is exactly representable, and Motoi gives one. The root of an exact argument is searched over the integers rather than rounded out of a float, so it stays exact at any size, and it carries through a rational: (sqrt 1/4) is 1/2. An inexact argument gets an inexact root -- (sqrt 4.0) is 2.0 -- and everything with no exact root is computed over machine floats."),
  # pi — a double because it is irrational, not because the tower is thin
  ("Because Motoi has a single number type, pi is a double and carries the usual consequence: (sin pi) is 1.2246467991473532e-16, not 0.",
   "pi is irrational, so no exact number names it: the binding is the double closest to it, and it carries the usual consequence -- (sin pi) is 1.2246467991473532e-16, not 0."),
  # ceil — now keeps the argument's exactness
  ("an already-integral 3.0 prints as 3, not 3.0, because Motoi has one number type; and an exact rational 7/2 is handled.",
   "an already-integral 3.0 comes back as 3.0, keeping the argument's inexactness the way R7RS-small asks; and an exact rational 7/2 is handled, answering the exact 4."),
  ("(ceil 3.0) is 3, not 3.0. R7RS-small requires the result to keep the argument's exactness; Motoi has one number type and cannot.",
   "(ceil 3.0) is 3.0. R7RS-small requires the result to keep the argument's exactness, and it does; it answered 3 until the exactness tower landed 2026-08-03."),
  # round2 — floats by choice, not by necessity
  ("And because there is only one number type, the multiply-round-divide trip is done in binary floating point, so a decimal that looks like an exact tie is not one: (round2 1.005) is 1, not 1.01, because 1.005 * 100 is 100.49999999999999.",
   "And round2 does its multiply-round-divide trip in binary floating point rather than over exact rationals, so a decimal that looks like an exact tie is not one: (round2 1.005) is 1, not 1.01, because 1.005 * 100 is 100.49999999999999."),
  # exp2 — a transcendental, so inexact; expt is not
  ("exp2 is Math.pow(2, x), so it agrees with (expt 2 x) exactly: (list (exp2 10) (expt 2 10)) is (1024 1024).",
   "exp2 is Math.pow(2, x), so it agrees with (expt 2 x) in VALUE but not in exactness: (list (exp2 10) (expt 2 10)) is (1024.0 1024). exp2 sits with the transcendental verbs and always answers an inexact number; expt keeps an exact base raised to an exact integer power exact."),
  ("Because Motoi has one number type, exp2 runs into the double's two hard edges. Integers stay exact only up to 2^53: (exp2 53) is 9007199254740992, and adding 1 to it changes nothing.",
   "Because exp2 answers a double, it runs into the double's two hard edges. Integers are held without loss only up to 2^53: (exp2 53) is 9007199254740992.0, and adding 1 to it changes nothing. (expt 2 53) has neither edge, because it stays exact."),
  # exact-rational? — the predicate now answers the R7RS question
  ("And 3.0 is #t: Motoi has one number type, so an integer-valued double is indistinguishable from the integer 3.",
   "And 3.0 is #f: an integer-valued double is still inexact, and this verb asks for exactness."),
  ("(#t #t) — writing the literal keeps it exact; computing it with / does not. The division produced the double 0.3333333333333333, and exactness is lost the moment you divide.",
   "(#t #t) — the literal and the division agree. (/ 1 3) is the exact rational 1/3, not the double 0.3333333333333333: dividing one exact number by another stays exact."),
  ("(exact-rational? 3.0) is #t. Motoi has one number type, so it cannot tell 3.0 from 3 -- this is the same limitation that makes (exact-integer? 3.0) #t.",
   "(exact-rational? 3.0) is #f, because 3.0 is inexact -- the same reason (exact-integer? 3.0) is #f. Both answered #t until the exactness tower landed 2026-08-03."),
  # =? — equal? compares numbers with eqv?, which sees exactness
  ("Because it is equal? and not =, (=? 1 1.0) is #t, but that is a coincidence of Motoi having one number type, not a numeric coercion rule.",
   "Because it is equal? and not =, (=? 1 1.0) is #f: equal? compares numbers with eqv?, and eqv? requires the same exactness as well as the same value. (= 1 1.0) is #t. That disagreement is the clearest reason never to reach for =? on numbers."),
],
'52-predicate.slat': [
  ("#f in Motoi. R7RS §6.2.6 says #f, because 3.0 is integer-valued but inexact — and that is the answer to give in any other Scheme. Motoi cannot distinguish them: 3 and 3.0 are the same JavaScript double, so no predicate here can tell exact 3 from inexact 3.0. Known representation divergence; do not rely on exactness tests round-tripping.",
   "#f. R7RS §6.2.6 says #f, because 3.0 is integer-valued but INEXACT, and Motoi agrees. Read it against its neighbour: (integer? 3.0) is #t and (exact-integer? 3.0) is #f, because the two verbs ask different questions — integer? asks about the value alone, exact-integer? asks about the value and how it is held."),
],
'59-stat.slat': [
  ("Motoi has one number type, the double, so the mean of whole numbers is often a decimal: the mean of 1 2 3 4 is 2.5, not a fraction.",
   "mean averages over machine floats rather than over exact rationals, so the mean of whole numbers is often a decimal: the mean of 1 2 3 4 is 2.5, not the exact 5/2 that (/ (sum (list 1 2 3 4)) 4) answers. Reach for / when you want the fraction."),
  ("2.5 — the average need not be one of the values, and Motoi prints it as a decimal because there are no fractions.",
   "2.5 — the average need not be one of the values, and it comes back as a decimal because mean works in floats. (/ (sum (list 1 2 3 4)) 4) is the same number written exactly, 5/2."),
  ("Motoi carries one number type, the double, so a ratio that does not divide evenly comes back with a float tail: (pct 1 3) is 33.33333333333333.",
   "pct divides over machine floats rather than over exact rationals, so a ratio that does not divide evenly comes back with a float tail: (pct 1 3) is 33.33333333333333, not the exact 100/3. That is deliberate — a percentage is written to be read, and round2 is the verb that tidies the tail."),
  ("There is one number type, the double, so money with decimal parts carries float error.",
   "It computes over machine floats, so money with decimal parts carries float error."),
  ("10.000000000000009 — the honest answer is 10, but there is one number type in Motoi and the nth root is a float operation, so a tail comes back.",
   "10.000000000000009 — the honest answer is 10, but the nth root is a float operation, so a tail comes back."),
],
'66-time.slat': [
  ("R7RS-small says the result is INEXACT. Motoi has one number type, the JS double, so there is no exact/inexact tower to satisfy the requirement with — the number is a double, which is the closest Motoi can come.",
   "R7RS-small says the result is INEXACT, and it is: (exact? (current-second)) answers #f. There was nothing to satisfy that requirement with until the exactness tower landed 2026-08-03."),
],
}


def main():
    write = '--write' in sys.argv
    done = missed = 0
    for fname, pairs in PAIRS.items():
        path = f'{ROOT}/{fname}'
        text = open(path).read()
        for old, new in pairs:
            if old not in text:
                print(f'[MISS] {fname}: {old[:80]}')
                missed += 1
                continue
            if text.count(old) != 1:
                print(f'[AMBIGUOUS x{text.count(old)}] {fname}: {old[:80]}')
                missed += 1
                continue
            text = text.replace(old, new)
            done += 1
            print(f'[OK] {fname}: {old[:70]}')
        if write:
            open(path, 'w').write(text)
    print(f'\nrewrote {done} · missed {missed} · {"WRITTEN" if write else "DRY RUN"}')
    return 1 if missed else 0


if __name__ == '__main__':
    sys.exit(main())
