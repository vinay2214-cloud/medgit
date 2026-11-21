# Kiro usage log

Running notes for the hackathon write-up. Short, factual entries. Only record what really happened.

## Provenance
- The specs (`.kiro/specs/*`), steering files, docs, fixtures and scripts in the starter pack were drafted with Claude before the build and then loaded into Kiro.
- Repository created on: 2026-11-19 (first commit date).
- **Two development tools were used, in sequence.**
  - **Kiro** (IDE): project-bootstrap tasks 1 to 9: toolchain, design tokens, theme provider, app shell and shadcn primitives, compliance script, README, data validation script (commits `f293bea` to `64d4ec1`, 19 to 21 Nov 2026).
  - **Claude Code** (Anthropic's CLI agent, not a Kiro product): from 21 Nov 2026 onwards: bootstrap tasks 10 to 12, and all of the formulary-normaliser, merge-engine, history-audit, interop-export and review-ui specs. Claude Code followed the same Kiro specs, steering files and task lists; it did not run inside Kiro, so Kiro hooks and Kiro custom agents did not fire during that work.
- Work done with Claude Code is not Kiro work and is not described as such anywhere in this repository.

## Specs
- The six specs in `.kiro/specs/` (EARS requirements, designs with correctness properties, task lists) were the contract for both tools. No `requirements.md`, golden data or source-of-truth doc was edited.
- Claude Code implemented the core specs from `requirements.md` and `design.md` and ticked each `tasks.md` as its checks passed. Every test cites its requirement (`// Validates: <spec> x.y`); `npm run check:traceability` enforces the ids exist.

## Steering
- `clinical-safety.md` shaped the core: no tie-breakers (merge-engine has a test that three sources against one is still a conflict), no invented values (property P-M2), unmapped drugs kept as `unmapped:<slug>`, escalation enforced in `validateResolution`, not only in the UI.
- `testing-pbt.md` set the generator universe (4 source ids, 5 drugs, 3 strengths, 3 frequencies, 30% omission) and the rule that every property must be shown to fail.

## Hooks
- Kiro hooks (`protect-contract`, `core-checks`, `traceability`, `ui-no-hex`, `task-done-checks`, `kiro-log`) were active for the Kiro-built tasks. They do not run under Claude Code; their checks were run by hand there (`npm run typecheck`, `lint`, `test`, `test:props`, `check:traceability`).

## Custom agents
- `medgit-builder`, `ui-critic`, `safety-reviewer` are defined in `.kiro/agents/`. (Record here only what they actually did inside Kiro.)

## MCP
- (Record only what was used inside Kiro.)

## Property-based testing
- Properties at the end of the core specs: P-N1 to P-N6 (normaliser), P-M1 to P-M9 (merge and resolution), P-H1 to P-H6 (history), P-I1 to P-I3 (case file and FHIR). All pass at 100 runs (`npm run test:props`). Written and run with Claude Code as ordinary Vitest tests.
- Mutation audit (each property must be able to fail). Each mutation was applied in a scratch edit, the matching property failed with a shrunk counterexample, then the file was restored byte for byte:
  - Treat absence as agreement in `mergeSources` → P-M4 failed (counterexample: `gp` lists nothing, `patient` lists amlodipine).
  - Make `applyResolutions` fill open conflicts from the first source → P-M2 failed.
  - Drop the `µg` factor → P-N3 failed (furosemide 20 mg written in µg).
  - Make `verifyChain` skip the id recomputation → P-H3 failed.
  - Make case-file export drop `resolutions` → P-I1 failed.
- No property found a bug in the shipped code; the golden tests and the Python oracle (`docs/reference/reference.py --check`) agreed with the implementation on first run.

## Bugs found and fixed during the Claude Code phase
- **Type scale never applied (from bootstrap task 4).** `index.css` declared `--font-size-*` in `@theme`, but Tailwind v4 reads `--text-*`, so `text-title`, `text-display`, `text-small` and the rest generated no CSS; every heading rendered at body size. Found by looking at the first Reconcile screenshot. Fixed by adding `--text-*` keys; regression test in `e2e/smoke.spec.ts` asserts the `h1` font sizes.
- **Header nav unclickable at 768 px.** The control cluster overlapped the nav (`min-w-0` let the left side shrink under it). Found by the new no-horizontal-scroll e2e; fixed in `AppShell.tsx`; the e2e now clicks the nav at seven widths.
- **Horizontal scroll at 360 and 390 px** (header nav, filter group, chart minimum widths) and a **nested button** inside narrow-screen cards. Found by measuring `scrollWidth` at seven widths; fixed; covered by `e2e/review.spec.ts`.
- **Copy buttons under 40 px.** Found by a touch-target e2e (review-ui 14.6); enlarged.
- Kiro-era `e2e/app-shell.spec.ts` asserted that the mark is an `h1` and that the first Tab lands on the skip link; review-ui 14.8 and 1.5 changed both. The tests were updated to the new contract (one `h1` per view; the skip link is still the first tab stop from the top of the document).

## Release (21 Nov 2026, Claude Code)
- Public repository created at https://github.com/vinay2214-cloud/medgit and the existing history pushed unchanged (no force-push). Before publishing: gitleaks over all commits found no leaks; no `.env`, key or database files were ever committed; dependency licences are permissive or MPL-2.0 (build tooling only).
- GitHub Pages enabled with the Actions source. CI (check and e2e jobs) and the Pages deploy passed on GitHub; CI ran 25 Vitest files and 100 Playwright tests on Linux.
- Live site https://vinay2214-cloud.github.io/medgit/ verified with the e2e suites pointed at it (`PLAYWRIGHT_BASE_URL`): hero flow with golden diff and blame, axe in both themes, case-file and FHIR downloads, responsive widths. Only one origin contacted.
- **Bug found on the live site:** a missing favicon made every page load log a 404 console error. Added `public/favicon.svg` and a no-console-errors e2e test.
- Bundle: one 508 kB script (153 kB gzipped). Lazy-loading the views was measured: about 10 kB gzipped less on first load, but opening a scenario went from about 100 ms to 390-840 ms locally. Rejected and documented.
- The official Devpost rules page refused automated fetching (HTTP 403), so Kiro-usage eligibility was not checked by the agent; the owner must read the rules.

## Decisions taken without changing the contract (flagged for the human)
- review-ui 8.5 says that after a sign-off every medicine shows as "agreed". Under the unanimity merge the sources still disagree, so the app carries the head commit's decisions forward when the head signed off exactly these source versions: rows read "Decided", seams are closed, nothing is left to decide, and each source column keeps showing what that source really says. It does not rewrite the sources.
- Chart columns and marker groups use sorted source ids (gp, hospital, patient, pharmacy), as review-ui 4.1 says ("id order"). The UX spec's examples list hospital first.

## Numbers (fill in at the end)
- Specs: 6. Requirements (acceptance criteria): see `node scripts/check-traceability.mjs --report`.
- Tests: see the README test section for current counts.

## Lessons
- (three things you would tell another builder)
