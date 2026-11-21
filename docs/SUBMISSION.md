# MedGit: demo script and Devpost draft

Draft for the owner to review, edit and submit. Nothing here has been submitted. Every claim is checkable in the repository; do not add outcome, savings, validation or regulatory claims.

- Live app: https://vinay2214-cloud.github.io/medgit/
- Source: https://github.com/vinay2214-cloud/medgit
- Demo video: not recorded yet (add the public YouTube link here and in the README when it exists)

---

## 1. Demo video (target 2:50, hard limit 3:00)

### Before recording
- Open the live URL in a fresh private window at 1920x1080, 100% zoom, bookmarks bar hidden, notifications off.
- Theme: Light (Theme menu, Light). Role: Clinician.
- Rehearse twice. The steps are exactly the Hero `demoScript` in `data/scenarios/hero.json`; the e2e test `e2e/hero.spec.ts` runs the same steps against the live site, so they are known to work.
- Have a second tab ready with the Clean scenario as a backup if anything goes wrong (Clean signs off with no decisions).
- Keep the Downloads folder visible for the export step.

### Script
| Time | On screen | Say |
|---|---|---|
| 0:00 | Start view | "When a patient leaves hospital, the hospital, the GP, the pharmacy and the patient often hold different lists of their medicines. Comparing them is done by hand." |
| 0:15 | Click **Open** on Hero | "MedGit treats this like git: each list is a branch, reconciling is a merge, and every disagreement is a conflict a person must decide." |
| 0:25 | Reconcile chart; point at the counters and a red seam | "Four sources, nine medicines. Brand names and units are normalised first: Thyronorm is levothyroxine, 0.05 milligrams equals 50 micrograms. Three medicines agree. Six do not, and each one gets a dashed seam." |
| 0:45 | Toggle **Markers**, then back to **Chart** | "Underneath it is a real merge: here are the conflicts as git markers, with every source's claim kept." |
| 0:55 | Metformin: choose Hospital value, reason "Confirmed with patient", Apply. Seam closes. | "Nothing is resolved automatically. A decision needs a value and a reason. The seam closes." |
| 1:15 | Amlodipine: **Escalate to pharmacist**. Show "Waiting for a pharmacist." Switch role to Pharmacist; choose Hospital value, "Per dispensing record". | "A clinician can escalate. Only a pharmacist can then decide, and the core enforces that, not just the screen." |
| 1:40 | Aspirin (GP, stopped), Cotrimoxazole (Include), Paracetamol (Hospital), Salbutamol (Include). Counter reaches 0. | "Include a medicine only one source knew about. Accept that the GP stopped aspirin. Each line in the reconciled list shows why it is there." |
| 2:00 | Message "Reconcile medicines at discharge", **Sign off**; short id appears | "Sign-off is a commit. Its id is a SHA-256 hash of the content, chained to the previous sign-off." |
| 2:10 | **View history**: Chain verified; Changes tab (3 added, aspirin status changed); List tab, **Last changed** | "History shows the log, what changed, and for each line when it last changed and the reason. Editing any past record breaks the chain check." |
| 2:30 | Export menu: Case file, then FHIR bundle | "The case saves and reloads as a file, and the signed-off list exports as a FHIR R4 MedicationStatement bundle." |
| 2:40 | Footer notice | "Deterministic rules, a person decides everything, every decision is recorded. Synthetic data only; this is a software demonstration, not for clinical use." |

### Video title and description
- Title: **MedGit: git merge for medication lists (Kiroween 2026)**
- Description: "MedGit compares a patient's medicine lists from the hospital, GP, pharmacy and patient the way git merges branches. Every disagreement becomes a conflict that a person decides with a reason; escalated items need a pharmacist; each sign-off is a hash-chained commit with a log, diff and last-changed view. Synthetic data only; not for clinical use. Live app: https://vinay2214-cloud.github.io/medgit/ Source: https://github.com/vinay2214-cloud/medgit"

---

## 2. Devpost write-up draft

**Name:** MedGit

**Tagline:** Git merge for medication lists: every disagreement visible, every decision made by a person, every sign-off on record.

**Category:** Frankenstein (version control stitched onto clinical medication reconciliation).

### Inspiration
When a patient moves between care settings, several parties hold different lists of their medicines. Reconciling the lists is a manual comparison, and the result rarely records who decided what and why. Software engineers solved the same shape of problem with version control: divergent copies, a merge, explicit conflicts, a reviewed commit and a history.

### What it does
- Normalises four source lists against a 43-item synthetic formulary: brand names to one drug, unit conversion (0.05 mg = 50 mcg), frequency shorthand (BD = 1-0-1 = twice daily). Anything it cannot read stays empty and is listed, never guessed.
- Merges them with a unanimity rule: a medicine is settled only if every source lists it with the same strength, frequency and status. Everything else is a conflict: not on every list, dose, frequency or status.
- Shows the conflicts as a medication chart (medicines by source) with a stitched seam under each disagreement, or as git-style text markers.
- A person decides each conflict: use a source's value, enter a value by hand, include or leave off a medicine. Every decision needs a reason. Clinicians can escalate; only a pharmacist can decide an escalated conflict, enforced in the core logic.
- Sign-off creates a commit whose id is the SHA-256 of its canonical content, chained to the parent. History shows the log, a chain check, changes, decisions and a last-changed view per line.
- Exports a JSON case file (save and reload) and a FHIR R4 MedicationStatement bundle (small subset, local code system).

### Safety boundaries (what it deliberately does not do)
No automatic resolution, no tie-breaking by recency, source or majority, no invented values, no dosing advice, no interaction checks, no runtime AI, no network calls, synthetic data only, not for clinical use. The hash chain makes edits detectable; it is not a digital signature.

### How we built it
- Six specs in `.kiro/specs/` (EARS requirements, designs with correctness properties, task lists) plus seven steering files written up front; these were the contract throughout.
- A pure TypeScript core (normaliser, merge, resolution, history, export) with no framework, clock or randomness; a React interface that only dispatches actions the core validates.
- Testing: golden tests against hand-written expectations (cross-checked by an independent Python oracle), 27 fast-check properties at 100 runs each, each shown to fail on a deliberately broken implementation, and 101 Playwright tests including axe accessibility scans in both themes and responsive checks from 360 to 1920 px. All 264 acceptance criteria are cited by at least one test. CI runs everything on each push; GitHub Pages deploys the static build.
- Stack: TypeScript, React, Vite, Tailwind CSS v4, Radix (shadcn/ui), @noble/hashes, Vitest, fast-check, Playwright, axe-core.

### How Kiro and Claude Code were used (honest split; see `docs/KIRO_LOG.md`)
- **Kiro (IDE):** the project was set up in Kiro with the specs, steering files, hooks, custom agents and MCP configuration in `.kiro/`. Kiro built project-bootstrap tasks 1 to 9: toolchain, design tokens, theme handling, the app shell and UI primitives, the compliance and data-validation scripts.
- **Claude Code (Anthropic's CLI agent):** built the rest from the same Kiro specs and steering: bootstrap tasks 10 to 12, the core logic, the interface, the tests and the deployment. Kiro hooks and Kiro custom agents did not run during that phase.
- *Owner: add here any further Kiro features you personally used (for example spec task runs, hook blocks, agent reviews) only if they really happened.*

### Challenges
- Merge semantics for medicines: deciding that absence is a disagreement, and that the previous sign-off labels changes but never decides anything.
- After a sign-off the sources still disagree, so the app carries the recorded decisions forward ("Decided") instead of pretending the sources now agree.
- Making state readable without colour alone: every state has an icon and a word as well as a colour.

### Accomplishments
- The guarantees (no auto-resolution, no silent drop, no invented value, pharmacist gate, tamper evidence) are each backed by a property test that was shown to catch a broken implementation.
- The full demo flow runs as an automated test against the live site.

### What we learned
- Having the expected answers written by hand before any code (and checked with a separate oracle) meant the core matched them on the first run.
- Screenshots catch what tests miss: the type scale was silently missing until we looked.
- Accessibility checks on the real screens, not the empty shell, are what find problems.

### What's next
Free-text list parsing, real terminology (for example RxNorm or dm+d), more source types, and clinical review of the workflow. None of these is claimed today.

### Judging criteria: where the evidence is
| Criterion | Evidence |
|---|---|
| Potential impact | A common, manual, poorly recorded task; the app shows every disagreement and records every decision. Limits stated plainly. |
| Technological implementation | Pure deterministic core, hash-chained history, 351 unit/golden/property tests and 101 end-to-end tests in CI, live-site e2e run. |
| Design | Medication chart with one visual motif (the seam), WCAG AA tokens in light and dark, keyboard operation, responsive 360 to 1920 px, axe clean. |
| Innovation and idea | Version control's merge, conflict, commit and blame applied to medication reconciliation, with the safety rule that a person resolves every conflict. |
| Presentation | Three-minute scripted demo of the real flow; README and docs with honest scope. |

### Screenshots to attach
Take these from the live site at 1440x900 (or run `npx playwright test e2e/hero.spec.ts e2e/screens.spec.ts`; images are written to `e2e/__screens__/`):
1. Start view. 2. Reconcile before decisions (six seams). 3. Midway with an escalated row and a closed seam. 4. After all decisions (reconciled list). 5. History with Last changed. 6. Reconcile at 390 px in dark.
