// grid-ledger.mjs — RE-EXPORT SHIM FOR SHARED RECORD MODULE (lacuna-node records grid-ledger.mjs, L-11).
// Owns: re-exporting lacuna-node records grid-ledger.mjs for legacy foreman test suites.
// Refuses: diverging from lacuna-node records grid-ledger.mjs.
// Implements: LACUNA-CHECKLIST-2026-11-10.md L-11. Invariants (design §18): one record reader and writer. Faults (§16): none.
export * from "../../lacuna-node/records/grid-ledger.mjs";
