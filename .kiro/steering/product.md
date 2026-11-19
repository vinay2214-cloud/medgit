---
inclusion: always
---
# MedGit: product steering

## What we are building
MedGit treats medication reconciliation like a git merge. A patient's medicine list lives in several places: the hospital discharge list, the GP record, the pharmacy dispensing history and what the patient says they take. Each place is a branch. Reconciling them is a merge. A disagreement is a conflict that a clinician or pharmacist resolves with a recorded reason. Every sign-off becomes a commit with a log, a diff and a blame view.

Hackathon: Kiroween 2026, category Frankenstein (software version control stitched onto clinical records). Deadline: Fri 4 Dec 2026, 2:00 PM PT (Sat 5 Dec 03:30 IST).

## Who it is for
- Clinical pharmacist or discharging clinician who has to reconcile lists at a care transition. They need to see every disagreement, decide, and leave an audit trail.
- Hackathon judges who are developers. They should understand the idea in one sentence ("git merge for medicine lists") and see it work end to end in under 90 seconds.

## Non-negotiable behaviours
1. Never auto-resolve. If sources disagree, the app shows the disagreement and waits for a person. No majority vote, no "most recent wins", no "prescriber wins".
2. Never silently drop. Every medication any source lists is either in the agreed list or inside a visible discrepancy.
3. Never invent. A missing strength or frequency stays missing and is shown as missing.
4. No clinical advice. No dosing guidance, no interaction checking, no allergy logic, no "recommended" values.
5. Synthetic data only, always labelled. Every screen shows "Synthetic data. Not for clinical use." Every export carries the same notice.
6. No runtime AI. The app contains no LLM calls. AI helps build it; it does not make clinical judgements inside it.

## Scope (see docs/PRD.md for the full list)
Ship: normaliser over a 43-drug synthetic formulary, N-way merge with conflict objects, resolution with reasons, pharmacist escalation, commit history with log, diff and blame, JSON case file round trip, three scenarios, property tests, static deployment.
Should: FHIR R4 MedicationStatement export and import, marker (git-style) view.
Cut: free-text parsing, RxNorm or NDC mapping, OCR, interaction checks, auth, backend, EHR integration, mobile apps, real patient data.

## Where the truth lives
- Behaviour: `.kiro/specs/*/requirements.md` (EARS). These are the contract.
- Merge rules: `docs/MERGE_SEMANTICS.md`.
- Structure and API: `docs/ARCHITECTURE.md`.
- Screens and copy: `docs/UX_SPEC.md`, visual tokens in `docs/DESIGN_SYSTEM.md`.
- Expected results: `data/scenarios/*.json` (`expected` block). These are golden values. Never regenerate them from the implementation.

If two documents disagree, stop and ask. Do not pick a winner silently.
