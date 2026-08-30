# Framework-Specific Notes

Same anomaly categories as `anomaly-checklist.md` apply everywhere, but each framework has its own common failure patterns and its own version of the "safe to fix" / "flag instead" line. Read the section for whichever framework(s) you're auditing.

## React / JSX (and TSX)

**Usually safe to fix directly:**
- Missing or mismatched closing tags in JSX, unbalanced fragments (`<>...</>`).
- `className` typos or a class that doesn't match any CSS Module export.
- Conditional rendering (`{condition && <Thing/>}`) that leaves a stray `false`/`0` rendered visibly when `condition` is falsy but not boolean — the classic "renders a literal 0 on the page" bug. Fixing the rendering (`Boolean(condition) &&` or an explicit ternary) is presentation-safe as long as you don't change what `condition` itself evaluates.
- Inline `style={{}}` objects with layout bugs (wrong flex properties, wrong units).

**Flag instead of fixing directly:**
- Missing `key` prop in a `.map()` — looks structural, but the key affects React's reconciliation and can change which component instance retains state/focus across re-renders. Flag with the exact line and a suggested key source; don't pick a key value yourself unless it's unambiguous (e.g. a genuinely stable `id` field already exists on the data and is obviously the right choice).
- Hooks-rule violations (conditional hooks, hooks called in loops) — these are behavioral/runtime-correctness issues, not layout issues, even though they can produce visual symptoms like state getting out of sync.
- A prop being passed that a component's type/interface no longer declares — a contract mismatch, not a presentation bug.

## Vue (SFCs)

**Usually safe to fix directly:**
- Malformed template markup, unclosed tags inside `<template>`.
- Scoped-style leakage where a style unexpectedly affects a child component — usually fixable by adding `scoped` or adjusting the selector, without touching the component's script.
- Class/style bindings (`:class`, `:style`) with wrong CSS values.

**Flag instead of fixing directly:**
- `v-for` without a `:key`, or with a key bound to an unstable value (array index on a reorderable list) — same reconciliation-identity concern as React's missing key.
- Anything inside `<script setup>` / the component's logic block, including computed properties that happen to drive a class binding — the computed's *result* being wrong is a logic bug even if its only visible effect is a wrong class.

## Svelte

**Usually safe to fix directly:**
- Markup structure and unclosed tags inside the component's markup section.
- `class:` directive bindings with the wrong CSS class name.
- Scoped CSS rules that don't match the markup they're meant to style (Svelte scopes styles per-component; a rule that never matches usually means the markup changed and the CSS wasn't updated).

**Flag instead of fixing directly:**
- Reactive statements (`$:`) that drive the visual bug — the reactivity graph is logic, even when its only symptom is visual.
- `{#each}` blocks without a keyed expression (`{#each items as item (item.id)}`) on lists that reorder — same identity concern as the other frameworks.

## Tailwind / utility-CSS codebases

**Usually safe to fix directly:**
- Wrong or conflicting utility classes on an element (`flex` missing when children are laid out with `items-center` but no `flex` parent; `overflow-hidden` clipping something it shouldn't).
- Responsive-prefix mistakes (`md:` applied where `lg:` was intended, breaking the layout at the wrong width).
- Arbitrary-value utilities (`w-[327px]`) that don't match the design system's scale — worth normalizing to a token/scale value if one exists.

**Flag instead of fixing directly:**
- Conditional class strings built from JS logic (`clsx(condition && "hidden")`) where the *condition* itself looks wrong — the class string is presentation, but the condition driving it is logic. Fix the class name if it's simply the wrong utility; flag the condition if it looks like it's evaluating something incorrectly.

## Plain HTML / CSS / vanilla JS

This is the simplest case — there's no framework reconciliation to worry about, so the presentation/logic line is closer to the surface. The main thing to watch for is JS that selects elements by id/class/data-attribute (`document.querySelector`, event delegation, analytics hooks) — a structural fix that renames or restructures an element the JS depends on will silently break that JS. Grep the `<script>` blocks and any linked `.js` files for the id/class/attribute before renaming it, exactly as described in `references/safe-fix-workflow.md`.
