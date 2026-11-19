# Design: project-bootstrap

## Overview
A Vite + React + TypeScript app with a pure `src/core` library, Tailwind v4 over the token file, and a small set of Node scripts for compliance and data validation. This spec creates structure only. Domain code arrives in later specs.

## Repository layout (target after this spec)
```
.github/workflows/ci.yml, deploy-pages.yml
.kiro/                      (already present: steering, specs, hooks, agents, settings)
data/                       (already present: formulary, scenarios, vectors)
docs/                       (already present)
e2e/                        playwright specs (smoke only in this spec)
scripts/validate-data.mjs   plain Node, no dependencies
scripts/check-compliance.mjs
scripts/hooks/              hook scripts (already present)
src/core/index.ts           empty public entry (exports nothing yet)
src/ui/main.tsx, App.tsx, shell/*, state/*, styles/index.css, styles/tokens.css
tests/architecture.test.ts, tests/no-hex-colours.test.ts
index.html, vite.config.ts, tsconfig.json, eslint.config.js, vitest.config.ts, playwright.config.ts, package.json
```

## package.json scripts
| Script | Command |
|---|---|
| `dev` | `vite` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint .` |
| `test` | `vitest run` |
| `test:props` | `vitest run tests/properties` |
| `test:props:fast` | `FC_NUM_RUNS=25 vitest run tests/properties` (use `cross-env` for portability) |
| `e2e` | `playwright test` |
| `validate:data` | `node scripts/validate-data.mjs` |
| `check:compliance` | `node scripts/check-compliance.mjs` |
| `check:traceability` | `node scripts/check-traceability.mjs` |
| `build` | `tsc --noEmit && vite build` |

Vitest must not fail when `tests/properties` is still empty: pass `--passWithNoTests` on that script until the first property exists.

## Configuration decisions
- `vite.config.ts`: `base: './'`, plugin `@vitejs/plugin-react`, `@tailwindcss/vite`. Alias `@core` to `src/core` and `@ui` to `src/ui` (mirror in `tsconfig` paths and vitest `resolve.alias`).
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` off (too noisy), `moduleResolution: bundler`, `target: ES2022`, `lib: [ES2022, DOM]` for the UI and a separate `tsconfig.core.json` with `lib: [ES2022]` (no DOM) that includes only `src/core` and `tests/core`-style files, so DOM use in core fails type checking. `typecheck` runs both.
- ESLint: flat config, `typescript-eslint` recommended, `@typescript-eslint/no-explicit-any: error`, `react-hooks` plugin.
- Fast-check: tests read `Number(process.env.FC_NUM_RUNS ?? 100)` through one helper `tests/helpers/fc.ts` exporting `runs()`.
- Playwright: one project (chromium), `webServer` runs `npm run build && npm run preview` on a fixed port; base URL from that.

## Architecture test (`tests/architecture.test.ts`)
Reads every `.ts` file under `src/core` with `fs`, and asserts:
- no import specifier starts with `../ui`, `@ui`, `react` or `node:` (core hashes with `@noble/hashes`, not Node's crypto);
- no match for the forbidden tokens: `Date.now`, `new Date()` (empty parens), `Math.random`, `fetch(`, `localStorage`, `sessionStorage`, `console.`, `document.`, `window.`.
Failures list file and line. The test is allowed to pass vacuously when `src/core` has no files.

## No hard-coded colours test (`tests/no-hex-colours.test.ts`)
Walks `src/ui` for `.ts`, `.tsx`, `.css` files other than `styles/tokens.css`. Fails on `#[0-9a-fA-F]{3,8}\b` and on `rgb(`, `hsl(` literals. Exception: the `rgb(18 38 58 / 0.18)` shadow lives in tokens only.

## Theme handling
`ThemeProvider` holds `'system' | 'light' | 'dark'`. Effect sets `document.documentElement.dataset.theme` for light or dark and removes it for system (tokens file handles `prefers-color-scheme`). Storage key `medgit.theme`, read and written inside try and catch. No flash: an inline script in `index.html` reads storage before first paint and sets `data-theme`.

## App shell (`src/ui/shell`)
`AppShell` renders: skip link, header (mark, case title slot, `SyntheticChip`, role and theme and export slots as placeholders), `<main id="main">`, footer, `LiveRegion` (`aria-live="polite"`). `announce(message)` is exposed through a tiny context so later specs can announce changes. The shell shows a placeholder panel "MedGit is loading scenarios" until the review-ui spec replaces it.

## Fonts
Install `@fontsource/atkinson-hyperlegible-next` and `@fontsource/atkinson-hyperlegible-mono`. Import weights 400, 600 and 700 (Next) and 400 (Mono) in `main.tsx`. If a package name has changed, use the shadcn or Context7 MCP or npm search to find the maintained equivalent and record the change in `docs/KIRO_LOG.md`.

## CI and deployment
`ci.yml`: Node LTS, `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:data`, `npm run build`, `npm run check:compliance`, `npm run check:traceability`. E2E runs in a separate job that installs Playwright browsers and runs `npm run e2e` (allowed to be skipped on pull requests from forks).
`deploy-pages.yml`: on push to `main`, build, `actions/upload-pages-artifact` with `dist`, `actions/deploy-pages`. Permissions: `pages: write`, `id-token: write`, `contents: read`.

## Scripts
`scripts/check-compliance.mjs` (plain Node): checks `LICENSE` exists and its first line matches an OSI licence name (MIT, Apache License, BSD, GNU, ISC, Mozilla); reads `.gitignore` lines and fails if any pattern matches `.kiro` (patterns: `.kiro`, `.kiro/`, `.kiro/*`, `/.kiro`, `**/.kiro`, `*.kiro` and similar; implement with a small matcher and a list of test strings); checks README contains "synthetic" (case-insensitive) and "not for clinical use"; with `--strict`, scans text files for `REPLACE-WITH`, skipping `docs/`, `.kiro/`, `scripts/` and `tests/` because they describe the marker.
`scripts/validate-data.mjs` (plain Node): implements requirement 5 exactly.

## Correctness properties
None. This spec is verified by tests of structure and by CI (see below).

## Testing strategy
- Unit: architecture test, no-hex-colours test (run them once against a deliberately bad temp file to prove they can fail; do not commit the bad file).
- Script tests: `tests/scripts/compliance.test.ts` runs the compliance matcher against sample `.gitignore` contents (including `.kiro`, `.kiro/`, `/.kiro/*`, `*.md`, `node_modules`) and expects the first three to fail and the last two to pass.
- E2E: `e2e/smoke.spec.ts` loads the app, checks the "Synthetic data" chip and footer, toggles the theme, and asserts there were no requests to other origins.
