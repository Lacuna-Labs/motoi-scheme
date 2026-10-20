#!/usr/bin/env bash
# test-drawing-primitives.sh — prove every new drawing verb runs.
# Each line is echoed through ./bin/motoi run /dev/stdin; any
# "unbound symbol" or "error" fails the harness.
set -u
cd "$(dirname "$0")/.."

pass=0; fail=0; failures=()
run() {
  local desc="$1"; local code="$2"
  local out
  out=$(echo "$code" | ./bin/motoi run /dev/stdin 2>&1)
  if echo "$out" | grep -qiE "unbound symbol|not a function|is not defined|TypeError|ReferenceError|SyntaxError|^error:|parse error"; then
    fail=$((fail+1)); failures+=("$desc :: $code :: $out")
    printf 'FAIL  %s\n      %s\n' "$desc" "$out"
  else
    pass=$((pass+1)); printf 'ok    %-28s => %s\n' "$desc" "$out"
  fi
}

SD='(set-mode (quote sd))'

# ── Stage 1/2: raster shapes ──
run triangle        "$SD (triangle 10 10 40 10 25 40 8)"
run triangle-fill   "$SD (triangle-fill 10 10 40 10 25 40 8)"
run polygon         "$SD (polygon (list (list 5 5) (list 30 5) (list 20 30)) 12)"
run poly            "$SD (poly (list (list 5 5) (list 30 5) (list 20 30)))"
run polygon-fill    "$SD (polygon-fill (list (list 5 5) (list 30 5) (list 20 30)) 11)"
run fill-poly       "$SD (fill-poly (list (list 5 5) (list 30 5) (list 20 30)))"
run star            "$SD (star 60 60 20 8 5)"
run star-fill       "$SD (star-fill 60 60 20 8 5 0 10)"
run ellipse         "$SD (ellipse 100 100 30 18)"
run ellipse-fill    "$SD (ellipse-fill 100 100 30 18 9)"
run ngon            "$SD (ngon 150 60 20 6)"
run ngon-fill       "$SD (ngon-fill 150 60 20 6 0 3)"
run ring            "$SD (ring 200 100 25 12 7)"
run arc             "$SD (arc 100 120 30 0 3.14159)"

# ── Stage 2c: image algebra (the composition engine) ──
run img/circle      "$SD (image? (img/circle 10 (quote solid) (quote red)))"
run img/square      "$SD (image-width (img/square 20 (quote outline) 8))"
run img/rectangle   "$SD (image-height (img/rectangle 30 10 (quote solid) 12))"
run img/triangle    "$SD (image? (img/triangle 20 (quote solid) 11))"
run img/star        "$SD (image? (img/star 15 (quote solid) 10))"
run img/ellipse     "$SD (image? (img/ellipse 30 18 (quote solid) 9))"
run img/reg-poly    "$SD (image? (img/regular-polygon 15 6 (quote solid) 3))"
run img/line        "$SD (image? (img/line 20 7))"
run overlay         "$SD (image? (overlay (img/circle 10 (quote solid) 8) (img/circle 15 (quote solid) 12)))"
run beside          "$SD (image-width (beside (img/square 10 (quote solid) 8) (img/square 10 (quote solid) 12)))"
run above           "$SD (image-height (above (img/square 10 (quote solid) 8) (img/square 10 (quote solid) 12)))"
run place-image     "$SD (image? (place-image (img/circle 5 (quote solid) 8) 20 20 (empty-scene 60 60 1)))"
run empty-scene     "$SD (image-width (empty-scene 100 80))"
run rotate          "$SD (image? (rotate 45 (img/square 20 (quote solid) 8)))"
run scale           "$SD (image-width (scale 2 (img/square 10 (quote solid) 8)))"
run scale/xy        "$SD (image-width (scale/xy 3 1 (img/square 10 (quote solid) 8)))"
run flip-horizontal "$SD (image? (flip-horizontal (img/triangle 20 (quote solid) 8)))"
run flip-vertical   "$SD (image? (flip-vertical (img/triangle 20 (quote solid) 8)))"
# The nested-squares building Alfred asked for:
run nested-building "$SD (draw-image (overlay (img/square 10 (quote solid) 7) (img/square 20 (quote outline) 6) (img/square 30 (quote outline) 5)) 100 100)"
run draw-image      "$SD (draw-image (img/circle 12 (quote solid) 8) 50 50)"
run draw-image-ctr  "$SD (draw-image/center (img/circle 12 (quote solid) 8) 160 120)"

# ── Stage 3: superformula ──
run superformula    "$SD (length (superformula 160 120 40 6 1 7 8))"
run superf-stroke   "$SD (superformula-stroke 160 120 40 6 1 7 8)"
run superf-fill     "$SD (superformula-fill 160 120 40 5 0.3 0.3 0.3 1 1 180 11)"

# ── Stage 4: SDF ──
run sdf/circle      "$SD (sdf? (sdf/circle 100 100 30))"
run sdf/box         "$SD (sdf? (sdf/box 100 100 20 15))"
run sdf/segment     "$SD (sdf? (sdf/segment 10 10 90 90 4))"
run sdf-union       "$SD (sdf? (sdf-union (sdf/circle 100 100 30) (sdf/box 130 100 20 20)))"
run sdf-intersect   "$SD (sdf? (sdf-intersect (sdf/circle 100 100 30) (sdf/circle 120 100 30)))"
run sdf-subtract    "$SD (sdf? (sdf-subtract (sdf/circle 100 100 30) (sdf/circle 100 100 15)))"
run sdf-fill        "$SD (sdf-fill (sdf/circle 100 100 20) 8)"
run sdf-fill-rect   "$SD (sdf-fill-rect (sdf-subtract (sdf/box 100 100 30 30) (sdf/circle 100 100 12)) 60 60 140 140 12)"

# ── Stage 5: SVG path ──
run svg->points     "$SD (length (svg-path->points \"M12 2 L2 22 L22 22 Z\" 4 40 40))"
run draw-svg-path   "$SD (draw-svg-path \"M12 2 L2 22 L22 22 Z\" 40 40 4 8)"
run fill-svg-path   "$SD (fill-svg-path \"M12 2 L2 22 L22 22 Z\" 40 40 4 11)"
run svg-cubic       "$SD (length (svg-path->points \"M10 10 C 20 20 40 20 50 10\" 2 0 0))"

echo ""
echo "==== PASS=$pass  FAIL=$fail ===="
if [ "$fail" -ne 0 ]; then
  echo "--- FAILURES ---"
  for f in "${failures[@]}"; do echo "$f"; echo; done
  exit 1
fi
