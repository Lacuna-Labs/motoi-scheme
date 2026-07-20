/**
 * eslint.config.js — flat config (ESLint 9+) for Motoi Scheme.
 *
 * Ships two things:
 *   1. Default rules for src/ + bindings/js.
 *   2. Custom motoi rules from ./eslint-rules/ scoped to files that
 *      participate in the artifact substrate. no-loose-escape-handler
 *      is warn-first — downstream dialects (Sakura, Curator, Lacuna)
 *      raise severity per-directory as their surfaces migrate.
 */
import { createRequire } from "module";

const requireCjs = createRequire(import.meta.url);
const motoiRules = requireCjs("./eslint-rules/index.cjs");

export default [
  {
    files: ["src/**/*.js", "bindings/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  },
  // no-loose-escape-handler applies to any UI-bearing surface. Motoi's
  // src/ has no DOM code, so the rule is a no-op here today; the wiring
  // stays so consumers can extend `files:` with their site/apps tree.
  {
    files: [
      "site/**/*.{js,jsx}",
      "bindings/js/**/*.{js,jsx}",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { motoi: motoiRules },
    rules: {
      "motoi/no-loose-escape-handler": "warn",
    },
  },
];
