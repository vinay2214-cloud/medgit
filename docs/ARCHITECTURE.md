# MedGit architecture

A static single-page app. All logic runs in the browser. There is no server, no database and no API key. A pure TypeScript core does the work; a React UI shows it.

## 1. Principles
1. **Pure core, thin UI.** Everything that decides anything lives in `src/core` as pure functions. The UI renders state and dispatches actions.
2. **Deterministic.** Same inputs, same outputs, same commit ids. Time is injected.
3. **Types first.** Shared types in one file. No `any`.
4. **Small surface.** One public entry (`src/core/index.ts`). The UI never reaches into core internals.
5. **Verifiable.** Every behaviour has a requirement id, a golden test or a property, and a place in the demo.
6. **Static and free.** The deployed app needs no backend and must stay reachable until 29 Jan 2027.

## 2. Layers

```
 data/*.json  (formulary, scenarios)
      |
      v
 +-----------------------------  src/core  (pure TypeScript)  --------------------------------+
 |  formulary -> normalise -> merge -> resolve(draft) -> history(commit, verify, log, blame)   |
 |                                          casefile (JSON)   fhir (R4 subset)   canonical     |
 +-----------------------------------------------^---------------------------------------------+
                                                 | public API only (src/core/index.ts)
 +-----------------------------  src/ui  (React)  --+--------------------------------------------+
 |  state/reducer  <- actions <- components      selectors (derive merge + draft with useMemo)   |
 |  screens: Start, Reconcile, History      components: ReviewChart, DecisionStrip, ...          |
 +-------------------------------------------------------------------------------------------------+
 optional:  mcp/formulary-server (stdio)  imports core normaliser, exposes 3 tools to Kiro
```

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript strict | Types document the domain for the agents |
| Build | Vite | Fast, static output, relative base for Pages |
| UI | React + Tailwind CSS v4 + shadcn/ui (Radix) | Accessible primitives, tokens map cleanly |
| Icons | lucide-react | Consistent, tree-shaken |
| Motion | `motion` | One orchestrated animation (the seam) |
| Hashing | `@noble/hashes` (sha2) | Synchronous SHA-256, works in tests and browser |
| Tests | Vitest, fast-check, Playwright | Golden, property and one end-to-end flow |
| Fonts | `@fontsource/atkinson-hyperlegible-next`, `-mono` | Legibility for drug names, self-hosted |
| MCP | `@modelcontextprotocol/sdk`, `zod`, `tsx` | Optional formulary server |
| Hosting | GitHub Pages (or Netlify) | Free, static, no keys |

Install current stable versions. Do not pin from memory.

## 4. Core public API (`src/core/index.ts`)

```ts
// result and clock
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
interface Clock { now(): string }                       // ISO 8601 UTC
const systemClock: Clock; const fixedClock: (iso: string) => Clock;

// formulary and normaliser
loadFormulary(json: unknown): Result<Formulary, FormularyError>
normaliseItem(raw: RawItem, f: Formulary): { entry: MedEntry; issues: NormIssue[] }
normaliseSourceList(raw: RawSourceList, f: Formulary): { list: SourceList; issues: NormIssue[] }
renderRaw(entry: MedEntry): RawItem

// merge and resolution
mergeSources(sources: SourceList[], base: Commit | null): Result<MergeResult, MergeError>
validateResolution(merge: MergeResult, existing: Resolution[], candidate: Omit<Resolution, 'seq'>): Result<Resolution, ResolveError>
applyResolutions(merge: MergeResult, resolutions: Resolution[]): Draft
renderMarkers(conflicts: Conflict[], sources: MergeResult['sources']): string      // src/core/markers.ts

// history
commitDraft(input: { merge: MergeResult; draft: Draft; parent: Commit | null; message: string;
                     author: { role: Role; name?: string }; clock: Clock }): Result<Commit, CommitError>
verifyChain(history: Commit[]): Result<true, { code: 'CHAIN_BROKEN'; index: number }>
log(history: Commit[]): LogLine[]
diffCommits(parent: Commit | null, commit: Commit): CommitDiff
blame(history: Commit[]): BlameLine[]
replayPriorCommits(prior: PriorCommit[], f: Formulary): Commit[]

// interop
exportCaseFile(state: CaseState, clock: Clock): string
importCaseFile(text: string): Result<CaseState, { code: 'CASEFILE_INVALID'; message: string }>
toFhirBundle(commit: Commit, clock: Clock): FhirBundle
fromFhirBundle(bundle: unknown): Result<MedEntry[], { code: 'FHIR_INVALID'; message: string }>
```

Types are defined in `docs/MERGE_SEMANTICS.md` section 2 and implemented in `src/core/types.ts`.

## 5. UI state (`src/ui/state`)

```ts
interface AppState {
  view: 'start' | 'reconcile' | 'history';
  theme: 'system' | 'light' | 'dark';
  role: Role;
  scenarioId: string | null;
  rawSources: RawSourceList[];
  sources: SourceList[];                       // normalised
  issues: Record<SourceId, NormIssue[]>;
  history: Commit[];                           // root to head
  resolutions: Resolution[];                   // working events, append-only, since last commit
  ui: { selectedConflictId: ConflictId | null; filter: 'all' | 'open' | 'escalated' | 'resolved';
        boardView: 'chart' | 'markers'; commitMessage: string; historySelection: string | null; };
}
```
`merge` and `draft` are not stored. Selectors derive them with `useMemo` from `sources`, `history` head and `resolutions`.

Actions (all pure; the clock value is passed in by the action creator so the reducer stays deterministic):
`LOAD_SCENARIO`, `IMPORT_CASEFILE`, `SET_ROLE`, `SET_THEME`, `SET_VIEW`, `SELECT_CONFLICT`, `SET_FILTER`, `SET_BOARD_VIEW`, `RESOLVE` (conflictId, decision, reasonCode, note, at), `SET_COMMIT_MESSAGE`, `COMMIT` (at), `RESET_CASE`, `SET_HISTORY_SELECTION`.

`RESOLVE` calls `validateResolution`. On error the reducer leaves state unchanged and records `lastError` for the UI to show. `COMMIT` calls `commitDraft`; on success it appends to `history` and clears `resolutions`.

Persistence: none required. State resets on reload. Case file export and import cover saving.

## 6. Data flow: load, decide, sign off

1. `LOAD_SCENARIO(id)` loads JSON, normalises each source with the formulary, replays `priorCommits` into `history`.
2. Selector: `merge = mergeSources(sources, head)`; `draft = applyResolutions(merge, resolutions)`.
3. UI renders chart rows from `merge` and `draft.states`; merged list from `draft`.
4. `RESOLVE` appends a validated event; selectors recompute; the seam on that row closes.
5. When `draft.canCommit`, `COMMIT` creates the next commit. `resolutions` clear. The next merge uses the new head as base.

## 7. Error model
Expected failures return `Result` with a typed error code (see MERGE_SEMANTICS section 9). The UI maps each code to a plain-language message from the copy deck in `docs/UX_SPEC.md`. Programmer errors throw and are caught by one error boundary that shows a recovery screen.

## 8. Testing strategy
- **Golden** (`tests/golden`): three scenarios, normalised values, conflicts, clean entries, post-demo commit, diff and blame.
- **Property** (`tests/properties`): P-N1..N5, P-M1..M7, P-H1..H4, P-I1..I3, P-U1..U2. Each cites the requirement it validates.
- **Architecture** (`tests/architecture.test.ts`): core imports nothing from UI or React; core contains no `Date.now`, `new Date()` without arguments, `Math.random`, `fetch`, `localStorage`; no hex colours in `src/ui/components`.
- **E2E** (`e2e/hero.spec.ts`): follows `demoScript`, asserts the final list, takes screenshots at three widths. The same script drives the demo recording.

## 9. Build, CI, deploy
- `npm run build` writes `dist/` with `base: './'`.
- CI (`.github/workflows/ci.yml`): typecheck, lint, test (includes properties), build, compliance check.
- Deploy (`.github/workflows/deploy-pages.yml`): publishes `dist/` to GitHub Pages on push to `main`.
- Compliance check (`scripts/check-compliance.mjs`): LICENSE exists, `.kiro/` is not git-ignored, README contains the synthetic-data notice.

## 10. Privacy and security
No network requests at runtime except static assets. No analytics, no cookies, no remote fonts. Data is synthetic. Exports are generated in the browser and downloaded locally. Import size capped at 2 MB. No `eval`, no `dangerouslySetInnerHTML`.

## 11. Decision log

| # | Decision | Reason | Cost |
|---|---|---|---|
| 1 | Client-only static app | Nothing can sleep, expire or run out of credits during judging | No multi-user sync (out of scope) |
| 2 | Unanimity merge with base for labels | Matches clinical reality; never auto-resolves | Not a literal git three-way merge (documented) |
| 3 | Set-based, canonical output | Makes order independence and idempotence testable | A little more code in merge |
| 4 | Structured synthetic input, no free text | Free-text parsing is a research project | Messy scenario shows limits honestly |
| 5 | No runtime LLM | Deterministic, safe, free, offline | Fewer "AI" headlines; the AI is in the build |
| 6 | fast-check properties on the core | Strong fit for EARS requirements; showcases Kiro PBT | Generators need care |
| 7 | FHIR R4 `MedicationStatement` subset, local code system | Interoperability story without terminology servers | Not a validated FHIR profile |
| 8 | shadcn/ui primitives | Accessible focus handling for free | Needs token mapping |

## 12. Extension points (only if time allows)
- `mcp/formulary-server`: stdio server with `normalise_item`, `lookup_drug`, `validate_source_list`; registered in `.kiro/settings/mcp.json` (disabled until built).
- `powers/medgit-formulary`: Kiro power stub that bundles the server and guidance.
- Crew bolt-on: separate repo `medgit-crew` created with `kirocrew app init`, one script cron that digests unresolved conflicts. Do this only after the Day 10 gate.
