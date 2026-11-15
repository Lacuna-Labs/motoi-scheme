#!/bin/sh
# Copies lacuna-box/jail/*.py and *.sb into ~/.lacuna/jail/ (mode 644) and prints what changed. Restarts nothing.
set -eu
src="$(cd "$(dirname "$0")" && pwd)"
dst="$HOME/.lacuna/jail"
mkdir -p "$dst"
for f in "$src"/*.py "$src"/*.sb; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  if [ ! -e "$dst/$name" ]; then echo "new      $name"
  elif cmp -s "$f" "$dst/$name"; then continue
  else echo "changed  $name"; fi
  install -m 644 "$f" "$dst/$name"
done
echo "done: $dst (restart nothing; the broker reloads on its own restart)"
