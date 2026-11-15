#!/usr/bin/env bash
# audit-safedelete.sh — enforce the safe-delete contract for Python lacuna.
#
# Greps the source for any direct delete call outside `lacuna/trash.py`.
# Every violation fails the audit.
#
# Sanctioned exceptions must be marked with `# noqa:` comment on the same line.
#
# Forbidden patterns (outside lacuna/trash.py):
#   os.remove, os.unlink, os.rmdir
#   shutil.rmtree
#   Path(...).unlink(), Path(...).rmdir(), Path(...).rmtree()  (approximated)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "🔐 safe-delete audit (Python)"

# Find .py files in lacuna/ package (excluding trash.py which owns the contract)
FILES=$(find lacuna -name '*.py' ! -name 'trash.py' 2>/dev/null)
[ -z "$FILES" ] && { echo "✓ no lacuna source files to audit"; exit 0; }

# Pattern: os.remove, os.unlink, os.rmdir, shutil.rmtree, .unlink(), .rmdir(),
# .rmtree() — NOT on a line with `# noqa:` marker.
HITS=$(grep -nE '(os\.remove|os\.unlink|os\.rmdir|shutil\.rmtree|\.unlink\(|\.rmdir\(|\.rmtree\()' \
    $FILES 2>/dev/null | grep -v '# noqa:' || true)

if [ -n "$HITS" ]; then
    echo ""
    echo "✗ safe-delete contract violated:"
    echo ""
    echo "$HITS" | sed 's/^/  /'
    echo ""
    echo "  All deletes must go through lacuna.trash.send_to_trash()."
    echo "  For sanctioned exceptions (uninstall, trash purge), add a # noqa:"
    echo "  marker with a reason on the same line."
    exit 1
fi

echo "✓ no unsanctioned delete calls outside lacuna/trash.py"
echo ""
echo "Done."
