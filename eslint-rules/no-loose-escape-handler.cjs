/**
 * no-loose-escape-handler.cjs — ESLint rule.
 *
 * Ported from sakura-scheme (ARTIFACT-2026-07-10 §19, T-09) into
 * Motoi Scheme's base lint set. Consumers of Motoi (Sakura, Curator,
 * Lacuna) inherit the rule; downstream dialects may override severity.
 *
 * Doctrine:
 *   Every keydown listener that inspects `Escape` and closes the
 *   containing surface should route through (artifact/close id).
 *   The artifact frame installs one Escape handler for the whole
 *   stack; per-component listeners are the anti-pattern flagged.
 *
 * What we flag:
 *   • A `keydown` listener (added via `addEventListener` or an inline
 *     `onKeyDown` React prop) whose handler body inspects
 *     `Escape` and does not go through an artifact-close helper.
 *
 * What we allow:
 *   • Files under any `**\/artifact/**` path — those frames own Escape.
 *   • Handlers that call `(artifact/close ...)`, `dispatch(..., ...close...)`,
 *     `artifactClose(...)`, or an identifier named `closeArtifact`.
 *
 * Warn-first policy. Downstream dialects opt directories in with a
 * higher severity as their surfaces migrate.
 */

"use strict";

const CLOSE_IDENT_NAMES = new Set([
  "artifactClose",
  "closeArtifact",
  "close",
  "handleClose",
  "onClose",
  "dispatchClose",
]);

// Strings that indicate a call routes through the artifact/close verb.
const CLOSE_STRING_HINTS = ["artifact/close"];

function isEscapeCheck(node) {
  if (!node) return false;
  // key === "Escape" | key == "Escape" | keyCode === 27
  if (node.type === "BinaryExpression"
    && (node.operator === "===" || node.operator === "==")) {
    const l = node.left, r = node.right;
    if (l && l.type === "Literal" && (l.value === "Escape" || l.value === 27)) return true;
    if (r && r.type === "Literal" && (r.value === "Escape" || r.value === 27)) return true;
  }
  // "Escape".includes(...) or ["Escape",...].includes(e.key)
  if (node.type === "CallExpression") {
    const callee = node.callee;
    if (callee && callee.type === "MemberExpression"
      && callee.property && callee.property.name === "includes") {
      const args = node.arguments || [];
      for (const a of args) {
        if (a.type === "Literal" && a.value === "Escape") return true;
      }
      // includes called on an array containing "Escape"
      if (callee.object && callee.object.type === "ArrayExpression") {
        for (const el of callee.object.elements) {
          if (el && el.type === "Literal" && el.value === "Escape") return true;
        }
      }
    }
  }
  return false;
}

function containsEscapeReference(bodyNode) {
  // Walk the handler body looking for any Escape reference.
  let found = false;
  visit(bodyNode, (n) => {
    if (isEscapeCheck(n)) found = true;
  });
  return found;
}

function containsCloseCall(bodyNode) {
  let found = false;
  visit(bodyNode, (n) => {
    // Direct identifier call: closeArtifact(); or dispatch(id, closeForm);
    if (n.type === "CallExpression") {
      const callee = n.callee;
      if (callee && callee.type === "Identifier"
        && CLOSE_IDENT_NAMES.has(callee.name)) {
        found = true;
      }
      if (callee && callee.type === "MemberExpression"
        && callee.property && CLOSE_IDENT_NAMES.has(callee.property.name)) {
        found = true;
      }
    }
    if (n.type === "Literal" && typeof n.value === "string") {
      for (const h of CLOSE_STRING_HINTS) {
        if (n.value.includes(h)) { found = true; break; }
      }
    }
  });
  return found;
}

function visit(node, fn) {
  if (!node || typeof node !== "object") return;
  fn(node);
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const c of val) visit(c, fn);
    } else if (val && typeof val === "object" && typeof val.type === "string") {
      visit(val, fn);
    }
  }
}

function isInArtifactTree(filename) {
  if (!filename) return false;
  return filename.includes("/artifact/");
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Escape-key handlers must route through (artifact/close id) — the artifact frame owns the stack",
      recommended: false,
    },
    schema: [],
    messages: {
      looseEscape:
        "Escape-key handler bypasses (artifact/close id). Route through an artifact-close helper or migrate the surface into an artifact composition (Motoi base rule; see eslint-rules/no-loose-escape-handler.md).",
    },
  },

  create(context) {
    const filename = context.getFilename ? context.getFilename() : context.filename;
    if (isInArtifactTree(filename)) return {};

    // Cache handler bodies to inspect for Escape references + close calls.
    function checkHandler(handlerNode, reportNode) {
      if (!handlerNode) return;
      const body =
        handlerNode.body ||
        (handlerNode.type === "ArrowFunctionExpression" && handlerNode.body) ||
        null;
      if (!body) return;
      if (containsEscapeReference(handlerNode)) {
        if (!containsCloseCall(handlerNode)) {
          context.report({ node: reportNode, messageId: "looseEscape" });
        }
      }
    }

    return {
      // window.addEventListener("keydown", handler)
      // document.addEventListener("keydown", handler)
      // el.addEventListener("keydown", handler)
      CallExpression(node) {
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") return;
        if (!callee.property || callee.property.name !== "addEventListener") return;
        const args = node.arguments || [];
        if (args.length < 2) return;
        const evt = args[0];
        if (!evt || evt.type !== "Literal" || evt.value !== "keydown") return;
        checkHandler(args[1], node);
      },

      // React-style JSX: onKeyDown={handler}
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (name !== "onKeyDown" && name !== "onKeyDownCapture") return;
        const value = node.value;
        if (!value || value.type !== "JSXExpressionContainer") return;
        checkHandler(value.expression, node);
      },
    };
  },
};
