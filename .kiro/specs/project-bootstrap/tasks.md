# Tasks: project-bootstrap

Run `npm run typecheck && npm test` after each task. Keep commits small. Do not edit `requirements.md`.

- [ ] 1. Initialise the project
  - Create `package.json` (name `medgit`, `type: module`, license `MIT`) with the scripts in design.md.
  - Install runtime: `react`, `react-dom`, `lucide-react`, `motion`, `@noble/hashes`, `@fontsource/atkinson-hyperlegible-next`, `@fontsource/atkinson-hyperlegible-mono`.
  - Install dev: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `fast-check`, `@playwright/test`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@types/react`, `@types/react-dom`, `@types/node`, `cross-env`, `@axe-core/playwright`.
  - Use current stable versions; do not copy versions from memory. Import `@noble/hashes` with `.js` subpaths (for example `@noble/hashes/sha2.js`).
  - _Requirements: 2.1_

- [ ] 2. Configure TypeScript, Vite, ESLint, Vitest
  - Add `tsconfig.json` and `tsconfig.core.json`, `vite.config.ts` (relative base, aliases), `eslint.config.js`, `vitest.config.ts`, `tests/helpers/fc.ts`.
  - Add `src/core/index.ts` with an empty export and `src/ui/main.tsx`, `src/ui/App.tsx` rendering the shell placeholder.
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Architecture and colour tests
  - Write `tests/architecture.test.ts` and `tests/no-hex-colours.test.ts` as in design.md.
  - Prove each can fail with a temporary bad file, then remove it.
  - _Requirements: 2.6, 3.7_

- [ ] 4. Tokens, Tailwind mapping, fonts
  - Create `src/ui/styles/index.css` per `docs/DESIGN_SYSTEM.md` section 3. Keep `tokens.css` unchanged.
  - Import fonts and styles in `main.tsx`. Verify no remote font request in the Network panel (Playwright MCP).
  - _Requirements: 3.1, 3.2, 3.8_

- [ ] 5. Theme provider and no-flash script
  - Implement `ThemeProvider`, the inline script in `index.html`, and storage with try and catch.
  - Unit test the provider with a storage mock that throws.
  - _Requirements: 3.3, 3.4_

- [ ] 6. Application shell
  - Implement `AppShell`, `SyntheticChip`, `LiveRegion` and `announce`, skip link, footer text from the copy deck.
  - Install shadcn primitives listed in `docs/DESIGN_SYSTEM.md` section 4 using the shadcn MCP, and remap variables.
  - Take screenshots at 1440x900, 1024x768, 390x844 in both themes and review them.
  - _Requirements: 3.5, 3.6_

- [ ] 7. Compliance script
  - Implement `scripts/check-compliance.mjs` and `tests/scripts/compliance.test.ts`.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [ ] 8. README
  - Write `README.md` with the required sections. Leave `REPLACE-WITH` markers only for the live URL and the repo owner.
  - _Requirements: 1.3, 1.4_

- [ ] 9. Data validation script
  - Implement `scripts/validate-data.mjs`. Run it against the current `data/`. It must pass.
  - Add a unit test that feeds the validators small bad objects and expects failures.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 10. CI and deploy workflows
  - Review `.github/workflows/ci.yml` and `deploy-pages.yml`; fix action versions to current ones.
  - _Requirements: 4.1, 4.2_

- [ ] 11. Smoke end-to-end test
  - Write `e2e/smoke.spec.ts`: chip and footer visible, theme toggle works, no cross-origin requests.
  - _Requirements: 3.5, 3.3, 4.3_

- [ ] 12. Checkpoint
  - Run typecheck, lint, test, validate:data, build, check:compliance, e2e. All must pass.
  - Update `docs/KIRO_LOG.md` with what this spec taught about working with Kiro.
