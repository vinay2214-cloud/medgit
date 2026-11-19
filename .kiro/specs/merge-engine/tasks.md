# Tasks: merge-engine

Prerequisite: formulary-normaliser checkpoint passed (types, normaliser and generators exist). Follow `.kiro/steering/clinical-safety.md`. Do not edit `requirements.md`, `docs/MERGE_SEMANTICS.md` or `data/scenarios/*`; if you think they are wrong, stop and ask.

- [ ] 1. Comparison helpers
  - In `src/core/merge.ts` add `equalStrength`, `equalFrequency`, `compareCodeUnits` (no `localeCompare`), and value-string helpers reused from the normaliser.
  - Unit tests for equality including nulls, unit differences, combination strengths.
  - _Requirements: 2.3, 2.5_

- [ ] 2. Merge function
  - Implement `mergeSources` per design.md: input validation, unanimity classification, conflicts with claims, base labelling, canonical ordering.
  - Table tests: two sources agree, omission, each field conflict, several conflicts on one drug, three and four sources, duplicate ids, too few sources, invalid source.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2, 4.3, 5.1, 5.2, 5.3_

- [ ] 3. Golden merge tests
  - `tests/golden/merge.test.ts` for the three scenarios. Cross-check with `python3 docs/reference/reference.py --check`.
  - _Requirements: 9.5_

- [ ] 4. Generators for merge properties
  - Extend `tests/helpers/gen.ts` with `genSourceLists`, `genBase`, `genValidDecision` as described in design.md.
  - _Requirements: 4.1_

- [ ] 5. Merge properties
  - `tests/properties/merge.props.test.ts`: P-M1, P-M3, P-M4, P-M5, P-M6.
  - Audit: break the omission rule (treat absence as agreement) and confirm P-M1 or P-M4 fails; restore.
  - _Requirements: 2.1, 2.2, 2.3, 2.6, 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 5.4, 9.2_

- [ ] 6. Resolution validation
  - Implement `validateResolution` and `effectiveResolutions` in `src/core/resolve.ts` in the order given in design.md.
  - Table tests for every decision type, every error code, escalation by a clinician, re-decide, seq numbering.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. Draft computation
  - Implement `applyResolutions` per design.md, including supersession and `effective`.
  - Table tests: exclude supersedes field conflicts; include with a pending DOSE keeps the drug out of `entries`; custom value marked manual; latest decision wins.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 8. Resolution and draft properties
  - Add P-M2, P-M7, P-M8 to the properties file.
  - Audit: make `applyResolutions` fall back to the first source's value when a conflict is open and confirm P-M2 fails; restore.
  - _Requirements: 7.2, 7.3, 8.3, 8.4, 8.7, 8.8, 9.1, 9.3_

- [ ] 9. Hero demo golden test
  - `tests/golden/hero-demo.test.ts`: run the `demoScript` through `validateResolution` and `applyResolutions` with fixed times and compare with `expectedAfterDemoScript.entries`.
  - _Requirements: 9.4_

- [ ] 10. Markers
  - Implement `renderMarkers` and P-M9 plus two exact-text golden tests (one FREQUENCY conflict, one OMISSION conflict from the hero scenario).
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 11. Public exports and checkpoint
  - Export the public functions and types from `src/core/index.ts`.
  - Run typecheck, lint, test, test:props (100 runs). Log what the properties caught in `docs/KIRO_LOG.md`.
