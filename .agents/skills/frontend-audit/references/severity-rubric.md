# Severity Rubric

Grade every finding so the person can triage your report at a glance and so you can decide how much caution a fix deserves before applying it.

## Critical
Breaks the page for real users right now — not a style nitpick. Content is unreadable, unusable, or inaccessible; a core layout is collapsed; an element that must be clickable is covered by something else; the page overflows and scrolls sideways on common viewports.

*Example: a modal's close button is rendered underneath the modal's own backdrop because of a stacking-context bug, so users can't dismiss it.*

Fix these first, and it's worth the extra caution of a visual before/after check even if that slows you down.

## Major
Clearly wrong and clearly visible, but doesn't block core functionality. Misaligned but usable, broken only at certain breakpoints, or wrong in a way most users would notice and flag.

*Example: a pricing table's columns don't line up on tablet width because a flex-basis value wasn't updated when a column was added.*

## Minor
Noticeable on close inspection but doesn't materially hurt usability. Small spacing inconsistencies, a slightly-off shadow, a hover state that doesn't quite match its siblings.

*Example: one card in a grid has 12px of padding while its siblings have 16px.*

## Suggestion
Not broken, but a smell worth flagging — dead CSS, inconsistent z-index scale, hardcoded values duplicating a design token, code that works today but is fragile. Report these; don't necessarily spend fix budget on them unless asked, especially in a large codebase where a "suggestion" touches many files.

*Example: eleven different hardcoded hex values across the codebase that are all "almost" the brand blue.*

## Using severity to calibrate caution, not just priority

Severity also tells you how much verification a fix deserves before you apply it:

- **Critical/Major fixes in shared files** (a global stylesheet, a base component, a design token) — verify visually if you possibly can, and check every consumer of that shared file, not just the one where you noticed the bug.
- **Minor/Suggestion fixes** in a single local file — lower risk, but still confirm the change doesn't ripple (e.g. removing a class that looked unused but was actually referenced from a test file).
- Anything that requires touching a file used by many other files should be treated one severity level more cautiously than its visual impact alone would suggest — blast radius matters as much as visibility.
