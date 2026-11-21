# MedGit

**Git merge for medication lists.** A software demonstration that applies version-control concepts to medication reconciliation. Hospital, GP, pharmacy and patient each keep a different list of a person's medicines. MedGit is designed to compare them, show every disagreement as a conflict, let a person resolve each one with a reason, and record the signed-off list as a commit with a log, a diff and a last-changed view.

> **All data in this project is synthetic. This is a software demonstration and is not for clinical use.** It gives no dosing advice, checks no interactions, and is not a medical device.

Built for **Kiroween 2026** (category: Frankenstein). Status: Project scaffold complete; core features in progress.

- Live app: REPLACE-WITH-DEPLOYED-URL
- Demo video will be published before hackathon submission
- How Kiro was used: [`docs/KIRO_LOG.md`](docs/KIRO_LOG.md)

## Current implementation

**Phase 1 complete (project-bootstrap spec):**
- Application shell with responsive layout (desktop, tablet, mobile)
- Light/dark/system theme support with persistent storage
- Synthetic-data indicators and non-clinical-use disclaimer on every screen
- Accessible live-region announcements for screen readers
- Design tokens system (surgical-supply color palette)
- Self-hosted fonts (Atkinson Hyperlegible)
- Compliance checks (LICENSE, .kiro tracking, synthetic-data notice)
- Data validation (formulary structure, scenario integrity)
- CI/CD pipeline with GitHub Actions
- Deployed to GitHub Pages

**Core features in progress:**
- Formulary normalization (brand names, strengths, frequencies)
- Three-way medication-list merge with unanimity rule
- Conflict detection and explicit human resolution
- Resolution rules with pharmacist escalation gate
- Commit history with SHA-256 chain, log, diff and blame
- Case file import/export (JSON format)
- FHIR R4 MedicationStatement export subset

## Intended workflow

The planned end-to-end experience (specified in [`docs/PRD.md`](docs/PRD.md) and [`docs/MERGE_SEMANTICS.md`](docs/MERGE_SEMANTICS.md)):

Every source list will be normalised (brand names mapped to one drug, `0.05 mg` equal to `50 mcg`, `BD` equal to `1-0-1` equal to twice daily). Lists will be merged with a **unanimity rule**: a medicine is settled only if every source lists it with the same strength, frequency and status. Anything else becomes a conflict: missing from a list, dose disagreement, frequency disagreement, or status disagreement.

Five design guarantees (to be backed by property-based tests):
1. A person decides every conflict. Nothing is resolved automatically.
2. No medicine is silently dropped.
3. No value is invented. A reconciled value comes from a source or from what a person typed.
4. An escalated conflict can only be decided by a pharmacist (enforced in the core, not just the interface).
5. The signed-off record is tamper-evident: each commit's id is the SHA-256 of its canonical content, chained to its parent.

Details: [`docs/MERGE_SEMANTICS.md`](docs/MERGE_SEMANTICS.md).

## Run it locally
```bash
npm install
npm run dev
```
Open http://localhost:5173 to see the application shell with theme switching and synthetic-data indicators.

## Verify implementation
```bash
npm run typecheck && npm run lint && npm test
npm run test:props        # property-based tests (fast-check) - empty until core features implemented
npm run e2e               # Playwright: shell, theme, accessibility, responsive layout
npm run validate:data && npm run check:compliance && npm run check:traceability
```

Current test coverage: 72 unit/integration tests, 61 end-to-end tests.

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

## Limitations and scope
This is a software demonstration and proof-of-concept, not a production-ready system.

**Current scope:**
- Project scaffold with design system and accessibility foundation
- Synthetic data: 43-item formulary, 3 test scenarios (Clean, Hero, Messy)
- Static deployment (no backend, no database, no authentication)

**Planned scope:**
- Structured synthetic input only (no free-text or document parsing)
- Normalisation, merge and resolution logic (pure TypeScript core)
- Review UI for medication reconciliation workflow
- Case file and FHIR R4 MedicationStatement export (small subset, local code system)
- Property-based testing with fast-check
- History with tamper-evident commit chain

**Out of scope:**
- Real patient data
- Clinical validation or regulatory compliance
- Drug interaction checking or dosing advice
- Free-text parsing or OCR
- Multi-user collaboration or live sync
- Mobile-native applications
- Production deployment with real EHR integration

## Licence
MIT. See [`LICENSE`](LICENSE).
