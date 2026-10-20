#!/bin/zsh
# Abel Sussman — per-expression probe driver. Each expression runs in its own
# process so a (correct) error on one line does not hide the lines after it.
cd /Users/alfred/code/motoi-scheme
export MOTOI_HOME=$(mktemp -d)
tmp=$(mktemp -d)

run() {
  local label="$1"; shift
  local expr="$1"
  printf '%s\n' "$expr" > "$tmp/p.scm"
  local out
  out=$(./bin/motoi run "$tmp/p.scm" 2>&1)
  printf '%-4s %-58s => %s\n' "$label" "$expr" "$(printf '%s' "$out" | tr '\n' '|')"
}

echo "== 1. cxr family =="
run A1 '(display (caar (list 1 2)))'
run A2 '(display (cdddr (list 1)))'
run A3 '(display (caar (list (list 1 2) 3)))'
run A4 "(display (cdar (list (cons 'a 1))))"
run A5 '(display (cddr (list 1 2 3)))'
run A6 '(display (cadddr (list 1 2 3 4)))'
run A7 '(display (caddr (list 1 2)))'
run A8 '(display (number? (caar (list 1 2))))'
run A9 '(display (cddddr (list 1 2 3 4 5)))'
run A10 '(display (cdadr (list 1 (cons 2 3))))'

echo
echo "== 2. list-set! =="
run B1 "(define L (list 1 2 3)) (list-set! L 5 'x) (display L)"
run B2 "(list-set! (list) 0 'x) (display (null? '()))"
run B3 "(define M (list 1 2 3)) (list-set! M 0 'ok) (display M)"
run B4 "(list-set! (list 1 2) -1 'x) (display \"no error\")"
run B5 "(list-set! (list 1 2) 1.5 'x) (display \"no error\")"

echo
echo "== 3. assv / memv =="
run C1 '(display (memv 1/2 (list 1/3 1/2)))'
run C2 "(display (assv 1/2 (list (cons 1/3 'a) (cons 1/2 'b))))"
run C3 '(display (memv 2 (list 1 2 3)))'
run C4 "(display (assv 'b (list (cons 'a 1) (cons 'b 2))))"
run C5 '(display (memv (list 1) (list (list 1) 2)))'
run C6 '(display (if (memv (make-rectangular 3 4) (list (make-rectangular 1 1) (make-rectangular 3 4))) "found" "#f"))'
run C7 '(display (memv 1/2 (list 0.5)))'
run C8 '(display (if (memv #\b (list #\a #\b)) "found" "#f"))'
run C9 "(display (assv 4/2 (list (cons 2 'two))))"
run C10 "(display (assv 1/2 (list (list 1/2 'v))))"
