# Kiro usage log

Running notes for the hackathon write-up. Short, factual entries. Only record what really happened.

## Provenance
- The specs (`.kiro/specs/*`), steering files, docs, fixtures and scripts in the starter pack were drafted with Claude before the build and then loaded into Kiro.
- Repository created on: 2026-11-19 (first commit date).
- **Two development tools were used, in sequence.**
  - **Kiro** (IDE): project-bootstrap tasks 1 to 9: toolchain, design tokens, theme provider, app shell and shadcn primitives, compliance script, README, data validation script (commits `f293bea` to `64d4ec1`, 19 to 21 Nov 2026).
  - **Claude Code** (Anthropic's CLI agent, not a Kiro product): from 21 Nov 2026 onwards: bootstrap task 10 (workflow action versions), and the formulary-normaliser, merge-engine, history-audit and interop-export specs. Claude Code followed the same Kiro specs, steering files and task lists; it did not run inside Kiro, so Kiro hooks and Kiro custom agents did not fire during that work.
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

## Numbers (fill in at the end)
- Specs: 6. Requirements (acceptance criteria): see `node scripts/check-traceability.mjs --report`.
- Tests: see the README test section for current counts.

## Lessons
- (three things you would tell another builder)
