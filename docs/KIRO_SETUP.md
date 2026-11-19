# Setting up Kiro for MedGit

Do this once, on Day 0. It takes about 30 minutes.

## 1. Put the project in a repository
```bash
unzip medgit-starter-pack.zip
cd medgit
git init -b main
git add -A
git commit -m "Initial commit: specs, steering, hooks, agents, data"
```
Check that `.kiro/` is in that commit: `git ls-files .kiro | head`. It must be, and it must stay committed. Edit `LICENSE` and replace `REPLACE-WITH-YOUR-FULL-NAME`. Create a public GitHub repository and push.

## 2. Open it in Kiro
Open the folder in the Kiro IDE (or run the Kiro CLI inside it). Then check each item:

| Check | Where | Expect |
|---|---|---|
| Steering | Steering panel | Seven files: product, tech, structure (always), clinical-safety, ui-ux, testing-pbt (file match), demo-data (manual). `AGENTS.md` at the root is included automatically. |
| Specs | Specs panel | Six specs: project-bootstrap, formulary-normaliser, merge-engine, history-audit, interop-export, review-ui, each with requirements, design and tasks. If Kiro does not list them, open `tasks.md` in a spec and use its task controls. |
| Hooks | Hooks panel | Six hooks: protect-contract, core-checks, ui-no-hex, traceability, task-done-checks, kiro-log (manual). If a trigger name is rejected (most likely `PostTaskExecution`), open the hook in the panel and pick the equivalent trigger. |
| Agents | Agent picker | `medgit-builder`, `ui-critic`, `safety-reviewer`. |
| MCP | MCP panel | `shadcn`, `playwright`, `context7` connected; `medgit-formulary` disabled (that is intended). |

If an MCP server does not start, run its command in a terminal to see the error (for example `npx shadcn@latest mcp`). Playwright needs browsers: `npx playwright install chromium` after `npm install` exists.

Do not put API keys in any file. Context7 works without a key at a lower rate limit; if you add a key, use an environment variable.

## 3. Working method
1. Select the `medgit-builder` agent.
2. Say: "Work on spec project-bootstrap, task 1." (Or use Kiro's spec task runner on the same `tasks.md`.)
3. Let it run. Hooks run automatically. Read any hook output.
4. When a task is done, review the diff yourself, run the checks, commit.
5. After a screen is built, run the `ui-critic` agent: "Review the Reconcile view."
6. After a change in `src/core`, run the `safety-reviewer` agent: "Review my last commit."

## 4. Showing Kiro's features honestly (for the write-up)
Capture evidence as you go in `docs/KIRO_LOG.md`.

- **Specs.** The six specs are the project's backbone. Note any time Kiro's task runner or spec view helped, and any requirement the agent asked to clarify.
- **Steering.** Note a case where a steering rule changed what the agent produced (for example clinical-safety preventing a default value).
- **Hooks.** Keep a screenshot or copy of one real block by `protect-contract`, and one `core-checks` failure the agent then fixed.
- **Custom agents.** Note what `ui-critic` and `safety-reviewer` found that you or the builder had missed.
- **MCP.** shadcn for components, Playwright for screenshots and verification, Context7 for current docs. Note one concrete moment for each.
- **Property-based testing.** In the IDE, use Kiro's property-based testing feature on the Correctness Properties in a `design.md` and compare with the properties already written; log a property that found a real bug, with the counterexample.
- **Powers, Crew, CLI, Web.** Only claim what you actually used. If you build the optional formulary server and power, or a Crew app, log them with one sentence each; if not, leave them out.

## 5. Provenance (be upfront)
The specs, steering, docs and fixtures in this starter pack were drafted with Claude before the build, then imported into Kiro. State that plainly in the write-up. All product code and tests should be generated and iterated in Kiro so the write-up can describe real Kiro usage. Check the hackathon Rules for anything about tools or pre-existing materials, and keep the repository's first commit date honest.

## 6. Troubleshooting
| Problem | Try |
|---|---|
| A hook does not fire | Open the Hooks panel and check it is enabled and the trigger exists; save a matching file again |
| The protect hook blocks something you really want changed | Edit the file yourself in an editor, or start Kiro with `MEDGIT_ALLOW_PROTECTED=1` for the session; note why in `docs/KIRO_LOG.md` |
| Property tests are slow | Use `npm run test:props:fast` while iterating; run the full suite before finishing a task |
| Agent edits requirements | It should be blocked by the hook; if it is not, check that hooks are enabled |
| Agent wants to add a library not in the plan | Ask why; prefer no new dependencies; if accepted, record it in `docs/KIRO_LOG.md` |
