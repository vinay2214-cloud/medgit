# Demo and submission

Based on the Kiroween 2026 requirements as summarised on 19 Nov 2026. **Re-read the Rules page on Day 0 and Day 12**; if anything below disagrees with it, the Rules page wins.

## Submission checklist
- [ ] New project, first commit on or after the hackathon start date (30 Oct 2026).
- [ ] Public GitHub repository with an OSI licence file at the root (`LICENSE`, MIT), detected by GitHub.
- [ ] `/.kiro` directory committed and visible on GitHub (steering, specs, hooks, agents, settings). Not in `.gitignore`.
- [ ] Working application URL (GitHub Pages), opens in a private window, no sign-in.
- [ ] Demo video on YouTube, **public**, **three minutes or less**, shows the app working. Open the link in a private window to confirm.
- [ ] Write-up of how Kiro was used, covering what applies: IDE, CLI, Web, Crew, custom agents, hooks, specs, steering, MCP, property-based testing, powers. Built from `docs/KIRO_LOG.md`. Only claim what you used.
- [ ] Category chosen: **Frankenstein**.
- [ ] Submitted before the deadline: Fri 4 Dec 2026, 2:00 PM Pacific (Sat 5 Dec, 03:30 IST). Aim for Thu 3 Dec.
- [ ] `npm run check:compliance -- --strict` passes (no `REPLACE-WITH` placeholders left in README, LICENSE or powers).
- [ ] The URL stays up until the judging period ends (the app is static, so nothing to keep alive).

## Pre-submit quality pass
- [ ] Fresh clone, `npm ci`, `npm run build`, `npm run e2e` pass.
- [ ] Deployed URL: Hero opens, all six decisions can be made, sign off works, History shows chain verified, export downloads.
- [ ] Browser console has no errors. Network tab shows no requests to other origins.
- [ ] Synthetic notice visible on every screen and in every export.
- [ ] Light and dark themes both fine. Keyboard-only run-through done.
- [ ] README renders on GitHub; links work; live URL and video URL filled in.
- [ ] No secrets in the repository: search for `key`, `token`, `secret`.

## Demo video: 3 minutes, one story
Record at 1920x1080, browser at 100% zoom, light theme, bookmarks bar hidden, notifications off. Rehearse twice with the Hero `demoScript`. Aim for 2:50. Voice-over or on-screen text; either is fine, but make every sentence short.

| Time | On screen | Say or show |
|---|---|---|
| 0:00 to 0:15 | Start view, then click Hero | "When a patient leaves hospital, four lists of their medicines disagree. Reconciling them is done by hand. MedGit is git merge for medicines." |
| 0:15 to 0:40 | Reconcile chart: counters "6 to decide, 3 agreed"; point at the red seams | "Hospital, GP, pharmacy and the patient. Three medicines agree. Six do not. Brand names and units are already normalised: 0.05 milligrams equals 50 micrograms." |
| 0:40 to 1:00 | Toggle Markers, then back to Chart | "Underneath, it is a real merge conflict. Every source's claim is kept." |
| 1:00 to 1:40 | Metformin: choose hospital, reason, apply; seam closes. Amlodipine: escalate as clinician (amber); switch role to pharmacist; decide | "Nothing is resolved automatically. Each decision needs a reason. Escalated items can only be decided by a pharmacist, and the core enforces that." |
| 1:40 to 2:00 | Remaining four decisions, sped up | "Include a medicine the others missed. Leave off one. Or type a value by hand, marked as entered by hand." |
| 2:00 to 2:25 | Commit panel: message, Sign off, short id. History: log, Changes tab (3 added, aspirin status changed), Last changed with reasons, "Chain verified" | "Sign-off is a commit: a diff, a log, and who last changed each line and why. The ids are hashes, so any tampering shows." |
| 2:25 to 2:50 | Quick cuts in Kiro: the six specs; the `protect-contract` hook blocking an edit; a property test failing with a counterexample, then passing; the `ui-critic` screenshots | "Built with Kiro: specs with correctness properties, steering for clinical safety, hooks that guard the contract, agents that review the interface, and property-based tests that found real bugs." (Say only what you actually did.) |
| 2:50 to 3:00 | Title card with URL and repo | "MedGit. Synthetic data. Not for clinical use." |

Record the Kiro cuts separately during the build (screen captures of the real moments) so they are genuine.

## Write-up template (fill from `docs/KIRO_LOG.md`)

**Inspiration.** Medication reconciliation is a version-control problem that the clinical world solves by hand.

**What it does.** (Two sentences from the README, then the five guarantees.)

**How we built it with Kiro.**
- Specs: six specs, EARS requirements, designs with correctness properties, task lists. (One real example.)
- Steering: seven steering files in three inclusion modes; clinical safety as a rule the agent followed. (One example.)
- Hooks: six hooks; one that blocks edits to the requirements. (One real block.)
- Custom agents: builder, UI critic, safety reviewer. (What each found.)
- MCP: shadcn, Playwright, Context7. (One moment each.)
- Property-based testing: properties for normaliser, merge, history, import and UI state. (One bug a property found.)
- Powers, Crew, CLI, Web: only if used.

**Challenges.** (Merge semantics for medicines; keeping the core pure and deterministic; making state obvious without colour alone.)

**What we are proud of.** (The seam; the guarantees backed by properties; accessibility.)

**What we learned.** (Three lessons from the log.)

**What's next.** (Free-text input parsing; more sources; real terminology; clinical validation, none of which this demo claims.)

**Built with.** TypeScript, React, Vite, Tailwind CSS, shadcn/ui, fast-check, Vitest, Playwright, Kiro.

## Judging criteria mapping
Copy the judging criteria from the Rules page into this table on Day 12 and write one proof point each. Proof points available in this project:
- A category-fit idea with a visible motif (Frankenstein: version control stitched onto clinical reconciliation; the seam).
- Depth of Kiro use: specs, steering, hooks, agents, MCP, property-based tests, each with a real example in `docs/KIRO_LOG.md`.
- Engineering quality: pure core, golden tests, properties, tamper-evident history, accessibility checks, CI, deployment.
- Design quality: a distinctive, accessible interface verified with screenshots at three widths in two themes.
- Real-world value: a clear problem, an honest scope, safety guarantees, and explicit limits.

| Criterion (from the Rules page) | Proof in the project |
|---|---|
| | |
| | |
| | |
