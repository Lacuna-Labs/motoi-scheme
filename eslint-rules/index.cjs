/**
 * eslint-rules — Motoi Scheme custom lint rules.
 *
 * These rules enforce doctrine-level invariants that plain-JS
 * linting can't see. Motoi Scheme is the base dialect; rules
 * here are the base set consumers may extend.
 *
 *   • no-loose-escape-handler
 *       Every Escape-key handler must route through
 *       (artifact/close id). Ported from sakura-scheme
 *       (ARTIFACT-2026-07-10 §19, T-09).
 *
 * Consumers wire the rules in via a flat-config plugin object:
 *
 *   import motoiRules from "./eslint-rules/index.cjs";
 *   export default [{
 *     plugins: { "motoi": motoiRules },
 *     rules: { "motoi/no-loose-escape-handler": "warn" },
 *   }];
 */
"use strict";

const noLooseEscapeHandler = require("./no-loose-escape-handler.cjs");

module.exports = {
  rules: {
    "no-loose-escape-handler": noLooseEscapeHandler,
  },
};
