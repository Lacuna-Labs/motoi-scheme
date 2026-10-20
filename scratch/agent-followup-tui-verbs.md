# Must-cover in reference audit: TUI verbs

Alfred (2026-07-26): the reference audit must document the TUI verbs too.

Wired but (as of audit start) undocumented in scheme/reference/:
- `tui/boot-shell`  (src/cli.js)
- `tui/tui`         (src/cli.js)
- `tui/themes`      (src/repl.js)

These are registered verbs a user/AI can call but can't find in the book → a gap
under the agent's Phase-0 "explode src/ + lib/, document every wired-but-undocumented
verb" mandate. Verify these three appear in the agent's final ledger
(scratch/ref-audit-2026-07-26.md); backfill in correct reference format if missed.

## IMPORTANT — do NOT fabricate TUI-location awareness

The three verbs above are shell/boot/theme only. There is NO verb for "where in the
TUI / web GUI am I" and NO verb to navigate/change the TUI from the Scheme layer.
That capability does NOT exist yet — it is a named frontier (documented honestly in
Book of Motoi, Appendix I: "What the console can — and cannot — see"). Alfred wants
Motoi to eventually know which menu it's in and change it itself; that's a future
build we'll reason toward soon, NOT something to document as existing. Document the
three real tui/* verbs; do not invent location/navigation verbs.

Note: could not inject this mid-run — SendMessage to a running background agent is
not available in this session. Handling by verify-and-backfill at agent completion.
