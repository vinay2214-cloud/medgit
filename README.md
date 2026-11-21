# MedGit

**Git merge for medication lists.** A hospital, a GP, a pharmacy and the patient each keep a different list of a person's medicines. MedGit compares the lists, shows every disagreement as a conflict, makes a person decide each one with a reason, and records the signed-off list as a commit with a log, a diff and a "last changed" view.

> **All data in this project is synthetic. This is a software demonstration and is not for clinical use.** It gives no dosing advice, checks no interactions, and is not a medical device.

Built for **Kiroween 2026** (category: Frankenstein: version control stitched onto clinical reconciliation).

- Live app: https://vinay2214-cloud.github.io/medgit/
- Source: https://github.com/vinay2214-cloud/medgit
- Demo video: REPLACE-WITH-VIDEO-URL
- How the project was built (Kiro and Claude Code, stated honestly): [`docs/KIRO_LOG.md`](docs/KIRO_LOG.md)

## What works today
Open the app, choose **Hero**, and you can do the whole reconciliation in the browser:

1. **Compare.** Four source lists, normalised against a 43-item synthetic formulary (brand names map to one drug, `0.05 mg` equals `50 mcg`, `BD` equals `1-0-1`). The chart shows medicines by source; three agree and six do not.
2. **See every disagreement.** Each conflict (not on every list, dose, frequency, status) gets a pill, a thread underline on the disagreeing values, and a dashed red **seam** under the row. A text **marker view** shows the same conflicts the way git does.
3. **Decide.** Choose a source's value, type a value by hand, include or leave off a medicine. Every decision needs a reason. A clinician can **escalate**; only a pharmacist can then decide it, and the core enforces that, not only the interface. The seam closes green as each decision lands.
4. **Sign off.** When nothing is left to decide, the list is committed with a message. The commit id is the SHA-256 of its canonical content, chained to its parent.
5. **Audit.** History shows the log, a chain check ("Chain verified" or "Chain broken at commit n"), what changed, and for each line the commit that last changed it and the last decision with its reason.
6. **Export.** Save and reload the whole case as a JSON case file, or export the signed-off list as a small FHIR R4 `MedicationStatement` bundle (local code system; not a validated FHIR profile).

The **Clean** scenario shows four lists written differently that normalise to full agreement. **Messy** shows the limits honestly: unknown items are kept as written, unreadable strengths and frequencies stay empty and are listed under "Problems found".

## Guarantees, and how they are tested
| Guarantee | Enforced by | Tested by |
|---|---|---|
| Nothing is resolved automatically; clean means every source agrees | `mergeSources` (unanimity rule, no tie-breaks) | properties P-M1, P-M4; golden scenario tests |
| No medicine is silently dropped | merge puts every drug in the agreed list or a conflict | P-M1 |
| No value is invented | draft values come from a source or what a person typed | P-M2 |
| Escalated items need a pharmacist | `validateResolution` in the core | P-M7, reducer and e2e tests |
| Every decision has a reason and a role; sign-off needs everything decided | core validation and the commit gate | P-M7, P-U1 |
| Changes to the record are detectable | SHA-256 commit ids chained to parents, `verifyChain` | P-H3, golden hash vectors |

The hash chain makes edits **detectable**; it is not a digital signature and does not stop someone rewriting the whole chain.

## Run it
```bash
npm ci
npm run dev        # http://localhost:5173
```

## Test it
```bash
npm run typecheck && npm run lint && npm test   # unit, golden, component and property tests
npm run test:props                              # property tests only, 100 runs each (FC_NUM_RUNS)
npx playwright install chromium && npm run e2e  # end-to-end, accessibility, responsive
npm run validate:data && npm run check:compliance && npm run check:traceability
```
Current counts: 351 Vitest tests in 25 files (including 39 golden tests and 27 fast-check properties at 100 runs each), and 101 Playwright tests. CI runs all of them on every push. To run the end-to-end suites against the deployed site instead of a local build: `PLAYWRIGHT_BASE_URL=https://vinay2214-cloud.github.io/medgit/ npx playwright test e2e/hero.spec.ts e2e/review.spec.ts e2e/a11y.spec.ts e2e/import-export.spec.ts e2e/smoke.spec.ts`. Every one of the 264 acceptance criteria in `.kiro/specs/*/requirements.md` is cited by at least one test (`node scripts/check-traceability.mjs --report`).

The golden expectations in `data/scenarios/*.json` were written by hand and cross-checked with an independent Python oracle (`python3 docs/reference/reference.py --check`). Each property was shown to fail on a deliberately broken implementation before being trusted (details in `docs/KIRO_LOG.md`).

## How it is built
```
data/*.json  ->  src/core (pure TypeScript)                 ->  src/ui (React)
                 formulary -> normalise -> merge -> resolve       one reducer + selectors
                 -> history (commit, verify, log, diff, blame)    Start, Reconcile, History
                 casefile (JSON), fhir (R4 subset), canonical
```
- `src/core` has no React, no browser APIs, no clock and no randomness; time is injected. An architecture test enforces this.
- The UI never decides anything: it dispatches actions, and the reducer calls the core to validate them.
- No backend, no network calls at runtime, no analytics, self-hosted fonts. A static build that works offline after load.
- The production bundle is one 508 kB script (153 kB gzipped), mostly React DOM, so Vite prints its 500 kB chunk warning. Lazy-loading the views was measured and rejected: it saved about 10 kB gzipped on first load but made opening a scenario 4 to 8 times slower.
- Stack: TypeScript, React, Vite, Tailwind CSS v4, Radix primitives (shadcn/ui), `@noble/hashes`, Vitest, fast-check, Playwright, axe.

## Project layout
```
.kiro/        specs (6), steering (7), hooks (6), custom agents (3), MCP config
src/core/     normaliser, merge, resolution, history, case file, FHIR
src/ui/       state, views, components, design tokens
data/         synthetic formulary, three scenarios with golden expectations, hash vectors
docs/         PRD, architecture, merge semantics, UX spec, design system, build log
tests/ e2e/   golden, property, unit, component and end-to-end tests
```

## Documents
| File | What it is |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, API, state, decisions |
| [`docs/MERGE_SEMANTICS.md`](docs/MERGE_SEMANTICS.md) | Exact merge, resolution and history rules |
| [`docs/UX_SPEC.md`](docs/UX_SPEC.md), [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Screens, copy, visual system |
| [`.kiro/specs/`](.kiro/specs) | EARS requirements, designs with correctness properties, task lists |
| [`docs/KIRO_LOG.md`](docs/KIRO_LOG.md) | Which tool built what, bugs found, decisions flagged |

## Limitations
- Synthetic, structured input only: no free-text, document or OCR parsing.
- A 43-item synthetic formulary; no RxNorm, SNOMED or other real terminology.
- The FHIR export is a small subset with local code systems; it is not validated against a FHIR profile and is not certified interoperability.
- Roles are a demo switch, not authentication. There is no backend, no multi-user sync, and no persistence beyond the case file you save.
- No clinical validation, no regulatory status, no dosing or interaction checks. The tool makes disagreements visible, resolvable and auditable; it makes no claim to reduce errors or harm.

## Licence
MIT. See [`LICENSE`](LICENSE).
