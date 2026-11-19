# Tasks: formulary-normaliser

Prerequisite: project-bootstrap checkpoint passed. Follow `.kiro/steering/clinical-safety.md`. Do not edit `requirements.md` or `data/scenarios/*`.
Each task ends with `npm run typecheck && npm test`. Property tasks also run `npm run test:props:fast`.

- [ ] 1. Shared types and Result helpers
  - Create `src/core/types.ts` (all types from `docs/MERGE_SEMANTICS.md` section 2), `src/core/errors.ts` (`Result`, `ok`, `err`, error code unions), `src/core/clock.ts`.
  - _Requirements: 6.1_

- [ ] 2. Text helpers and formulary loader
  - Implement `text.ts` (`norm`, `tokens`) and `formulary.ts` (`loadFormulary`, alias index, collision check).
  - Tests: valid load of `data/formulary.json`; each failure case in requirement 1.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

- [ ] 3. Drug mapping
  - Implement `normalise/mapDrug.ts` and tests (brand names, form tokens, case and punctuation, longest alias first, unmapped slug).
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 4. Strength parsing
  - Implement `normalise/strength.ts` with `parseStrength` and `formatStrength`. Table tests for g, mg, mcg, ug, µg, ml, iu, combinations, 0.05 mg to 50 mcg, absent strength read from name, unreadable text, not-in-formulary.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 5. Frequency parsing
  - Implement `normalise/frequency.ts` with exported synonym sets, `parseFrequency`, `formatFrequency`. Table tests for every synonym, `1-0-1`, `0-0-0`, `1-1-1-1-1`, `2/day`, `5/day`, empty.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 6. Status parsing
  - Implement `normalise/status.ts`. Tests for every word, blank, unknown.
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 7. Item and list normalisation, rendering
  - Implement `normaliseItem`, `normaliseSourceList`, `formatEntry`, `renderRaw`, and the barrel exports in `src/core/index.ts`.
  - Tests: duplicate drug, issue records with index and field, flags, sorting.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2_

- [ ] 8. Golden tests for three scenarios
  - `tests/golden/normalise.test.ts` as in design.md. Confirm against `python3 docs/reference/reference.py --check`.
  - _Requirements: 6.6_

- [ ] 9. Property tests
  - Write generators in `tests/helpers/gen.ts` and properties P-N1 to P-N6 in `tests/properties/normaliser.props.test.ts`, each with a `// Validates: formulary-normaliser x.y` comment.
  - Audit: temporarily break one rule (for example drop the `µg` factor), confirm the matching property fails with a readable counterexample, then restore.
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.3, 6.5, 7.3_

- [ ] 10. Checkpoint
  - typecheck, lint, test, test:props (100 runs), validate:data. Log in `docs/KIRO_LOG.md` how the property tests were used.
