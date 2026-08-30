# Anomaly Checklist

Work through categories in order — structural integrity first, since a broken DOM/component tree can cause every visual symptom below it and is worth ruling out before chasing a CSS fix that wouldn't have helped anyway.

## 1. Structural / DOM integrity

- Unclosed or mismatched tags (`<div>` never closed, closing tag for the wrong element).
- Self-closing tags used on elements that need children, or vice versa.
- Invalid nesting: block elements inside inline elements that don't allow them (e.g. `<div>` inside `<p>`), interactive elements nested inside other interactive elements (`<button>` inside `<a>`), list items outside a `<ul>`/`<ol>`.
- Duplicate `id` attributes — breaks `getElementById`, anchor links, label `for` targeting, and any CSS/JS that assumes uniqueness.
- Orphaned closing tags or stray fragments left behind from a previous edit.
- Broken `src`/`href` pointing at a file that no longer exists (check this — don't assume).
- Missing `alt` on meaningful images (structural/a11y issue, safe to fix directly since it never touches behavior).

## 2. Layout & alignment

- Flex items misaligned on the main or cross axis — check the parent has `display: flex` and that `justify-content`/`align-items` are set as intended, not left at browser defaults.
- Flex children overflowing or refusing to shrink — usually `min-width: auto` on a flex child fighting its container, or a fixed width that doesn't account for padding/border (`box-sizing` mismatch).
- Grid items not landing where expected — check track definitions (`grid-template-columns/rows`), explicit vs. implicit grid, and `minmax()` usage for tracks that need to flex.
- Box-model inconsistency — mixed `box-sizing: content-box` and `border-box` across a project causes width math to silently disagree between components.
- Margin collapse producing unexpected vertical spacing between siblings.
- Elements overflowing their container, producing unwanted scrollbars or horizontal page scroll on mobile — usually a fixed width, an unconstrained image, or a wide table without a wrapper.
- Centering that only works on one axis, or breaks when content length changes.

## 3. Stacking & visibility

- Elements hidden behind others that should be on top, or vice versa — check `z-index` values, but remember the real cause is usually a **stacking context** created by an ancestor's `position`, `opacity`, `transform`, or `filter`, not the z-index number itself. Trace the ancestor chain before changing a z-index value.
- Arbitrary/inconsistent z-index numbers scattered across the codebase with no scale — a smell even when nothing is visibly broken yet, worth flagging as Minor/Suggestion.
- `position: sticky` that stops sticking — almost always because a scrolling ancestor has `overflow: hidden`/`auto`/`scroll`, which makes sticky positioning relative to that ancestor instead of the viewport.
- `overflow: hidden` on a parent silently clipping content that should be visible (tooltips, dropdowns, focus rings).

## 4. Responsive & breakpoints

- Media queries that don't fire at the width they're meant to, or breakpoints defined inconsistently across files (one file uses 768px, another uses 767px, for "the same" breakpoint).
- Fixed pixel widths that don't scale down, causing overflow only on narrow viewports.
- Touch targets that shrink below a usable size on mobile.
- Content that was never tested with realistic (long/short/wrapping) text, causing layout that only breaks with real data.

## 5. Dead code & style conflicts

- CSS selectors that no longer match anything in the markup (dead weight, safe to remove once confirmed via cross-file search).
- Classes referenced in markup/JS that have no matching CSS rule anywhere (broken reference — either the class was renamed on one side only, or the stylesheet import is missing).
- Duplicate or directly conflicting selectors fighting over the same property — often the actual root cause of "I changed the CSS and nothing happened."
- `!important` used to patch over a specificity fight rather than fixing the specificity — a sign of a deeper conflict; flag the underlying conflict rather than adding another `!important` on top.
- Hardcoded colors/spacing/font-sizes duplicating what a design token or CSS variable already defines elsewhere — drift that will cause future inconsistency even if nothing looks wrong today.

## 6. Cross-file reference integrity

This category is what "nothing else should break from other files" is about — always check it before finishing.

- Import paths pointing at a file that was moved or renamed.
- A component renamed in one place but not everywhere it's imported or referenced.
- CSS Modules / scoped styles where the class name generated no longer matches what the markup expects.
- Shared assets (images, fonts, icons) referenced with a path that's broken from some but not all files (relative path issues).
- Props a component no longer accepts but a parent still passes (or vice versa) — this is a logic/contract issue, not a presentation one: flag it, don't silently fix it.

## 7. Framework-specific structural smells

See `references/framework-notes.md` for detail on React/Vue/Svelte/Tailwind-specific patterns and exactly where the presentation/logic line sits for each.
