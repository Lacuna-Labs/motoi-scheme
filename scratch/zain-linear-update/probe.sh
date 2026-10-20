#!/bin/zsh
cd /Users/alfred/code/motoi-scheme
i=0
while IFS= read -r line; do
  i=$((i+1))
  [ -z "$line" ] && continue
  m=$(MOTOI_HOME=/tmp/mx timeout 20 ./bin/motoi eval "$line" 2>&1 | tail -1)
  c=$(timeout 20 chibi-scheme -m '(srfi 1)' -p "$line" 2>&1 | tail -1)
  printf '%2d  motoi=%-28s chibi=%s\n' "$i" "$m" "$c"
done < /Users/alfred/code/motoi-scheme/scratch/zain-linear-update/cases.txt
