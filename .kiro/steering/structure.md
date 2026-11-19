---
inclusion: always
---
# MedGit: structure steering

## Repository layout
```
.kiro/               steering, specs, hooks, agents, MCP settings (committed, never ignored)
docs/                PRD, architecture, merge semantics, UX spec, design system, plans
data/                formulary.json and scenarios/*.json (synthetic, golden)
src/core/            pure domain logic (no React, no browser APIs)
src/ui/              React app: state/, screens/, components/, styles/
tests/               golden/, properties/, arbitraries.ts, architecture.test.ts
e2e/                 Playwright specs
mcp/formulary-server/ optional stdio MCP server that wraps src/core normaliser
scripts/             validate-data.mjs, check-compliance.mjs, hooks/*.mjs
powers/              Kiro power stub for the formulary server
```

## Core modules (`src/core`)
`types.ts` shared types. `errors.ts` Result helpers and error codes. `clock.ts` Clock interface. `canonical.ts` canonical JSON and SHA-256 hex. `formulary.ts` load and index formulary. `text.ts` string normalisation. `normalise/` strength, frequency, status, mapDrug, index. `merge.ts` N-way merge. `markers.ts` text conflict markers. `resolve.ts` decisions, validation, draft. `history.ts` commit, verify, log, diff, blame, replay. `casefile.ts` JSON case file. `fhir.ts` FHIR R4 subset. `index.ts` the only public entry point.

UI imports from `src/core/index.ts` only, never from a deep path.

## UI modules (`src/ui`)
`state/` reducer, actions, selectors, store provider. `screens/` Start, Reconcile, History. `components/` small presentational pieces (SourceChip, ClaimCell, ReviewChart, DecisionStrip, SeamLine, MergedList, CommitPanel, RoleSwitch, ExportDialog, Banner). `components/ui/` shadcn-generated primitives (do not hand-edit beyond tokens). `styles/` `tokens.css`, `index.css`.

## Naming
- Files: `camelCase.ts` in core, `PascalCase.tsx` for components.
- Types and interfaces `PascalCase`. Constants `UPPER_SNAKE` only for true constants (error codes, reason codes).
- Conflict ids are `"<drugKey>::<KIND>"`, for example `metformin-tab::FREQUENCY`. Never build them any other way.
- Source ids are lowercase slugs (`hospital`, `gp`, `pharmacy`, `patient`).
- Tests mirror source names: `merge.ts` has `tests/golden/merge.test.ts` and `tests/properties/merge.prop.test.ts`.

## Import rules
- `src/core` imports nothing from `src/ui`, `react`, or `window`/`document`.
- `src/ui` talks to core through reducer actions and selectors. Components do not call core merge or commit functions directly.
- Data files are imported with `resolveJsonModule`, never fetched at runtime.

## Traceability
Every test names the requirement it covers: a comment such as `// Validates: merge-engine 6.1` above the test or property (spec folder name, then requirement and criterion number; several allowed, separated by commas). Every task in a `tasks.md` carries `_Requirements: x.y_`, numbered inside its own spec. Keep both in sync when you change either.
