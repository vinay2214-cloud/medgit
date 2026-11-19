# MedGit build plan

Deadline: **Fri 4 Dec 2026, 2:00 PM Pacific = Sat 5 Dec, 03:30 IST.** Target: submitted by **Thu 3 Dec**. Re-read the hackathon Rules page on Day 0 and again on Day 12; this plan assumes the rules summarised in `docs/DEMO_AND_SUBMISSION.md`.

The order below is the order of the specs. Each spec ends with a checkpoint task. Do not start the next spec until the checkpoint passes.

## Schedule (IST dates; adjust to your days)

| Day | Date | Work | Done when |
|---|---|---|---|
| 0 | Thu 19 Nov | Unpack, `git init`, open in Kiro, check steering, hooks, agents and MCP load (`docs/KIRO_SETUP.md`). Fill the name in `LICENSE`. Request hackathon Kiro credits. First commit. | `.kiro/` visible in the first commit |
| 1 | Fri 20 Nov | Spec `project-bootstrap` | Checkpoint passes; app shell deploys to Pages |
| 2 | Sat 21 Nov | Spec `formulary-normaliser` tasks 1 to 7 | Golden normalise test passes |
| 3 | Sun 22 Nov | `formulary-normaliser` tasks 8 to 10, `merge-engine` tasks 1 to 3 | **Gate A** (below) |
| 4 | Mon 23 Nov | `merge-engine` tasks 4 to 11 | Properties P-M1 to P-M9 pass at 100 runs |
| 5 | Tue 24 Nov | Spec `history-audit` | Hero history golden test passes |
| 6 | Wed 25 Nov | Spec `interop-export` tasks 1 to 7 | Case file and FHIR export golden tests pass |
| 7 | Thu 26 Nov | `review-ui` tasks 1 to 5 (tooling, state, shell, Start) | Reducer properties pass; Start view screenshots reviewed |
| 8 | Fri 27 Nov | `review-ui` task 6 (chart and seam) | The Hero chart looks right in both themes at three widths |
| 9 | Sat 28 Nov | `review-ui` tasks 7 and 8 (strip, responsive) | A conflict can be decided end to end |
| 10 | Sun 29 Nov | `review-ui` tasks 9 to 12 (merged list, commit, history, problems, hero e2e) | **Gate B** (below) |
| 11 | Mon 30 Nov | `review-ui` tasks 13 to 15 (import/export, markers, accessibility); `interop-export` task 8 only if time | axe clean; case file round trip works in the browser |
| 12 | Tue 1 Dec | `review-ui` tasks 16 and 17 (design polish, checkpoint); deploy; re-read Rules | Live URL works from a private window |
| 13 | Wed 2 Dec | Record the demo, finish `docs/KIRO_LOG.md`, README polish, strict compliance | Video public on YouTube |
| 14 | Thu 3 Dec | Submit | Submission confirmation received |
| 15 | Fri 4 Dec | Buffer only. Deadline 2:00 PM Pacific (03:30 IST Saturday). | |

Credits: request them on Day 0 (the Kiro credit request had a deadline of Tue 1 Dec, 12:00 PM Pacific, which is 01:30 IST on Wed 2 Dec; confirm on the hackathon page).

## Gates

**Gate A (end of Day 3).** `normalise` and `mergeSources` pass their golden tests for all three scenarios. If not: stop adding anything, fix it, and drop F9 to F14 from scope. The rest of the plan assumes a correct core.

**Gate B (end of Day 10).** The Hero flow works in the browser from Start to a signed-off commit, and `e2e/hero.spec.ts` passes. If not: drop markers, FHIR import, the Crew and power ideas, and the dark-theme polish; finish the hero flow and history only.

## Cut list (cut in this order)
1. FHIR import (interop-export requirement 4), Kiro Crew bolt-on, MCP formulary server and power.
2. Marker view.
3. Dark theme polish (keep the theme working, stop refining it).
4. Mobile card layout polish (keep it usable).
5. FHIR export.
Never cut: the Hero flow, history with diff and blame, the synthetic notices, the accessibility basics, the licence and `.kiro/`.

## Daily routine
- Morning: read the next unchecked task in the active spec. Start it with the `medgit-builder` agent, or with Kiro's own spec task runner. One task at a time.
- During: let hooks run. Read any hook failure; do not disable a hook to get past it.
- Evening: run `npm run typecheck && npm run lint && npm test && npm run test:props`. Commit with a message naming the spec and task. Push. Add two lines to `docs/KIRO_LOG.md` (what Kiro did, what you learned). Take Playwright screenshots if the UI changed.

## If you fall behind
- First, shrink the task, not the quality bar: ask the agent for the smallest version that meets the requirement.
- Second, use the cut list.
- Third, never edit requirements to make a task easier. Ask for a decision; if the contract is wrong, change it yourself in an editor (the protect hook only blocks agents) and note the reason in `docs/KIRO_LOG.md`.
- If credits run low: use `npm run test:props:fast`, keep prompts small and spec-scoped, and avoid long exploratory chats.

## Definition of done (for the whole project)
- All six specs' checkpoints pass; `npm run test:props` passes at 100 runs.
- Hero e2e, axe and screenshot specs pass.
- `npm run check:compliance -- --strict` passes (no `REPLACE-WITH` left).
- The deployed app works from a private browser window and makes no cross-origin requests.
- Video recorded, public, three minutes or less; write-up complete.
