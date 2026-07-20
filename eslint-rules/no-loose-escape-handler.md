# `no-loose-escape-handler`

Enforce that Escape-key handlers route through `(artifact/close id)`.

**Ported from** sakura-scheme (ARTIFACT-2026-07-10 §19, T-09, 2026-07-10)
**Motoi base rule.** Downstream dialects (Sakura, Curator, Lacuna) inherit.

## Rationale

Every user-surface that appears on screen becomes an artifact under the
Motoi artifact substrate; closing a docked artifact is what
`(artifact/close id)` is for. The artifact frame installs one Escape
handler for the whole stack; per-component listeners are the
anti-pattern that this rule flags.

## What we flag

- A `keydown` listener added via `addEventListener("keydown", handler)`
  whose handler references the string `"Escape"` (or the deprecated
  `keyCode === 27`) and does not call an artifact-close helper.
- A React-style `onKeyDown={handler}` JSX attribute matching the same
  criteria.

## What we allow

- Any file whose path contains `/artifact/` — those frames own Escape
  handling and ARE the one-true handler.
- Handlers whose body calls one of the recognized close routes:
  - `closeArtifact(...)`, `artifactClose(...)`, `dispatchClose(...)`,
    `handleClose(...)`, `onClose(...)`, or a `.close(...)` method
  - A string literal containing `"artifact/close"` (Scheme dispatch)

## Warn-first policy

Ships as a warning. Downstream dialects raise severity per-directory
as surfaces migrate.

## Configuration

Flat-config (ESLint 9+):

```js
import motoiRules from "./eslint-rules/index.cjs";

export default [{
  files: ["src/**/*.{js,jsx}", "bindings/js/**/*.{js,jsx}"],
  plugins: { motoi: motoiRules },
  rules: {
    "motoi/no-loose-escape-handler": "warn",
  },
}];
```

## Offending patterns

### Bare Escape check with an inline close

```js
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("modal").remove(); // flagged
  }
});
```

### JSX handler that swallows Escape without routing

```jsx
<div onKeyDown={(e) => {
  if (e.key === "Escape") setOpen(false); // flagged
}} />
```

### Includes-check inside a set

```js
document.addEventListener("keydown", (e) => {
  if (["Escape", "Esc"].includes(e.key)) {
    hidePanel(); // flagged
  }
});
```

## Compliant patterns

### Route through the artifact/close verb

```js
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeArtifact(activeId);
  }
});
```

### Direct dispatch to the close verb

```jsx
<Composer onKeyDown={(e) => {
  if (e.key === "Escape") dispatch(id, ["artifact/close", id]);
}} />
```

## Testing

`tests/no-loose-escape-handler.test.js` exercises the rule against
offending and compliant patterns using the standard `RuleTester`
harness.
