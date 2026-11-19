# MedGit: agent instructions

You are helping build MedGit, a tool that reconciles a patient's medicine lists the way git merges branches. Read `.kiro/steering/product.md` first, then the spec you are working on in `.kiro/specs/<name>/`.

Core rules:
1. The requirements in `.kiro/specs/*/requirements.md` are the contract. Do not edit them. If something is wrong or missing, stop and ask.
2. Never auto-resolve a disagreement, never silently drop a medication, never invent a missing value. See `.kiro/steering/clinical-safety.md`.
3. `src/core` is pure TypeScript: no React, no clock, no randomness, no network.
4. Golden expectations in `data/scenarios/*.json` are fixed. Fix the code, not the data.
5. Synthetic data only, always labelled. No runtime AI calls.
6. Use tokens from `src/ui/styles/tokens.css`. Look at your UI in screenshots before calling it done.
7. Run `npm run typecheck && npm run lint && npm run test` before finishing a task. Tick the task in `tasks.md`.
8. Never put `.kiro/` in `.gitignore`.

Map of documents: `docs/PRD.md` (what and why), `docs/ARCHITECTURE.md` (structure and APIs), `docs/MERGE_SEMANTICS.md` (exact merge rules), `docs/UX_SPEC.md` and `docs/DESIGN_SYSTEM.md` (screens and visuals).
