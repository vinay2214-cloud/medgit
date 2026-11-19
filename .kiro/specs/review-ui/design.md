# Design: review-ui

## Overview
React views over the core library. A single reducer holds state; selectors derive everything else with the core functions. Components are presentational where possible. All look-and-feel decisions come from `docs/DESIGN_SYSTEM.md`; all strings from `src/ui/copy.ts`, which mirrors the copy deck in `docs/UX_SPEC.md` section 8.

## File layout
```
src/ui/
  main.tsx, App.tsx
  copy.ts                      copy deck as a typed object, plus tiny format helpers (plural, template)
  format.ts                    display formatting for cells: "500 mg", "2 / day", "as needed", "stopped"
  data.ts                      imports data/formulary.json and data/scenarios/*.json (resolveJsonModule); loadFormulary once
  state/
    types.ts                   AppState, Action
    reducer.ts                 makeReducer(formulary): (state, action) => state
    selectors.ts               pure view-model builders
    store.tsx                  context + useReducer provider, dispatch helpers that add `at` from systemClock
    focus.ts                   focus request channel (see below)
  shell/                       AppShell, Header, SyntheticChip, RoleSwitch, ThemeMenu, ExportMenu, LiveRegion, ErrorBoundary
  views/                       StartView, ReconcileView, HistoryView
  components/                  SummaryBar, ReviewChart, ChartRow, ChartRowCard, ValueCell, SourceHead, SeamLine, StatePill,
                               DecisionStrip, ClaimRow, ValueInput, MergedList, CommitPanel, MarkerView,
                               IssuesPanel, HistoryLog, CommitDetail, DiffLines, BlameList, ScenarioList
  hooks/                       useMediaQuery, useDownload
  styles/                      index.css, tokens.css
```

## State (`state/types.ts`)
```ts
type View = 'start' | 'reconcile' | 'history';
interface AppState {
  view: View; theme: 'system' | 'light' | 'dark'; role: Role;
  scenarioId: string | null; scenarioTitle: string | null;
  patient: CaseState['patient'] | null; syntheticNotice: string | null;
  rawSources: RawSourceList[]; sources: SourceList[]; issues: Record<SourceId, NormIssue[]>;
  history: Commit[]; resolutions: Resolution[];
  ui: { selectedConflictId: ConflictId | null; filter: 'all' | 'open' | 'escalated' | 'resolved';
        boardView: 'chart' | 'markers'; commitMessage: string; historySelection: string | null;
        lastCommitId: string | null };
  lastError: { code: string; message?: string } | null;
  announcement: { id: number; text: string } | null;      // id increments so the same text is re-announced
}
```
Reducer actions (all carry everything they need; time arrives as `at: string`):
`LOAD_SCENARIO{scenario}`, `IMPORT_CASEFILE{state}`, `SET_ROLE{role}`, `SET_THEME{theme}`, `SET_VIEW{view}`, `SELECT_CONFLICT{id}`, `SET_FILTER{filter}`, `SET_BOARD_VIEW{view}`, `RESOLVE{conflictId, decision, reasonCode, note?, at}`, `UNDO_LAST{conflictId, at}`, `SET_COMMIT_MESSAGE{text}`, `COMMIT{at}`, `RESET_CASE`, `SET_HISTORY_SELECTION{id}`, `CLEAR_ERROR`.

Reducer rules:
- `LOAD_SCENARIO`: `sources = scenario.sources.map(normaliseSourceList)`; `issues` per source; `history = replayPriorCommits(scenario.priorCommits, formulary)`; `resolutions = []`; `view = 'reconcile'`; select the first conflict id of the merge if any; `announcement` = scenario opened.
- `RESOLVE`: compute `merge` (core); if merge fails set `lastError` and return. Call `validateResolution(merge, state.resolutions, {conflictId, decision, reasonCode, note, by: {role, name: demoName(role)}, at})`. On error set `lastError = {code}` and return state otherwise unchanged. On success append, clear error, set `announcement` ("<medicine>: <kind> decided. <n> to decide." or escalated text).
- `UNDO_LAST`: find the events for the conflict sorted by `seq`; need at least two; re-append the second newest event's decision, reason and note as a new event through `validateResolution` with the current role.
- `COMMIT`: merge, draft, `commitDraft({ merge, draft, parent: head, message: ui.commitMessage, author: {role, name: demoName(role)}, clock: fixedClock(at) })`. On error set `lastError`. On success: append, clear resolutions and message, set `ui.lastCommitId`, announcement.
- `demoName(role)` returns `"Demo Clinician"` or `"Demo Pharmacist"`; these names are labelled demo data.
- The reducer never calls `Date`, storage or network. Theme persistence happens in the `ThemeProvider` (bootstrap spec).
- `makeReducer(formulary)` returns the reducer so the formulary is a closure value.

## Selectors (`state/selectors.ts`), all pure
- `selectMerge(state)`: `mergeSources(state.sources, head)`.
- `selectDraft(state)`: `applyResolutions(merge, state.resolutions)`.
- `selectCounters(state)`: `{ toDecide, escalated, agreed }` from `draft.states` and `merge.clean.length`.
- `selectChartRows(state)`: view-models. Row per drugKey (union of `clean` and conflicts), sorted by display name (code-unit compare of lower-cased names, then drugKey). Fields: `drugKey, displayName, rowState ('agreed' | 'open' | 'escalated' | 'resolved' | 'superseded'), conflicts: {id, kind, state}[], cells: {sourceId, value: {strength, frequency, status} | null, inConflict: Set<'strength'|'frequency'|'status'|'omission'>}[]`. Row state precedence: any open gives open; else any escalated gives escalated; else if excluded gives superseded; else resolved; clean gives agreed.
- `selectMergedLines(state)`: from `draft.entries` and `draft.effective`, with provenance; plus ghost lines for `pendingDrugKeys`; plus the excluded count.
- `selectStrip(state)`: selected conflict, its claims with source labels and as-of dates, the options, the effective resolution, whether the role may decide, the earlier events (for Undo).
- `selectHistoryView(state)`: log, chain status, selected commit, diff against its parent, blame for the history up to the selected commit.
- `selectIssues(state)`.
- `nextOpenRow(rows, fromDrugKey)`: next row whose state is open or escalated (wrapping), or null.
Selectors do not format strings for display other than through `format.ts` and `copy.ts`.

## Layout
Breakpoints (CSS): wide at 1280 and up; medium 768 to 1279; narrow below 768. `useMediaQuery` chooses where the single `DecisionStrip` instance is rendered: beside the chart (wide), inside a right `Sheet` (medium), inside a bottom `Sheet` (narrow). Never render two strips.
Chart: CSS grid. `grid-template-columns: minmax(180px, 1.4fr) repeat(var(--n-sources), minmax(110px, 1fr)) 160px;` with `--n-sources` set inline. Row min height 64 px. The seam is an absolutely positioned SVG at the bottom edge of the row. On narrow widths the grid is replaced by `ChartRowCard` (medicine name, pill, vertical list of source values).
Commit panel: below the merged list on wide and medium; a sticky bottom bar on narrow, with the top-edge seam.

## Components that need detail
- **ReviewChart**: `role="grid"`, `aria-label` from copy, rows `role="row"` with `aria-selected`, cells `role="gridcell"`. One element has `tabIndex=0` (the active row); others `-1`. Keys: ArrowUp, ArrowDown, Home, End move the active row; Enter and Space select it. Row accessible name from requirement 4.8, set with `aria-label` on the row.
- **ChartRow**: stable `key={drugKey}` so the seam transition runs when `data-state` changes. If a filter hides a row as it resolves, the animation is not visible; the default filter is All.
- **SeamLine**: per `docs/DESIGN_SYSTEM.md` section 6.
- **DecisionStrip**: a form. Radio group name "decision". Options built by `selectStrip`. "Enter a different value" shows `ValueInput`: for DOSE, a number input (step any, min above 0) plus a unit select (mg, mcg, ml, iu) and optional second number for combinations; for FREQUENCY, a select of `1/day, 2/day, 3/day, 4/day, as needed`; for STATUS, a select of active, stopped, on hold. The reason select is a native `<select>` with an empty first option "Choose a reason". Apply is disabled until decision, valid custom value (if any) and reason are set. Escalate is always enabled when the strip is. Disabled-by-role state per requirements 6.7 and 6.8.
- **Focus management** (`state/focus.ts`): a tiny channel `requestFocus(target)` with targets `{kind:'row', drugKey}`, `{kind:'commit-message'}`, `{kind:'history-link'}`. Components with matching `data-focus-id` call `.focus()` in an effect after render. After a successful `RESOLVE`, the handler computes `nextOpenRow` (from the next state's rows) and requests focus; if none and `canCommit`, `commit-message`. In drawer and sheet modes, closing returns focus to the row that opened it (Radix does this when the trigger is a ref; otherwise request focus explicitly).
- **MarkerView**: `<pre>` blocks from `renderMarkers` split per conflict (call it once per conflict so each block is selectable), each block a button-like element with `role="button"`, `tabIndex=0`, state pill, Enter to select.
- **HistoryView**: master-detail. `CommitDetail` tabs use shadcn `Tabs`. "Last changed" toggle is a `Switch`-like toggle button with `aria-pressed`.
- **IssuesPanel**: shadcn-free disclosure using `<details>`/`<summary>` styled with tokens.
- **ExportMenu** and **ImportButton**: `useDownload` creates a `Blob` and an object URL, clicks a temporary anchor, revokes the URL. File input is a visually hidden `<input type=file>` triggered by a button. Size check before `FileReader`.

## Test ids (stable contract for component tests and Playwright)
`row-<drugKey>`, `strip`, `strip-tab-<KIND>`, `option-choose-<sourceId>`, `option-custom`, `option-include`, `option-exclude`, `reason-select`, `note-input`, `apply`, `escalate`, `undo`, `role-clinician`, `role-pharmacist`, `counter-open`, `counter-escalated`, `counter-agreed`, `merged-list`, `merged-line-<drugKey>`, `commit-message`, `sign-off`, `commit-id`, `history-link`, `log-item-<n>`, `tab-changes`, `tab-list`, `tab-decisions`, `toggle-last-changed`, `chain-status`, `scenario-open-<id>`, `import-input`, `export-menu`, `export-case`, `export-fhir`, `problems-panel`, `view-chart`, `view-markers`, `filter-<name>`.

## Correctness properties (fast-check, reducer and selector level, no DOM)
Generators: a random action sequence generator over a loaded scenario (hero, clean, messy), choosing from valid and invalid RESOLVE actions (random decision types, sources, reasons, roles), SET_ROLE, COMMIT with random messages, UNDO_LAST, with monotonically increasing `at` strings.
- **P-U1 State safety.** After any action sequence: `verifyChain(state.history)` succeeds; every commit was created while `canCommit` was true (check by replaying: the commit's resolutions cover every conflict of its merge); a `COMMIT` dispatched while `canCommit` is false leaves `history` unchanged. Validates: review-ui 2.4, 2.5.
- **P-U2 Invalid decisions change nothing.** Whenever `validateResolution` would return an error for a `RESOLVE`, the reducer returns the same `resolutions` array reference contents (deep equal) and sets `lastError`. Validates: review-ui 2.3.
- **P-U3 View agrees with core.** For any reachable state, `selectCounters` equals the counts computed from `draft.states`; `selectMergedLines` shows exactly `draft.entries` and `draft.pendingDrugKeys`; no row shows a value that is not in a claim or in the clean entry. Validates: review-ui 3.2, 7.4.

## Component tests (Vitest, jsdom, @testing-library/react)
`SeamLine` has the right `data-state` and is `aria-hidden`; `StatePill` has text and an icon for each state; `ChartRow` accessible name for agreed, single-conflict and two-conflict rows; `DecisionStrip` disables options and Apply for a clinician on an escalated conflict and enables them for a pharmacist, shows the right options for each kind, shows the inline error for an invalid custom value; `CommitPanel` text and disabled state with 0, 1 and 3 pending (singular and plural); `HistoryView` shows "Chain broken at commit 2" for a tampered history.

## End-to-end tests (Playwright, `e2e/`)
- `hero.spec.ts`: requirement 17. Use the test ids above. Drive `demoScript` from `data/scenarios/hero.json`.
- `a11y.spec.ts`: axe scan of Start, Reconcile (Hero open) and History, light and dark, failing on serious and critical.
- `screens.spec.ts`: screenshots into `e2e/__screens__/` (git-ignored except `README` samples), at the sizes in requirement 17.3. The `ui-critic` agent reads these.
- `import-export.spec.ts`: export the case file after the demo, reload, import it, and see the same history; import a corrupted file and see the error message.

## Error handling
Core `Result` errors map to copy through `copyForError(code)`. Unknown codes use `err.generic`. `ErrorBoundary` catches render errors only.

## Performance
Memoise selectors with `useMemo` keyed on `sources`, `history`, `resolutions`. The data sets are tiny; no virtualisation.

## Build order (also the task order)
Shell and state first, then Start, then the chart with the seam (the hero moment), then the strip, then merged list and commit, then history, then import and export, then markers, then polish and the e2e suite.
