# Tasks: history-audit

Prerequisite: merge-engine checkpoint passed. Do not edit `requirements.md` or `data/*`.

- [x] 1. Canonical JSON and SHA-256
  - Implement `src/core/canonical.ts` (`canonicalise`, `sha256Hex`) with `@noble/hashes` (v2: import from `@noble/hashes/sha2.js` and `@noble/hashes/utils.js`). Verify the export names against the installed package with Context7 or by reading `node_modules`.
  - `tests/golden/canonical.test.ts` using `data/vectors/canonical.json`, plus rejects for NaN, Infinity, undefined in an array, a function, a bigint, a `Date`.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Canonical property
  - Generator `genJson`; property P-H2 in `tests/properties/history.props.test.ts`.
  - _Requirements: 2.1, 2.2_

- [x] 3. Commit creation
  - Implement `commitId` and `commitDraft` in `src/core/history.ts` per design.md. Tests: unresolved draft, empty and 201-character message, parent link, sorted fields, clock use, no mutation of inputs.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.6_

- [x] 4. Verify chain, log
  - Implement `verifyChain` and `log`. Table tests including a broken first commit, a broken parent link, a changed message.
  - _Requirements: 3.1, 3.2, 4.1, 4.2_

- [x] 5. Diff and blame
  - Implement `diffCommits` and `blame` per design.md. Table tests for add, remove, each changed field, root commit, equal commits, value reverting after a change.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

- [x] 6. Replay of prior commits
  - Implement `replayPriorCommits`. Test determinism by running twice.
  - _Requirements: 7.1, 7.2_

- [x] 7. Chain generator and properties
  - Add `genChain`; properties P-H1, P-H3, P-H4, P-H5, P-H6.
  - Audit: make `verifyChain` skip the id recomputation and confirm P-H3 fails; restore.
  - _Requirements: 1.3, 2.6, 3.1, 3.2, 3.3, 5.5, 6.2, 8.1, 8.2_

- [x] 8. Hero golden test
  - `tests/golden/history-hero.test.ts` as in design.md. Confirm that the diff and blame match `expectedAfterDemoScript`.
  - _Requirements: 5.1, 5.2, 6.5, 7.3_

- [x] 9. Exports and checkpoint
  - Export from `src/core/index.ts`. Run typecheck, lint, test, test:props (100 runs). Log in `docs/KIRO_LOG.md`.
