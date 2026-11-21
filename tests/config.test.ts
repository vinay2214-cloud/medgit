/**
 * Structure tests for the toolchain and repository rules (project-bootstrap).
 * They read the real config files, so drift in a config fails a test.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error - importing from .mjs without type definitions (same pattern as tests/scripts/compliance.test.ts)
import { checkAll } from '../scripts/check-compliance.mjs';

const read = (p: string) => readFileSync(p, 'utf8');

describe('repository compliance', () => {
  // Validates: project-bootstrap 1.1, 1.3, 1.4
  it('has an MIT LICENSE and a README with the notice, run, test, live-app and log sections', () => {
    expect(read('LICENSE').split('\n')[0]).toMatch(/MIT/);
    const readme = read('README.md').toLowerCase();
    expect(readme).toContain('synthetic');
    expect(readme).toContain('not for clinical use');
    expect(readme).toContain('npm run dev');
    expect(readme).toContain('npm test');
    expect(readme).toContain('live app');
    expect(readme).toContain('docs/kiro_log.md');
  });

  // Validates: project-bootstrap 1.5, 1.6
  it('check-compliance fails on a missing licence, an ignored .kiro, a README without the notice, and placeholders in strict mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'medgit-compliance-'));
    mkdirSync(join(dir, '.kiro'));
    writeFileSync(join(dir, '.gitignore'), '.kiro/\n');
    writeFileSync(join(dir, 'README.md'), 'A demo. Live app: REPLACE-WITH-URL\n');
    const failures = checkAll(dir, false);
    expect(failures.some((f: string) => f.startsWith('LICENSE'))).toBe(true);
    expect(failures.some((f: string) => f.startsWith('.gitignore'))).toBe(true);
    expect(failures.some((f: string) => f.includes('synthetic'))).toBe(true);
    writeFileSync(join(dir, 'LICENSE'), 'MIT License\n');
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    writeFileSync(join(dir, 'README.md'), 'Synthetic data. Not for clinical use. Live app: REPLACE-WITH-URL\n');
    expect(checkAll(dir, false)).toEqual([]);
    expect(checkAll(dir, true).some((f: string) => f.includes('REPLACE-WITH'))).toBe(true);
  });
});

describe('toolchain', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  const tsconfig = read('tsconfig.json');

  // Validates: project-bootstrap 2.1
  it('provides every required npm script', () => {
    for (const s of ['dev', 'typecheck', 'lint', 'test', 'test:props', 'test:props:fast', 'e2e', 'validate:data', 'check:compliance', 'check:traceability', 'build']) {
      expect(pkg.scripts[s], s).toBeTruthy();
    }
  });

  // Validates: project-bootstrap 2.2, 2.3
  it('enables strict and noUncheckedIndexedAccess, and lint errors on explicit any', () => {
    expect(tsconfig).toMatch(/"strict":\s*true/);
    expect(tsconfig).toMatch(/"noUncheckedIndexedAccess":\s*true/);
    expect(read('eslint.config.js')).toMatch(/'@typescript-eslint\/no-explicit-any':\s*'error'/);
  });

  // Validates: project-bootstrap 2.4, 2.5
  it('builds with a relative base and reads FC_NUM_RUNS (25 in the fast script)', () => {
    expect(read('vite.config.ts')).toMatch(/base:\s*'\.\/'/);
    expect(pkg.scripts['test:props:fast']).toContain('FC_NUM_RUNS=25');
    expect(read('tests/helpers/fc.ts')).toContain('process.env.FC_NUM_RUNS ?? 100');
  });
});

describe('design tokens and shell', () => {
  const css = read('src/ui/styles/index.css');
  // Validates: project-bootstrap 3.1, 3.6, 3.8
  it('maps tokens through @theme inline, keeps a visible focus ring, and zeroes durations for reduced motion', () => {
    expect(css).toMatch(/@import "\.\/tokens\.css"/);
    expect(css).toMatch(/@theme inline/);
    expect(css).toMatch(/:focus-visible\s*{\s*outline: 2px solid var\(--focus\)/);
    expect(read('src/ui/styles/tokens.css')).toMatch(/prefers-reduced-motion: reduce\)\s*{\s*:root\s*{\s*--seam-close-ms: 0ms/);
  });

  // Validates: project-bootstrap 3.2
  it('self-hosts both fonts and references no remote font host', () => {
    const main = read('src/ui/main.tsx');
    expect(main).toContain('@fontsource/atkinson-hyperlegible-next');
    expect(main).toContain('@fontsource/atkinson-hyperlegible-mono');
    expect(read('index.html') + css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"')\s]*\.woff/);
  });
});

describe('CI and deployment workflows', () => {
  // Validates: project-bootstrap 4.1
  it('CI runs install, typecheck, lint, test, validate:data, build, check:compliance and check:traceability', () => {
    const ci = read('.github/workflows/ci.yml');
    for (const step of ['npm ci', 'npm run typecheck', 'npm run lint', 'npm test', 'npm run validate:data', 'npm run build', 'npm run check:compliance', 'npm run check:traceability']) {
      expect(ci, step).toContain(`run: ${step}`);
    }
    expect(ci).toMatch(/pull_request/);
  });

  // Validates: project-bootstrap 4.2
  it('deploys dist to GitHub Pages on push to main', () => {
    const d = read('.github/workflows/deploy-pages.yml');
    expect(d).toMatch(/branches: \[main\]/);
    expect(d).toMatch(/upload-pages-artifact@v\d+[\s\S]*path: dist/);
    expect(d).toMatch(/deploy-pages@v\d+/);
    expect(d).toMatch(/pages: write/);
  });
});
