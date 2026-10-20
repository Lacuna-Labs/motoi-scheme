#!/bin/zsh
# Compare chibi (oracle) vs a Motoi tree, one expression per line.
# usage: tk-compare.sh <motoi-root>
ROOT=$1
n=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  n=$((n+1))
  c=$(chibi-scheme -p "$line" 2>&1 | tail -1)
  m=$(cd "$ROOT" && MOTOI_HOME=/tmp/mx ./bin/motoi eval "$line" 2>&1 | tail -1)
  if [ "$c" = "$m" ]; then
    printf 'ok   %2d  %s\n' "$n" "$c"
  else
    printf 'DIFF %2d  chibi=%s  motoi=%s\n' "$n" "$c" "$m"
  fi
done < /Users/alfred/code/motoi-scheme/scratch/abel/tk-cases.txt
