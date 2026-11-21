# Tasks: interop-export

Prerequisite: history-audit checkpoint passed. Do not edit `requirements.md`. No synthetic marker may be removed from any export.

- [x] 1. Case file types and export
  - Create `src/core/casefile.ts` with `CaseState` and `exportCaseFile` (fixed key order, two-space indent).
  - Test determinism and key order.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Case file import and guards
  - Implement the guards and `importCaseFile` with limits and first-error messages. Drop unknown fields.
  - Table tests: each limit, wrong schema, wrong types in nested fields, non-JSON, empty string, a broken chain still imports.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Case file properties
  - Generators `genCaseState`, `genAnyJson`; properties P-I1 and P-I2.
  - Audit: make export drop `resolutions` and confirm P-I1 fails; restore.
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 4. FHIR export
  - Implement `toFhirBundle` in `src/core/fhir.ts` per design.md, including the reason-label map and the note rules.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 5. FHIR golden tests
  - `tests/golden/fhir.test.ts` from the hero demo commit.
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.9_

- [x] 6. Case file golden test
  - `tests/golden/casefile.test.ts` as in design.md.
  - _Requirements: 1.1, 2.1, 2.5_

- [x] 7. Exports and checkpoint for requirements 1 to 3
  - Export from `src/core/index.ts`. Run typecheck, lint, test, test:props.
  - Stop here if the review-ui spec is not finished. Requirement 4 comes after the review-ui checkpoint.

- [x] 8. FHIR import (cut first)
  - Only after the review-ui checkpoint: implement `fromFhirBundle`, property P-I3, tests for invalid input.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
