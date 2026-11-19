---
inclusion: always
---
# MedGit: technology steering

## Stack
- TypeScript (strict), Vite, React, Tailwind CSS v4, shadcn/ui (Radix primitives), lucide-react icons, `motion` for animation.
- Core logic is plain TypeScript with no framework imports. SHA-256 comes from `@noble/hashes` (v2 exports use `.js` subpaths such as `@noble/hashes/sha2.js`; check with Context7 before writing imports).
- Tests: Vitest for unit, golden and property tests; fast-check for properties; Playwright for one end-to-end flow.
- Fonts: `@fontsource/atkinson-hyperlegible-next` and `@fontsource/atkinson-hyperlegible-mono` (self-hosted, no CDN).
- Optional MCP server: `@modelcontextprotocol/sdk` with `zod`, run with `tsx`.
- Install the current stable version of each package. Do not invent version numbers. If an API looks different from what you remember, look it up (Context7 MCP) before coding.

## Commands (all must exist after the project-bootstrap spec)
- `npm run dev` start Vite.
- `npm run typecheck`, `npm run lint`, `npm run test`.
- `npm run test:props` full property suite. `npm run test:props:fast` same suite with `FC_NUM_RUNS=25`.
- `npm run e2e` Playwright hero flow.
- `npm run validate:data` structural check of `data/`.
- `npm run check:compliance` hackathon rules (licence, `.kiro` not ignored, README notice); add `-- --strict` before submitting.
- `npm run check:traceability` requirement ids in tasks and tests exist.
- `npm run build` static output in `dist/` with a relative base so it works on GitHub Pages.

## Rules for core code (`src/core/**`)
- Pure functions. No `Date.now()`, `new Date()` without an argument, `Math.random()`, `fetch`, `localStorage`, `console.*` or global state. Time comes from an injected `Clock`.
- No imports from `react`, `src/ui/**` or any browser API. A test enforces this.
- Return `Result<T, E>` (`{ ok: true, value } | { ok: false, error }`) for expected failures. Throw only for programmer errors.
- All output is canonical: arrays sorted as specified, object keys built in a fixed order, numbers rounded to 6 decimal places where converted.
- Types first. Define types in `src/core/types.ts` before writing logic. No `any`. No non-null assertions.

## Rules for dependencies
- Add a dependency only if a task needs it. Record each addition in `docs/KIRO_LOG.md` with one line of reason.
- No analytics, no tracking, no remote fonts, no runtime network calls. The deployed app must work offline after load.
- No API keys anywhere in the repo. If a tool asks for one, stop.

## Git and files
- Small commits, imperative messages ("Add three-way merge for medication lists").
- `.kiro/` is part of the submission. Never add it, or anything inside it, to `.gitignore`.
- Do not edit `LICENSE`, `.env*`, `data/scenarios/*.json`, `data/vectors/*.json`, `data/formulary.json`, any `requirements.md`, `docs/MERGE_SEMANTICS.md`, `docs/PRD.md`, `docs/UX_SPEC.md` or `docs/DESIGN_SYSTEM.md` unless the human asks. The `protect-contract` hook blocks these edits; if it blocks you, stop and ask.
