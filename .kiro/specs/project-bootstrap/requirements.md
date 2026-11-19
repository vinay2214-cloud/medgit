# Requirements: project-bootstrap

## Introduction
Set up the repository, toolchain, design tokens, app shell, CI and deployment so that every later spec builds on a working, compliant base. Nothing here contains domain logic.

Read first: `AGENTS.md`, `.kiro/steering/tech.md`, `.kiro/steering/structure.md`, `docs/ARCHITECTURE.md` (sections 3, 8, 9), `docs/DESIGN_SYSTEM.md` (sections 2 to 4).

## Requirements

### Requirement 1: Repository compliance
**User Story:** As the builder, I want the repository to meet the hackathon submission rules from the first commit, so that nothing is forgotten at the deadline.

#### Acceptance Criteria
1. THE repository SHALL contain an OSI-approved licence in a file named `LICENSE` at its root.
2. THE repository SHALL track the `.kiro/` directory, and no ignore rule in `.gitignore` SHALL match `.kiro/` or any file inside it.
3. THE `README.md` SHALL state that all data is synthetic and that the application is not for clinical use.
4. THE `README.md` SHALL describe what MedGit is, how to run it, how to test it, where the live app is, and link to `docs/KIRO_LOG.md`.
5. WHEN `npm run check:compliance` runs, THE script SHALL exit with a non-zero status if criterion 1, 2 or 3 is violated, and SHALL print which rule failed.
6. WHEN `npm run check:compliance -- --strict` runs, THE script SHALL additionally fail if any deliverable file (anything outside `docs/`, `.kiro/`, `scripts/` and `tests/`, which describe the marker) contains the text `REPLACE-WITH`.

### Requirement 2: Toolchain
**User Story:** As the builder, I want a consistent set of commands, so that humans, hooks, CI and agents all run the same checks.

#### Acceptance Criteria
1. THE project SHALL provide these npm scripts: `dev`, `typecheck`, `lint`, `test`, `test:props`, `test:props:fast`, `e2e`, `validate:data`, `check:compliance`, `check:traceability`, `build`.
2. THE TypeScript configuration SHALL enable `strict` and `noUncheckedIndexedAccess`.
3. THE lint configuration SHALL report an error for any explicit `any`.
4. WHEN `npm run build` runs, THE build SHALL write static files to `dist/` that work when served from a sub-path (relative asset base).
5. WHEN `npm run test:props:fast` runs, THE property tests SHALL run 25 cases each; WHEN `npm run test:props` runs, they SHALL run the number in the `FC_NUM_RUNS` environment variable, defaulting to 100.
6. THE project SHALL include an architecture test that fails if any file in `src/core` imports from `src/ui`, `react`, or any browser-only module, or contains `Date.now`, `new Date()` with no argument, `Math.random`, `fetch`, `localStorage` or `console.`.

### Requirement 3: Design tokens and application shell
**User Story:** As a user, I want a consistent, accessible frame around the product, so that I always know where I am and that the data is synthetic.

#### Acceptance Criteria
1. THE application SHALL load `src/ui/styles/tokens.css` once and expose its values to Tailwind through a `@theme inline` mapping, as in `docs/DESIGN_SYSTEM.md` section 3.
2. THE application SHALL self-host Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono and SHALL NOT request fonts from any remote host.
3. WHEN the user selects the theme Light, Dark or System, THE application SHALL apply it immediately by setting or removing the `data-theme` attribute on the root element.
4. WHEN the theme changes, THE application SHALL remember the choice for the next visit using browser storage guarded by try and catch, and SHALL work normally if storage is unavailable.
5. THE application shell SHALL show the product mark, a "Synthetic data" chip at every viewport width, and a footer containing the text "Synthetic data. Not for clinical use."
6. THE application shell SHALL provide a polite live region for announcements and a visible keyboard focus ring on every interactive element.
7. IF a hex colour literal appears in any file under `src/ui` other than `src/ui/styles/tokens.css`, THEN a test SHALL fail and name the file and line.
8. WHERE the user's system requests reduced motion, THE application SHALL set all animation durations defined in the tokens to zero.

### Requirement 4: Continuous integration and deployment
**User Story:** As the builder, I want every push checked and the app deployed automatically, so that the working URL is always current.

#### Acceptance Criteria
1. WHEN code is pushed or a pull request is opened, THE CI workflow SHALL run install, typecheck, lint, test, validate:data, build, check:compliance and check:traceability, and SHALL fail if any step fails.
2. WHEN code is pushed to `main`, THE deploy workflow SHALL build the app and publish `dist/` to GitHub Pages.
3. WHEN the deployed app loads, THE browser SHALL make no network request to any origin other than the app's own origin (verified by an end-to-end test).

### Requirement 5: Data validation
**User Story:** As the builder, I want the demo data checked automatically, so that a broken fixture never reaches the tests or the demo.

#### Acceptance Criteria
1. WHEN `npm run validate:data` runs, THE script SHALL check that `data/formulary.json` has schema `medgit.formulary/1`, unique item ids, and every item has the fields id, ingredient, display, form, route, canonicalUnit, strengths and aliases.
2. THE script SHALL fail if two different formulary items share an alias after normalisation (lower case, runs of non-alphanumerics collapsed to one space).
3. THE script SHALL check that every file in `data/scenarios` has schema `medgit.scenario/1`, a non-empty `syntheticNotice`, at least two sources with unique ids, and an `expected` block.
4. THE script SHALL check that every conflict id in `expected.conflicts` has the form `<drugKey>::<KIND>` with KIND one of OMISSION, DOSE, FREQUENCY, STATUS, and that every drugKey is a formulary id or starts with `unmapped:`.
5. THE script SHALL check that every `conflictId` in a scenario's `demoScript` exists in that scenario's `expected.conflicts`.
6. THE script SHALL check that `data/vectors/canonical.json` parses and that each vector has `canonical` and `sha256` fields.
7. IF any check fails, THEN THE script SHALL print the file and the reason and exit non-zero.
