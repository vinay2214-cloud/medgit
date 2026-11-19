# Tasks: review-ui

Prerequisites: project-bootstrap, formulary-normaliser, merge-engine and history-audit checkpoints passed; interop-export tasks 1 to 7 done before task 13 here. Do not edit `requirements.md`, `docs/UX_SPEC.md` or `docs/DESIGN_SYSTEM.md`; if something is wrong, stop and ask.

For every task that changes what the user sees: use the shadcn MCP and Context7 for library details, take Playwright screenshots (1440x900, 1024x768, 390x844, light and dark), look at them, fix what is wrong, then run the `ui-critic` agent. Details are in `.kiro/steering/ui-ux.md`.

- [ ] 1. Test tooling and data module
  - Install `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@testing-library/jest-dom`; configure Vitest for jsdom on `tests/ui/**`.
  - Create `src/ui/data.ts` that imports the formulary and scenarios and calls `loadFormulary`.
  - Create `src/ui/copy.ts` from the copy deck, and `src/ui/format.ts`.
  - _Requirements: 16.2_

- [ ] 2. State: types, reducer, selectors, store
  - Implement `state/*` per design.md. Unit tests for every action, including the error paths.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3. State properties
  - Action-sequence generator; properties P-U1, P-U2, P-U3 in `tests/properties/ui-state.props.test.ts`.
  - Audit: make the reducer commit when `canCommit` is false and confirm P-U1 fails; restore.
  - _Requirements: 2.3, 2.4, 2.5, 3.2, 7.4_

- [ ] 4. Shell upgrades
  - Header with `RoleSwitch`, `ThemeMenu` (from bootstrap), `ExportMenu` (disabled items for now), hash routing, `ErrorBoundary`, `LiveRegion` fed by `state.announcement`.
  - _Requirements: 2.6, 14.5, 15.1, 15.2, 15.3, 16.1_

- [ ] 5. Start view
  - `StartView` and `ScenarioList` (ledger rows), notice, focus on the Hero button.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 6. Chart and seam (the hero moment)
  - `ReviewChart`, `ChartRow`, `ValueCell`, `SourceHead`, `StatePill`, `SeamLine` with the transition, and `SummaryBar` with counters, filter and toggle.
  - Roving tabindex, row accessible names, long-name wrapping, the "Unreadable" cell.
  - Component tests for pills, seam attributes and accessible names.
  - Screenshot loop until the Hero chart looks right in both themes at three widths.
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 7. Decision strip
  - `DecisionStrip`, `ClaimRow`, `ValueInput`, role gating, reasons, note counter, apply, escalate, undo, tabs for multi-conflict medicines, error display.
  - Focus management after apply (`state/focus.ts`).
  - Component tests per design.md.
  - _Requirements: 3.3, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

- [ ] 8. Responsive containers
  - Place the single strip beside the chart (wide), in a right sheet (medium), in a bottom sheet (narrow); card layout for narrow widths; sticky commit bar.
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 9. Reconciled list and commit panel
  - `MergedList` and `CommitPanel` with the top-edge seam, disabled reasons with plural handling, success state, short id with copy button.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. History view
  - `HistoryView`, `HistoryLog`, `CommitDetail`, `DiffLines`, `BlameList`, chain status.
  - Component test with a tampered history.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 11. Problems panel
  - `IssuesPanel` for the Messy scenario.
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 12. Hero end-to-end test
  - `e2e/hero.spec.ts` following `demoScript`, then sign off and check History. Fix any UI defects it reveals.
  - _Requirements: 17.1, 17.2_

- [ ] 13. Import and export
  - Wire `ExportMenu` and the import button to the core functions; download helper; size check; error display with details.
  - `e2e/import-export.spec.ts`.
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 14. Marker view (should)
  - `MarkerView` using `renderMarkers`, selection sync, pills.
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 15. Accessibility and screenshots
  - `e2e/a11y.spec.ts` with axe for three views in both themes; keyboard-only run-through of the hero flow; fix findings.
  - `e2e/screens.spec.ts` for the screenshot matrix in requirement 17.3.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 15.4, 17.3_

- [ ] 16. Design polish pass
  - Run the `ui-critic` agent on all screenshots; fix every finding it rates high; one more screenshot pass. Check that the only decoration is the seam.
  - _Requirements: 5.5, 5.6, 16.3_

- [ ] 17. Checkpoint
  - typecheck, lint, test, test:props, e2e, validate:data, build, check:compliance. Update `docs/KIRO_LOG.md`. Prepare for the demo recording (`docs/DEMO_AND_SUBMISSION.md`).
