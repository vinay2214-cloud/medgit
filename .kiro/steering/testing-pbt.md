---
inclusion: fileMatch
fileMatchPattern: ["tests/**", "**/*.test.ts", "**/*.prop.test.ts"]
---
# MedGit: testing and property-based testing steering

## Three layers
1. **Golden tests** (`tests/golden/`): run the real scenarios in `data/scenarios/*.json` and compare to the `expected` block. These are fixed, human-checked answers.
2. **Property tests** (`tests/properties/*.prop.test.ts`): fast-check properties derived from the EARS requirements and the "Correctness Properties" in each `design.md`.
3. **One Playwright flow** (`e2e/hero.spec.ts`): the hero scenario from first screen to commit.

## Property conventions
- One `describe` per spec. One `it` per property, named `P-M2 order independence` style, with `// Validates: merge-engine 7.2` above it (spec folder name, then requirement and criterion number).
- Generators live in `tests/arbitraries.ts`. Keep the universe small so interesting cases are common: 6 drug keys, 2 or 3 values per field, 2 to 4 sources, 0 to 6 entries per source. Large random universes make conflicts rare and the properties pass for the wrong reason.
- Read `process.env.FC_NUM_RUNS` for `numRuns` (default 100; the save hook uses 25).
- Log the seed on failure (`fc.assert(..., { verbose: 1 })`). Paste real counterexamples into `docs/KIRO_LOG.md`.
- Never weaken a property to make it pass. A failing property means the code, the requirement or the generator is wrong. Say which, then fix that one.
- Never reimplement the code under test inside the property. Check an independent statement (for example "conflicts are empty if and only if all source lists are equal").
- Audit rule: a property that cannot fail is not a test. After writing one, break the code on purpose in a scratch edit, watch it fail and shrink, then revert.

## Golden tests
- Compare normalised summaries with the strings in `expected.normalised`, conflicts with `expected.conflicts`, clean entries with `expected.clean`.
- If a golden test fails, fix the code. If the golden value looks wrong, stop and ask the human.

## Tooling notes
- Kiro generates and runs property-based tests only in the IDE. The CLI and Web run them as ordinary Vitest tests via `npm run test:props`.
- Keep each test file under ~300 lines. Split by spec.
