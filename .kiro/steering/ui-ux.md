---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**", "**/*.css", "e2e/**"]
---
# MedGit: UI and UX steering

Read `docs/UX_SPEC.md` (screens, states, copy) and `docs/DESIGN_SYSTEM.md` (tokens, components) before changing any UI. This file is the short version.

## The idea in one line
A medication chart that reads like a three-way merge editor. Rows are medicines, columns are the source lists. Where sources disagree, a stitched seam runs through the row. Resolving the disagreement closes the seam.

## Identity (do not drift)
- Palette from surgical supplies: drape green-grey background, scrub-navy ink, suture violet for brand and selection, wound crimson for conflicts, chromic green for resolved, iodine amber for escalated. Source identities are four thread colours: prolene blue (hospital), teal (GP), amber-brown (pharmacy), rose (patient). All values live in `src/ui/styles/tokens.css`. Use tokens. Never write a hex value inside a component.
- Type: Atkinson Hyperlegible Next for everything, Atkinson Hyperlegible Mono only for commit ids and marker view. Chosen because drug names and doses must not be misread (0 and O, 1 and l).
- One bold thing: the seam. Everything else stays quiet. No gradients, no decorative illustrations, no glassmorphism, no identical card grid, no tracked-out all-caps labels, no eyebrow labels above headings, no "A · B · C" meta strings, no arrows appended to button text.
- Radii differ by role: cells 4px, rows 6px, dialogs 10px, pills full. Shadows only on popovers and dialogs. Structure comes from lines and spacing.

## Behaviour rules
- Colour is never the only signal. Every state has an icon and a word (Agreed, Needs a decision, Waiting for pharmacist, Resolved, Left off).
- Differing fields inside a cell get the seam underline; matching fields stay plain.
- Motion answers an action: the seam closing on resolve (360 ms), the commit hash settling. Nothing animates on load. Respect `prefers-reduced-motion` by swapping instantly.
- Focus ring is always visible (2 px violet, 2 px offset). Keyboard map is in the UX spec; do not remove shortcuts.
- Copy is plain, sentence case, active voice. Buttons say what they do: "Accept this value", "Include on list", "Ask a pharmacist", "Sign off and commit". The same action keeps the same name in the toast ("Signed off").
- Errors say what happened and what to do. Empty states invite the next action.

## Use the tools, then look at the result
1. shadcn MCP (`@shadcn` registry) to add primitives: button, dialog, sheet, tabs, select, textarea, tooltip, sonner, badge, table, popover, scroll-area. Prefer shadcn primitives over hand-built ones for anything with focus management.
2. Context7 MCP for current library APIs (Tailwind v4, Radix, motion).
3. Playwright MCP to run the dev server, screenshot the screen at 1440x900, 1024x768 and 390x844 in light and dark, and critique against the UX checklist. Do this after every screen, not at the end. The `ui-critic` custom agent does the same read-only.
4. Fix what the screenshots show before moving on.

## Definition of done for any UI task
Tokens only. Light and dark both checked. Keyboard path works. Focus visible. No console errors. Screenshots reviewed at three widths. Strings match the copy deck.
