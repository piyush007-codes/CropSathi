#!/usr/bin/env python3
"""
scan_anomalies.py — first-pass heuristic scanner for the frontend-audit skill.

This is NOT a real parser. It's a fast, regex/stack-based triage pass meant to
surface leads before a manual read-through and (if possible) a rendered visual
check. It will produce false positives (especially around TSX generics and
Tailwind-style utility classes) and it will miss anything that only shows up
once the page actually renders. Treat every line of output as "go look at
this," not "this is definitely broken."

Usage:
    python3 scan_anomalies.py <path-to-file-or-project>
"""

import os
import re
import sys
from collections import defaultdict

MARKUP_EXTS = {".html", ".htm", ".vue", ".svelte", ".jsx", ".tsx"}
STYLE_EXTS = {".css", ".scss", ".less"}
SCRIPT_EXTS = {".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"}
ALL_EXTS = MARKUP_EXTS | STYLE_EXTS

VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

TAILWIND_PREFIXES = (
    "flex", "grid", "p-", "px-", "py-", "pt-", "pb-", "pl-", "pr-",
    "m-", "mx-", "my-", "mt-", "mb-", "ml-", "mr-", "w-", "h-", "min-w-",
    "min-h-", "max-w-", "max-h-", "text-", "bg-", "border", "rounded",
    "gap-", "items-", "justify-", "content-", "absolute", "relative",
    "fixed", "sticky", "static", "overflow-", "z-", "top-", "left-",
    "right-", "bottom-", "inset-", "opacity-", "transition", "duration-",
    "shadow", "font-", "leading-", "tracking-", "space-", "divide-",
    "hover:", "focus:", "active:", "disabled:", "sm:", "md:", "lg:",
    "xl:", "2xl:", "dark:", "col-", "row-", "order-", "self-", "place-",
    "cursor-", "select-", "pointer-events-", "aspect-", "object-",
)


def find_files(root):
    if os.path.isfile(root):
        return [root]
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in
                       {"node_modules", ".git", "dist", "build", ".next", "out"}]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in ALL_EXTS:
                out.append(os.path.join(dirpath, fn))
    return out


def read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except OSError:
        return ""


TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9.:_-]*)((?:\s+[^<>]*?)?)(/?)>")


def check_tag_balance(path, text, findings):
    if os.path.splitext(path)[1].lower() not in {".html", ".htm", ".vue", ".svelte", ".jsx"}:
        return
    stack = []
    for m in TAG_RE.finditer(text):
        closing, name, attrs, self_close = m.groups()
        lname = name.lower()
        line = text.count("\n", 0, m.start()) + 1
        if lname in ("script", "style") and not closing and not self_close:
            # skip contents of embedded script/style blocks (handled as own file type elsewhere)
            end_tag = f"</{lname}>"
            idx = text.lower().find(end_tag, m.end())
            if idx != -1:
                continue
        if closing:
            if not stack:
                findings.append((path, line, "structural",
                                  f"closing tag </{name}> with no matching open tag"))
                continue
            top_name, top_line = stack[-1]
            if top_name.lower() == lname:
                stack.pop()
            else:
                # look deeper for a matching open tag (best-effort recovery)
                found = False
                for i in range(len(stack) - 1, -1, -1):
                    if stack[i][0].lower() == lname:
                        findings.append((path, line, "structural",
                                          f"</{name}> closes out of order — "
                                          f"<{stack[-1][0]}> opened at line {stack[-1][1]} "
                                          f"is still unclosed"))
                        del stack[i:]
                        found = True
                        break
                if not found:
                    findings.append((path, line, "structural",
                                      f"closing tag </{name}> does not match any open tag"))
        elif self_close or lname in VOID_ELEMENTS:
            continue
        else:
            stack.append((name, line))
    for name, line in stack:
        findings.append((path, line, "structural",
                          f"<{name}> opened here is never closed in this file"))


ID_RE = re.compile(r'\bid\s*=\s*["\']([^"\']+)["\']')


def check_ids(path, text, id_locations):
    for m in ID_RE.finditer(text):
        line = text.count("\n", 0, m.start()) + 1
        id_locations[m.group(1)].append((path, line))


CLASS_ATTR_RE = re.compile(r'\bclass(?:Name)?\s*=\s*["\']([^"\'{}]+)["\']')
CSS_SELECTOR_RE = re.compile(r'\.([a-zA-Z_][\w-]*)\s*(?=[\s,.:#\[{>+~)])')


def collect_used_classes(text, used):
    for m in CLASS_ATTR_RE.finditer(text):
        for cls in m.group(1).split():
            used.add(cls)


def collect_defined_classes(text, defined):
    for m in CSS_SELECTOR_RE.finditer(text):
        defined.add(m.group(1))


def is_probably_utility(cls):
    return cls.startswith(TAILWIND_PREFIXES) or re.match(r"^-?\d", cls) or ":" in cls


def check_important(path, text, findings):
    if os.path.splitext(path)[1].lower() not in STYLE_EXTS:
        return
    count = len(re.findall(r"!important", text))
    if count >= 3:
        findings.append((path, None, "suggestion",
                          f"{count} uses of !important in this file — likely patching over "
                          f"a specificity conflict rather than fixing it"))


def check_brace_balance(path, text, findings):
    if os.path.splitext(path)[1].lower() not in STYLE_EXTS:
        return
    depth = 0
    for i, ch in enumerate(text):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                line = text.count("\n", 0, i) + 1
                findings.append((path, line, "structural",
                                  "unmatched closing } — brace depth went negative"))
                depth = 0
    if depth > 0:
        findings.append((path, None, "structural",
                          f"{depth} unclosed {{ block(s) in this file"))


MAP_RE = re.compile(r"\.map\s*\(")


def check_missing_key(path, text, findings):
    if os.path.splitext(path)[1].lower() not in {".jsx", ".tsx"}:
        return
    for m in MAP_RE.finditer(text):
        window = text[m.end():m.end() + 400]
        if "key=" not in window and "key:" not in window:
            line = text.count("\n", 0, m.start()) + 1
            findings.append((path, line, "flag",
                              ".map() with no visible key= in the next ~400 chars — "
                              "confirm the rendered list has a stable key (needs human "
                              "judgment, do not auto-fix)"))


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    root = sys.argv[1]
    files = find_files(root)
    if not files:
        print(f"No matching files found under {root}")
        sys.exit(0)

    findings = []
    id_locations = defaultdict(list)
    used_classes, defined_classes = set(), set()
    class_definition_site = {}

    for path in files:
        text = read(path)
        if not text:
            continue
        check_tag_balance(path, text, findings)
        check_ids(path, text, id_locations)
        check_important(path, text, findings)
        check_brace_balance(path, text, findings)
        check_missing_key(path, text, findings)
        if os.path.splitext(path)[1].lower() in MARKUP_EXTS:
            collect_used_classes(text, used_classes)
        if os.path.splitext(path)[1].lower() in STYLE_EXTS:
            before = set()
            collect_defined_classes(text, before)
            for c in before:
                class_definition_site.setdefault(c, path)
            defined_classes |= before

    for id_name, locs in id_locations.items():
        if len(locs) > 1:
            where = "; ".join(f"{p}:{ln}" for p, ln in locs)
            findings.append((locs[0][0], locs[0][1], "structural",
                              f'id="{id_name}" appears {len(locs)} times ({where}) — '
                              f"ids must be unique per page"))

    undefined_used = sorted(
        c for c in used_classes
        if c not in defined_classes and not is_probably_utility(c)
    )
    dead_defined = sorted(
        c for c in defined_classes
        if c not in used_classes
    )

    # --- report ---
    by_severity = defaultdict(list)
    for path, line, kind, msg in findings:
        loc = f"{path}:{line}" if line else path
        by_severity[kind].append(f"  {loc} — {msg}")

    print("=== frontend-audit: scan_anomalies.py (heuristic first pass) ===\n")

    if by_severity["structural"]:
        print("STRUCTURAL (tag balance, brace balance, duplicate ids):")
        print("\n".join(sorted(by_severity["structural"])))
        print()

    if by_severity["flag"]:
        print("FLAG FOR HUMAN REVIEW (may touch behavior — do not auto-fix):")
        print("\n".join(sorted(by_severity["flag"])))
        print()

    if by_severity["suggestion"]:
        print("SUGGESTIONS (style smells, not necessarily broken):")
        print("\n".join(sorted(by_severity["suggestion"])))
        print()

    if undefined_used:
        print("CLASSES USED IN MARKUP WITH NO MATCHING CSS RULE FOUND")
        print("(cross-file — may be a broken rename, or a utility-class pattern this")
        print(" script didn't recognize; verify manually before touching):")
        for c in undefined_used:
            print(f"  .{c}")
        print()

    if dead_defined:
        print("CSS CLASSES DEFINED BUT NEVER FOUND IN MARKUP")
        print("(candidates for dead code — verify before deleting, dynamic class names")
        print(" like `item-${i}` won't be caught by this scan):")
        for c in dead_defined[:60]:
            site = class_definition_site.get(c, "")
            print(f"  .{c}  ({site})")
        if len(dead_defined) > 60:
            print(f"  ...and {len(dead_defined) - 60} more")
        print()

    total = sum(len(v) for v in by_severity.values()) + len(undefined_used) + len(dead_defined)
    if total == 0:
        print("No mechanical anomalies found by this heuristic pass.")
        print("This does NOT mean the UI is fine — render it and check visually too.")
    else:
        print(f"{total} leads found. Now go read the checklist and verify each by hand.")


if __name__ == "__main__":
    main()
