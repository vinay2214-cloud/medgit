# MedGit

**Git merge for medication lists.** Hospital, GP, pharmacy and patient each keep a different list of a person's medicines. MedGit compares them, shows every disagreement as a conflict, makes a person decide each one with a reason, and records the signed-off list as a commit with a log, a diff and a last-changed view.

> **All data in this project is synthetic. This is a software demonstration and is not for clinical use.** It gives no dosing advice, checks no interactions, and is not a medical device.

Built for **Kiroween 2026** (category: Frankenstein). Status: in development.

- Live app: REPLACE-WITH-DEPLOYED-URL
- Demo video: REPLACE-WITH-YOUTUBE-URL
- How Kiro was used: [`docs/KIRO_LOG.md`](docs/KIRO_LOG.md)

## How it works
Every source list is normalised (brand names mapped to one drug, `0.05 mg` equal to `50 mcg`, `BD` equal to `1-0-1` equal to twice daily). Lists are then merged with a **unanimity rule**: a medicine is settled only if every source lists it with the same strength, frequency and status. Anything else is a conflict: not on every list, dose, frequency or status.

Five guarantees, each backed by tests:
1. A person decides every conflict. Nothing is resolved automatically.
2. No medicine is silently dropped.
3. No value is invented. A reconciled value comes from a source or from what a person typed.
4. An escalated conflict can only be decided by a pharmacist (enforced in the core, not just the interface).
5. The signed-off record is tamper-evident: each commit's id is the SHA-256 of its canonical content, chained to its parent.

Details: [`docs/MERGE_SEMANTICS.md`](docs/MERGE_SEMANTICS.md).

## Run it
```bash
npm install
npm run dev
```
Open the Hero scenario and follow the seam: red dashes are open conflicts; they close as you decide.

## Check it
```bash
npm run typecheck && npm run lint && npm test
npm run test:props        # property-based tests (fast-check), 100 cases each
npm run e2e               # Playwright: the full hero flow, accessibility scan, screenshots
npm run validate:data && npm run check:compliance && npm run check:traceability
```

## Project layout
```
.kiro/        specs (6), steering, hooks, custom agents, MCP config
src/core/     pure TypeScript: normaliser, merge, resolution, history, export
src/ui/       React interface, design tokens, components
data/         synthetic formulary and scenarios, test vectors
docs/         PRD, architecture, merge semantics, UX spec, design system, build plan
tests/ e2e/   golden, property, component and end-to-end tests
```

## Documents
| File | What it is |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, API, state, decisions |
| [`docs/MERGE_SEMANTICS.md`](docs/MERGE_SEMANTICS.md) | Exact merge, resolution and history rules |
| [`docs/UX_SPEC.md`](docs/UX_SPEC.md), [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Screens, copy, visual system |
| [`.kiro/specs/`](.kiro/specs) | EARS requirements, designs with correctness properties, task lists |

## Limitations
Structured synthetic input only (no free-text or document parsing). A small synthetic formulary of 43 items. The FHIR export is a small `MedicationStatement` subset with local code system identifiers, not a validated profile. No accounts, no backend, no real patient data.

## Licence
MIT. See [`LICENSE`](LICENSE).
