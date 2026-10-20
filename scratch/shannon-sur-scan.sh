#!/bin/bash
# How large can the literals in the surreal distributivity check get before
# game/surreal-mul becomes intractable? surrealKey() serializes the whole
# game tree into a memo key, so both time and key length blow up.
cd /Users/alfred/code/motoi-scheme
for t in "1 1 1" "2 1 1" "1 1 2" "2 2 2" "1 2 3" "2 2 3" "2 3 4"; do
  read -r A B C <<< "$t"
  cat > scratch/shannon-sur-run.scm <<EOF
(define (distributivity-check a b c)
  (game/surreal-eq? (game/surreal-mul a (game/surreal-add b c))
                    (game/surreal-add (game/surreal-mul a b) (game/surreal-mul a c))))
(display (distributivity-check (game/surreal-lit $A) (game/surreal-lit $B) (game/surreal-lit $C)))
EOF
  s=$(date +%s%N)
  out=$(timeout 20 env MOTOI_HOME=/tmp/shannon-sur-home ./bin/motoi run scratch/shannon-sur-run.scm 2>&1 | head -1)
  rc=$?
  e=$(date +%s%N)
  printf 'a=%s b=%s c=%s  %6dms  rc=%s  %s\n' "$A" "$B" "$C" $(( (e-s)/1000000 )) "$rc" "$out"
done
