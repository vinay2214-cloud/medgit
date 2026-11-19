# MedGit: product requirements document

Version 1.0. Status: ready to build. Owner: the human builder. Agents build from this file plus `.kiro/specs/`.

## 1. One-line pitch
MedGit is git merge for medication lists. Hospital, GP, pharmacy and patient each hold a different list. MedGit compares them, shows every disagreement as a conflict, makes a person resolve each one with a reason, and records the signed-off list as a commit with a log, a diff and a blame.

Hackathon category: **Frankenstein** (stitch together things that should not go together: software version control and clinical medication reconciliation). The visual motif, a stitched seam, carries the same idea.

## 2. Problem
When a patient moves between care settings, different parties hold different medicine lists. The lists disagree about whether a medicine exists, what the dose is, how often it is taken, and whether it was stopped. Reconciling them is a manual, high-stakes comparison. The result is rarely recorded in a way that shows who decided what, and why.

Software engineers solved the same shape of problem with version control: several divergent copies, a merge, explicit conflicts, a reviewed commit, and a history. MedGit applies that workflow to medicines, with clinical safety rules on top: nothing is resolved silently.

## 3. Users and jobs
| User | Job to be done | What they need from the screen |
|---|---|---|
| Clinical pharmacist (primary) | Produce one reconciled list at discharge or admission | See every disagreement at once, decide each with a reason, sign off |
| Clinician (primary) | Review the lists and flag what needs a pharmacist | Escalate any conflict, see what changed since last time |
| Reviewer or auditor (secondary) | Understand why a line is on the list | History, diff, last-changed with reason codes |
| Hackathon judge (secondary) | Understand the product in 3 minutes | Hero scenario that loads in one click, a clear story, visible Kiro usage |

All patients, lists and people in the app are synthetic. The app says so.

## 4. Goals
- G1. Load several source lists, normalise them, and show a conflict for every disagreement.
- G2. Never auto-resolve, never silently drop, never invent a value.
- G3. Let a person resolve each conflict with a decision and a reason code, with a pharmacist gate for escalations.
- G4. Sign off a reconciled list as a tamper-evident commit; show log, diff and last-changed.
- G5. Import and export the work (case file, FHIR R4 subset).
- G6. Look and feel like a precise clinical instrument, with one memorable visual idea (the seam).
- G7. Be fully demonstrable in under 3 minutes from a cold start.
- G8. Be a showcase of Kiro: specs, steering, hooks, custom agents, MCP, property-based tests.

## 5. Non-goals (v1)
Real patient data. Authentication or accounts. A backend or database. Free-text or OCR parsing of real documents. Drug interaction checking or dosing advice. Clinical decision support of any kind. Mobile-native apps. Multi-user live collaboration. Regulatory claims. Any runtime AI call.

## 6. Product principles
1. A disagreement is information. Show it, never hide it.
2. A person decides, with a reason. The software proposes nothing.
3. If unsure, show more, not less.
4. Every line has a history.
5. Synthetic data is always labelled.
6. The interface is calm, exact and legible. Colour is never the only signal.

## 7. Features

Priority: **S** = ship (demo fails without it), **H** = should (build if on schedule), **C** = cut first.

| ID | Feature | Pri | Spec | Notes |
|---|---|---|---|---|
| F1 | Project scaffold, tokens, CI, Pages deploy | S | project-bootstrap | Day 1 |
| F2 | Formulary and normaliser (names, strengths, frequencies, statuses, issues) | S | formulary-normaliser | Pure core |
| F3 | N-way merge into conflicts and clean entries | S | merge-engine | Unanimity rule |
| F4 | Resolution rules, escalation, draft and commit gating | S | merge-engine | Pharmacist gate |
| F5 | Commit, hash chain, log, diff, blame, replay of prior commits | S | history-audit | |
| F6 | Review UI: Start, Reconcile (medication chart), Decision strip, Merged list, Commit panel | S | review-ui | Hero experience |
| F7 | History view: log, diff, last-changed | S | review-ui | |
| F8 | Case file export and import | S | interop-export | JSON, `medgit.case/1` |
| F9 | FHIR R4 `MedicationStatement` export | H | interop-export | Subset, local code system |
| F10 | FHIR import | C | interop-export | Only after F9 is solid |
| F11 | Marker view (text conflict markers) | H | review-ui | The "this is really git" moment |
| F12 | Dark theme, reduced-motion path | H | review-ui | Tokens already defined |
| F13 | MCP formulary server and Kiro power | C | `.kiro/settings/mcp.json`, `powers/` | Only after Day 10 gate |
| F14 | Kiro Crew bolt-on (separate repo) | C | none | Only after Day 10 gate |

Every feature maps to requirements in `.kiro/specs/<spec>/requirements.md`. The requirements are the contract; this table is the map.

## 8. The hero flow (also the demo)
Scenario "Hero" loads four source lists (hospital, GP, pharmacy, patient) and two prior commits.

1. **Start**: pick "Hospital discharge, Sample Patient A (synthetic)". The synthetic notice is visible.
2. **Reconcile**: the medication chart shows nine medicines in rows and four sources in columns. Three rows are quiet (agreed). Six rows have a red dashed seam: open conflicts. The summary reads "6 to decide, 3 agreed".
3. **Decide**: select metformin (frequency). The decision strip shows the four claims. The clinician chooses the hospital value with reason "Confirmed with patient". The seam on that row closes with a short animation and turns green.
4. **Escalate**: select amlodipine (dose). The clinician cannot settle it and escalates. The row turns amber. The role switches to pharmacist. The pharmacist chooses the hospital value with reason "Per dispensing record".
5. **Finish**: aspirin (stopped, choose GP), cotrimoxazole (include), paracetamol (choose hospital), salbutamol (include). The counter reaches 0.
6. **Sign off**: the commit panel enables. The message "Reconcile medicines at discharge" is committed. A short id (first 7 hex characters) appears.
7. **History**: the log shows three commits. The diff shows 3 added, 1 changed (aspirin status). Last-changed shows who and why for each line.
8. **Export**: download the case file and a FHIR bundle.

The `demoScript` and `demoCommit` in `data/scenarios/hero.json` drive the end-to-end test and the recording. `expectedAfterDemoScript` holds the golden results.

## 9. Scenarios
| Scenario | Purpose | Expectation |
|---|---|---|
| hero | Show all four conflict kinds, normalisation, history | 6 conflicts, 3 agreed, 2 prior commits |
| clean | Prove the happy path | 0 conflicts; commit available immediately |
| messy | Prove honesty about limits | Unmapped drugs, unparsed fields, issues listed, nothing guessed |

## 10. Quality bars
- Correctness: all properties pass at 100 runs; golden tests pass for three scenarios.
- Safety: no code path resolves, drops or invents a value (tests P-M1, P-M2, P-U1).
- Accessibility: WCAG 2.2 AA for text and focus; full keyboard operation; screen reader announcements for state changes; reduced-motion respected.
- Performance: first load under 1 second on a laptop; interactions under 100 ms.
- Responsiveness: usable at 1440, 1024 and 390 px wide (390 uses a stacked card layout).
- Visual: no hard-coded colours outside `tokens.css`; Playwright screenshots reviewed at three widths in both themes.
- Repo: public, OSI licence at root, `.kiro/` committed, README with synthetic notice.

## 11. Hackathon fit (verify against the live Rules page on Day 1)
Submission needs: public repo with OSI licence and committed `.kiro/`; working app URL; public YouTube demo of 3 minutes or less; a write-up of how Kiro was used. `docs/DEMO_AND_SUBMISSION.md` has the checklist and `docs/KIRO_LOG.md` the running write-up.

The project is new, started after the hackathon start date. Keep the first commit date in git history honest.

## 12. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Scope creep | Features marked C are cut first; Day 3 and Day 10 gates in `docs/BUILD_PLAN.md` |
| Clinical overclaim | Product steering forbids advice; synthetic notice; no efficacy claims anywhere |
| Merge semantics debate | `docs/MERGE_SEMANTICS.md` is the single source; changes need the human |
| Agents drift from spec | Steering always loaded; hooks block edits to requirements; `check-compliance` in CI |
| UI looks generic | Design system, seam motif, screenshot critique loop with the `ui-critic` agent |
| Demo fails live | Recording uses the deterministic hero script; deploy tested from a clean browser |
| Credits run out | Request credits early; Day 10 gate; prefer small, spec-scoped tasks |

## 13. Timeline
See `docs/BUILD_PLAN.md`. Deadline: Fri 4 Dec 2026, 2:00 PM Pacific (Sat 5 Dec, 03:30 IST). Target submission: Thu 3 Dec.

## 14. Open questions the human owns
- Name for the LICENSE copyright line.
- Public repo owner and name.
- Whether to attempt F13 and F14 after the Day 10 gate.
- Narration voice (own voice or text on screen).
