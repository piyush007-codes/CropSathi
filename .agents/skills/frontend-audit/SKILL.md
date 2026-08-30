---
name: frontend-audit
description: "Audits frontend codebases (HTML, CSS/Sass, JS/TS, React, Vue, Svelte) for visual and structural anomalies — misalignment, broken layouts, overflow, stacking/z-index bugs, unclosed or mismatched tags, dead or conflicting CSS, broken cross-file references — and fixes them with surgical, minimal diffs. Use this whenever the user says a UI looks broken, off, misaligned, or glitchy, or asks to clean up, audit, QA, or fix a frontend file or project, even if they don't name a specific bug. The hard rule this skill enforces — fix presentation and structure only, never touch business logic, event handlers, state, API calls, data flow, or props/contracts — and verify that no other file was broken by the change. Trigger this proactively before shipping or reviewing any frontend change if the user seems worried about regressions or things breaking."
---

# Frontend Audit & Repair

You are doing surgery, not renovation. The person handing you this file has working code with something visually or structurally wrong in it — and functionality they need to survive completely intact. Every fix you make should be the smallest change that resolves the anomaly, verifiable in a diff at a glance, with zero surprises anywhere else in the codebase.

## The one rule that overrides everything else

**Fix presentation and structure. Never fix behavior.**

That means: markup structure, tag nesting, CSS rules, layout (flex/grid/box model), spacing, alignment, stacking order, responsive breakpoints, dead/conflicting styles, and broken references between files are all fair game to fix directly.

State, props, event handlers, hooks, API/data-fetching calls, routing logic, conditionals that drive *behavior* (not just visibility), and business rules are off-limits — even if you're fairly sure you see a bug in them, even if fixing them would be easy, even if it's tempting because it's "basically the same fix." If a visual bug's root cause turns out to live in logic (e.g. a conditional class is wrong because a piece of state is computed wrong), fix only the part that's presentation, and report the logic-side suspicion as a flagged finding instead of touching it. When you're unsure which side of the line something is on, treat it as logic and flag it rather than fix it — the cost of a missed cosmetic fix is small, the cost of silently changing behavior isn't.

Read `references/safe-fix-workflow.md` before making any edits — it covers how to map dependencies first, keep diffs minimal, and verify nothing downstream broke.

## Workflow

Work in five phases. Don't skip the mapping phase, even under time pressure — it's what makes "nothing else breaks" possible instead of hopeful.

### 1. Map before you touch anything

Before looking for bugs, build a quick mental (or written, for larger projects) map of:
- **File relationships**: what imports what, which components render which children, which stylesheets/CSS-modules/styled-components apply to which markup.
- **Shared surfaces**: design tokens/CSS variables, utility classes, shared components — anything one file's fix could ripple into.
- **The connections you must not sever**: every event handler binding, every prop being passed through, every id/class that JS selects by, every data attribute a test or script hooks into.

For a single file, this is a fast skim. For a multi-file project, grep for a class/id/selector/import before you rename, remove, or restructure anything that uses it — see `references/safe-fix-workflow.md` for the exact discipline. This step is what "nothing else should break from other files" actually depends on.

### 2. Detect anomalies

Scan systematically rather than fixing the first thing you notice. Work through `references/anomaly-checklist.md` — it's organized by category (structural/DOM integrity, layout & alignment, stacking & visibility, responsiveness, dead/conflicting CSS, cross-file reference integrity, framework-specific smells). If the project has more than a handful of files, run the bundled first-pass scanner before your manual read-through:

```bash
python3 scripts/scan_anomalies.py <path-to-project-or-file>
```

This is a heuristic static scanner (regex/stack-based, not a real parser) — treat its output as a lead generator, not a verdict. It catches tag imbalance, id collisions, orphaned/undefined class references across files, `!important` pileups, and a few other mechanical smells fast, but it will miss anything that only shows up when the page actually renders (real overlap, real misalignment, real breakpoint failures). Always follow it with a visual/manual pass — read the rendered structure, and if you have a way to actually render the page (browser tooling, a dev server, screenshots), use it. A layout bug is a rendering fact, not just a code pattern; don't declare something fixed on code inspection alone if you can check the pixels.

### 3. Triage with severity

Grade each finding using `references/severity-rubric.md` (Critical / Major / Minor / Suggestion). Severity determines both what you fix now versus flag, and how confident you need to be before touching a file with wide blast radius (e.g. a shared design-token file used across 40 components deserves more caution than a typo in one component's local class).

### 4. Fix — minimal, isolated diffs

For each anomaly you're fixing:
- Change only what's needed to resolve that specific anomaly. Don't reformat, don't "improve while you're in there," don't rename things for clarity — every extra line of diff is a line the person has to re-verify didn't change behavior.
- Prefer the fix that's most local. A misaligned single component should almost never require editing a shared/global stylesheet; if it seems to, that's a signal the anomaly's real cause is upstream and shared — slow down and check who else depends on that shared rule before changing it.
- If a class, id, selector, or file is unused and safe to delete per your dependency map, remove it rather than leaving dead weight — but only after confirming nothing references it (see step 1).
- Never delete or rename something a script, test, analytics hook, or another file's selector depends on without updating every reference — grep first.
- If the fix would require touching more than presentation/structure to work, stop, don't apply it, and write it up as a flagged finding instead (see Report format below).

### 5. Verify

Before calling anything done:
- **Structural check**: re-open the file(s) you changed and confirm tags balance, nothing is orphaned, and the DOM/component tree still makes sense.
- **Reference check**: for anything you renamed, removed, or restructured, re-grep the whole project to confirm no other file still points at the old name/structure. This is the step that actually delivers "nothing else breaks."
- **Behavioral check**: read the surrounding logic once more and confirm you haven't altered what any handler, prop, or state value does — only how things look or are structured.
- **Visual check**: if you can render the page (dev server, browser tooling, screenshots), do a before/after comparison. If you can't, describe in your report exactly what visual change to expect so the person can verify it themselves.
- If tooling is available in the environment (linter, type-checker, build command, test suite), run it and fix anything your change caused to fail before finishing.

## Report format

Always end with a findings report, grouped by severity, whether or not you had a chance to fix everything:

```
## Frontend Audit Report

### Fixed
- [Critical] path/file.tsx:42 — <what was broken> → <what you changed> (structural/CSS only)

### Flagged — needs human review (touches logic, not fixed)
- [Major] path/file.tsx:88 — <what looks wrong> — likely cause is in <state/handler/data>, not presentation, so left untouched

### Skipped — low confidence or high blast radius
- [Minor] path/shared.css:12 — <what you noticed> — shared by N components, recommend fixing with visual confirmation rather than blind

### Verified unaffected
- Confirmed no other file references the removed/renamed selectors above
```

Keep entries short and specific — file, line if you have it, the anomaly, and the fix or the reason you didn't apply one.

## Reference files

- `references/anomaly-checklist.md` — the categorized checklist to scan against
- `references/severity-rubric.md` — how to grade Critical/Major/Minor/Suggestion, with examples
- `references/safe-fix-workflow.md` — the dependency-mapping and minimal-diff discipline in more depth
- `references/framework-notes.md` — React/Vue/Svelte/Tailwind-specific structural smells and their safe-fix boundaries
- `scripts/scan_anomalies.py` — first-pass heuristic static scanner (run it, don't trust it blindly)
