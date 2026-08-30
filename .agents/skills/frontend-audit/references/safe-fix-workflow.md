# Safe-Fix Workflow

The whole premise of this skill is that you're allowed to touch presentation freely but must never let that bleed into behavior, and that a fix in one file must never quietly break another. Here's how to actually guarantee that in practice, not just intend it.

## Map dependencies before editing

Before changing, renaming, or removing anything that another file could reference:

1. **Grep for it first.** Search the whole project for the exact class name, id, selector, import path, or component name you're about to touch. Don't rely on memory of "I don't think anything else uses this" — check.
2. **Note every consumer.** If three components import the file you're about to restructure, you need to be confident your change is compatible with all three, not just the one that has the visible bug.
3. **Distinguish "used nowhere" from "used somewhere I haven't looked yet."** A grep with zero hits across the whole project is good evidence something is genuinely dead. A grep you only ran in one folder isn't.

For a single self-contained file with no imports/exports to worry about, this step is quick — just confirm internally that nothing later in the same file depends on what you're changing (e.g. a later selector target, a script reading an id you're about to rename).

## Keep diffs minimal and legible

- Change exactly what's needed for the anomaly you're fixing. Resist the urge to also fix formatting, reorder properties, or rename variables in the same pass — every unrelated change is something the person now has to re-verify.
- Prefer editing the most local file that can fix the problem. If a fix "requires" editing a shared/global file to solve a problem that only shows up in one place, that's usually a sign you're about to cause a side effect elsewhere — look for a local override or scoped fix first, and only touch the shared file if the anomaly is genuinely present everywhere that file is used.
- One anomaly, one focused diff. Don't bundle five unrelated fixes into a single sweeping rewrite of a file — it makes the change hard to review and hard to revert if one part is wrong.

## Know where the presentation/logic line actually sits

This is the part that's easy to get wrong under the pressure of "just fix it." A few worked examples:

- **Safe to fix directly:** a `<div>` has `display: flex` but is missing `align-items: center`, so its children sit at the top instead of centered. Pure CSS, zero behavior change.
- **Safe to fix directly:** a component's JSX has a stray unclosed `<span>` that's swallowing the sibling elements after it into itself, breaking layout. Fixing the tag balance doesn't change what the component does, only how it's structured.
- **Not safe — flag instead:** a card's height only looks wrong when a particular piece of state is true, and tracing it shows the conditional class name is being computed from the wrong variable. The visual symptom is real, but the fix lives in a JS conditional that drives behavior elsewhere too — flag it with your best diagnosis rather than editing the conditional yourself.
- **Not safe — flag instead:** a list renders with visibly misaligned items, and it turns out items are missing a stable `key` in a `.map()`. This looks structural, but changing what value is used as the key can change reconciliation behavior (component identity across re-renders, retained input focus/state) — which is a behavioral change, not a cosmetic one. Flag it with the specific line and let a human decide what key to use.
- **Ambiguous — use judgment, lean toward flagging:** an event handler is attached to the wrong element after a markup restructure (e.g. a click handler was on the parent `<div>`, and your structural fix moved the button outside that div). If your structural fix would silently detach a handler, that's not "just structure" anymore — bring the handler along explicitly as part of the fix and say so in your report, rather than leaving it detached or guessing where it should go.

When genuinely unsure which side of the line something is on, treat it as logic and flag it. A missed cosmetic fix costs the person a few extra minutes; a silently altered behavior costs them a bug they don't know to look for.

## Verify after every fix, not just at the end

- **Re-grep** anything you renamed or removed to confirm zero remaining references.
- **Re-read** the surrounding logic once more, specifically checking that no handler, prop, state read/write, or conditional's *meaning* changed — only its presentation.
- **Render it if you can.** A layout fix is a claim about pixels. If you have any way to actually render the page — a dev server, browser automation, a screenshot tool — use it to confirm the anomaly is actually gone and nothing new appeared. Code that "looks right" and a page that "renders right" are different facts; don't conflate them when you have the means to check the second one.
- **Run existing tooling.** If the project has a linter, type-checker, test suite, or build step, run it after your change. A structural fix that breaks a snapshot test or a type check is a signal you touched more than you meant to.

## When you can't verify visually

If there's no way to render the page in your environment, say so plainly in your report and describe precisely what the person should see after your fix (e.g. "the three cards in `.pricing-grid` should now be equal height and top-aligned — please confirm at both desktop and the 768px breakpoint"). Don't claim a visual fix is confirmed when it's actually just confirmed-on-paper.
