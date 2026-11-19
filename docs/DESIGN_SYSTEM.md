# MedGit design system

Identity: **surgical supply room, medication chart, one stitched seam.** Calm, exact, legible. Spend the boldness in one place: the seam. Everything else is quiet.

Tokens live in `src/ui/styles/tokens.css` and are the only place colour values exist. This file explains how to use them. UX behaviour is in `docs/UX_SPEC.md`.

## 1. Why this look (so agents can extend it without drifting)
- The palette comes from the subject: drape green-grey for the background, scrub navy for ink, suture violet for selection and brand, wound crimson for conflict, chromic green for resolved, iodine amber for escalated. Four thread colours (prolene blue, teal, amber-brown, rose) identify sources.
- The layout comes from the subject: a **medication chart** (a matrix of medicines by source), not a dashboard of cards.
- The one bold element: the **seam**, a dashed stitch line that closes when a conflict is decided. It is the only decorative element in the product.
- Avoid the generic defaults: no cream and terracotta, no near-black with a neon accent, no identical rounded cards with soft shadows, no gradient washes, no tracked all-caps eyebrow labels, no middle-dot meta strings, no arrow glyphs appended to buttons, no fade-and-slide entrances on every section.

## 2. Tokens

### Colour (semantic names)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #e6eeec | #0d1a1e | page background |
| `--surface` | #ffffff | #14242a | chart, strip, panels |
| `--surface-2` | #f1f5f4 | #1b2f36 | zebra, inputs, hover |
| `--line` | #c5d2cf | #2b4048 | decorative dividers only |
| `--line-strong` | #6b7f86 | #7c969e | input borders, anything that must be seen |
| `--ink` | #12263a | #e7eef0 | text |
| `--ink-muted` | #4a5b6b | #9fb2b8 | secondary text |
| `--violet` / `--on-violet` | #5b3fa0 / #fff | #bba6f5 / #1a0f3a | brand, selection, primary button |
| `--focus` | = violet | = violet | focus ring |
| `--conflict-fg/bg` | #a3213a / #fbe6ea | #ff9dae / #3a1520 | open conflict |
| `--resolved-fg/bg` | #17663f / #e1f3e9 | #7fdda9 / #12301f | decided |
| `--escalated-fg/bg` | #8a4f00 / #fff0d1 | #f6bf63 / #3a2a0a | with pharmacist |
| `--agreed-fg/bg` | #1f4e79 / #e4eef7 | #8fc1ee / #12283c | agreed by all |
| `--src-hospital` | #2257b0 | #8db4f5 | source thread |
| `--src-gp` | #0f766e | #5fd4c8 | source thread |
| `--src-pharmacy` | #8a5200 | #f0b15c | source thread |
| `--src-patient` | #a3315f | #f2a0c4 | source thread |

Rules: text on `--bg` or `--surface` uses `--ink` or `--ink-muted`. State colours are used as `fg` text/icon on `bg` fill, never as fill with white text. Source colours mark a thread (a 3 px underline or a dot with a label), never a large fill. Unknown sources (imports) take the next colour from a fixed rotation of the four, by sorted id.

### Type
Fonts: Atkinson Hyperlegible Next (UI) and Atkinson Hyperlegible Mono (ids, markers). Chosen for character distinction in drug names and digits. Self-hosted through `@fontsource` packages. Digits use `font-variant-numeric: tabular-nums`.

| Role | Size / line | Weight | Use |
|---|---|---|---|
| display | 36 / 1.15 | 700 | Start title only |
| title | 22 / 1.25 | 700 | view titles, strip header |
| heading | 18 / 1.3 | 600 | panel titles |
| body | 16 / 1.5 | 400 | default |
| data | 14 / 1.4 | 400, 600 for the value | chart cells, lists |
| small | 13 / 1.4 | 400 | pills, captions, asOf dates |
| mono | 13 / 1.4 | 400 | ids, markers |

Sentence case everywhere. No all caps. Maximum line length for prose 70 characters. Drug names never truncate; they wrap.

### Space and shape
Scale 4, 8, 12, 16, 24, 32, 48 (`--space-1..7`). Radii: cells 4, rows 6, dialogs 10, pills 999. Elevation: none, except popovers and dialogs (`--shadow-pop`). Separation comes from borders and spacing, not shadows. Maximum content width 1440 px, centred.

### Motion
One orchestrated motion: the seam closing (360 ms ease-out). Secondary: state colour crossfade 160 ms, drawer open 200 ms. Everything else is instant. `prefers-reduced-motion` sets all durations to 0.

## 3. Tailwind v4 mapping
`src/ui/styles/index.css`:

```css
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-violet: var(--violet);
  --color-on-violet: var(--on-violet);
  --color-conflict: var(--conflict-fg);
  --color-conflict-bg: var(--conflict-bg);
  --color-resolved: var(--resolved-fg);
  --color-resolved-bg: var(--resolved-bg);
  --color-escalated: var(--escalated-fg);
  --color-escalated-bg: var(--escalated-bg);
  --color-agreed: var(--agreed-fg);
  --color-agreed-bg: var(--agreed-bg);
  --color-src-hospital: var(--src-hospital);
  --color-src-gp: var(--src-gp);
  --color-src-pharmacy: var(--src-pharmacy);
  --color-src-patient: var(--src-patient);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --radius-cell: var(--radius-cell);
  --radius-row: var(--radius-row);
  --radius-dialog: var(--radius-dialog);
}

html { background: var(--bg); color: var(--ink); font-family: var(--font-sans); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```
Themes swap through tokens (`data-theme` on `<html>`), so do not use Tailwind `dark:` utilities.

## 4. shadcn/ui setup
Use the shadcn MCP server (`npx shadcn@latest mcp`, configured in `.kiro/settings/mcp.json`) to browse and add components.

```
npx shadcn@latest init        # Vite, TypeScript, CSS variables: yes
npx shadcn@latest add button radio-group textarea tabs dropdown-menu tooltip toggle-group badge alert sheet dialog
```
Then remap the generated semantic variables to MedGit tokens (append to `index.css`, replacing what init wrote):

| shadcn variable | MedGit token |
|---|---|
| `--background` | `--bg` |
| `--foreground` | `--ink` |
| `--card`, `--popover` | `--surface` |
| `--card-foreground`, `--popover-foreground` | `--ink` |
| `--primary` / `--primary-foreground` | `--violet` / `--on-violet` |
| `--secondary`, `--muted`, `--accent` | `--surface-2` |
| `--muted-foreground` | `--ink-muted` |
| `--destructive` | `--conflict-fg` |
| `--border` | `--line` |
| `--input` | `--line-strong` |
| `--ring` | `--focus` |
| `--radius` | `--radius-row` |

The reason field uses a native `<select>` styled with tokens (better on mobile, simpler for assistive technology and tests), so the shadcn `select` is not installed.

Rules for generated components: keep their Radix behaviour and ARIA; change only classes. Replace any hard-coded colour with a token. Do not install more components than listed without a reason in the task.

## 5. Component inventory
All in `src/ui/components`. Pure presentational components take props and callbacks; connected components read the store.

| Component | Purpose | Notes |
|---|---|---|
| `AppShell` | Header, main, footer, live region | Hosts the polite live region |
| `SyntheticChip` | "Synthetic data" chip | Always visible |
| `RoleSwitch` | Clinician or Pharmacist | `ToggleGroup`, labelled |
| `ThemeMenu`, `ExportMenu` | Menus | `DropdownMenu` |
| `ScenarioList` | Start rows | A ledger list, hero row larger, not a card grid |
| `SummaryBar` | Counters, filter, view toggle | Counters have icon, number, text |
| `ReviewChart` | The matrix | Roving tabindex, grid semantics |
| `ChartRow` | One medicine | States: agreed, open, escalated, resolved, superseded |
| `ValueCell` | A source's value | Strength line, frequency line, thread underline |
| `SourceHead` | Column header | Thread chip and asOf |
| `SeamLine` | The stitch | See section 6 |
| `StatePill` | State or kind label | Icon plus text, `fg` on `bg` |
| `DecisionStrip` | Right panel or drawer or sheet | Radio group, select, note, actions |
| `ClaimRow` | One claimant | Thread chip, label, value, asOf |
| `ValueInput` | Strength, frequency, status entry | Validates with core parsers |
| `MergedList`, `MergedLine` | Reconciled list | Provenance chip |
| `CommitPanel` | Message and sign off | Top edge is a seam reflecting overall state |
| `MarkerView` | Text markers | Mono font; uses `renderMarkers` |
| `HistoryLog`, `CommitDetail`, `DiffLines`, `BlameList` | History view | |
| `IssuesPanel` | Normaliser problems | Collapsible |
| `ErrorBoundary`, `InlineAlert` | Errors | Copy from the deck |

## 6. The seam
Implementation (one component, SVG, no library):

```tsx
export function SeamLine({ state }: { state: 'open' | 'escalated' | 'resolved' }) {
  return (
    <svg className="seam" data-state={state} aria-hidden="true" height="6" width="100%">
      <line x1="0" y1="3" x2="100%" y2="3" />
    </svg>
  );
}
```
```css
.seam line {
  stroke-width: var(--seam-width);
  stroke-linecap: round;
  transition: stroke-dasharray var(--seam-close-ms) ease-out, stroke 160ms linear;
}
.seam[data-state="open"] line      { stroke: var(--seam-open);    stroke-dasharray: var(--seam-dash); }
.seam[data-state="escalated"] line { stroke: var(--escalated-fg); stroke-dasharray: var(--seam-dash); }
.seam[data-state="resolved"] line  { stroke: var(--seam-closed);  stroke-dasharray: var(--seam-dash-closed); }
```
Dash lists have the same length (two numbers), so the browser interpolates from `7 5` to `12 0`: the stitches grow into a solid line while the colour changes. The seam is `aria-hidden`; state is always also in a `StatePill` and in the row's accessible name.

Where the seam may appear (and nowhere else): under conflict rows in the chart, on the top edge of the commit panel (dashed amber or red while anything is pending, solid green when ready to sign off), and in the logo glyph. Do not add it to buttons, cards, headings, backgrounds or loaders.

## 7. Component rules that matter
- **Chart cells**: value text 14 px, strength semi-bold. Disagreeing cells get a 3 px underline in the source thread colour; agreeing cells get no underline. The seam sits under the whole row.
- **Pills**: height 24 px, padding 4 x 10, 13 px text, icon 14 px. Pill text is the state or kind label from the copy deck.
- **Buttons**: primary is violet filled; secondary is outlined with `--line-strong`; destructive styling is not used (no destructive actions exist). Minimum height 40 px.
- **Inputs**: 40 px high, `--line-strong` border, visible label, error text in `--conflict-fg` with an icon.
- **Tables and lists**: no zebra on the chart (the seam and pills carry state); zebra allowed in the merged list and log with `--surface-2`.
- **Icons** (lucide-react, 16 or 20 px, stroke 1.75): conflict `TriangleAlert`, escalated `UserRoundCheck`, resolved `CircleCheck`, agreed `Check`, omission `CircleSlash`, history `History`, commit `GitCommitHorizontal`, merge `GitMerge`, export `Download`, import `Upload`, theme `Sun`, `Moon`, `Monitor`. Confirm each name exists in the installed version before use; pick the nearest if not.
- **Density**: row height 64 px in the chart on desktop; 56 px minimum.

## 8. Agent workflow for UI work
1. Read `.kiro/steering/ui-ux.md`, this file and the relevant part of `docs/UX_SPEC.md`.
2. Use the **shadcn MCP** to look up the primitive; use **Context7** for current Tailwind v4, Radix, motion and React docs rather than recalling from memory.
3. Build the component against tokens only.
4. Use the **Playwright MCP** to open the dev server and take screenshots at 1440x900, 1024x768 and 390x844 in light and dark. Look at them. Fix spacing, overflow, contrast and state clarity. Repeat until clean.
5. Run the `ui-critic` agent for an independent critique against this file and the UX spec.
6. Run `npm run test` and the axe check in e2e before reporting done.

Optional: if the human connects the Kiro Figma power, a Figma frame may be used as a reference for a screen, but this repo is the source of truth for tokens.

## 9. Do and do not
| Do | Do not |
|---|---|
| Use tokens through Tailwind names | Write a hex colour in a component |
| Show state with text, icon and colour | Rely on colour alone |
| Let the seam be the only decoration | Add gradients, glows, illustrations or emoji |
| Keep copy from the deck | Invent friendly microcopy or jokes |
| Keep layout a matrix of medicines by source | Turn rows into a grid of identical cards |
| Animate only the seam closing | Add entrance animations or hover flourishes |
| Test with long drug names and four to six sources | Assume short strings |
