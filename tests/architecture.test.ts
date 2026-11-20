/**
 * Architecture test: validates src/core architectural boundaries.
 * Validates: project-bootstrap 2.6
 *
 * Rules enforced:
 * - No imports from src/ui, @ui, react, or node: modules
 * - No browser APIs: Date.now, new Date() (empty parens), Math.random, fetch, localStorage, sessionStorage, console., document., window.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface Violation {
  file: string;
  line: number;
  issue: string;
}

const FORBIDDEN_IMPORTS = [
  { pattern: /from\s+['"]\.\.\/ui/, desc: 'relative import from ../ui' },
  { pattern: /from\s+['"]@ui/, desc: 'import from @ui alias' },
  { pattern: /from\s+['"]react/, desc: 'import from react' },
  { pattern: /from\s+['"]react-dom/, desc: 'import from react-dom' },
  { pattern: /from\s+['"]node:/, desc: 'import from node: protocol (use @noble/hashes, not node crypto)' },
];

const FORBIDDEN_TOKENS = [
  { pattern: /\bDate\.now\(\)/, desc: 'Date.now() (inject clock instead)' },
  { pattern: /\bnew Date\(\s*\)/, desc: 'new Date() with no argument (inject clock instead)' },
  { pattern: /\bMath\.random\(\)/, desc: 'Math.random() (core must be deterministic)' },
  { pattern: /\bfetch\(/, desc: 'fetch( (no network in core)' },
  { pattern: /\blocalStorage\b/, desc: 'localStorage (no browser APIs in core)' },
  { pattern: /\bsessionStorage\b/, desc: 'sessionStorage (no browser APIs in core)' },
  { pattern: /\bconsole\./, desc: 'console. (no logging in core)' },
  { pattern: /\bdocument\./, desc: 'document. (no DOM in core)' },
  { pattern: /\bwindow\./, desc: 'window. (no browser globals in core)' },
];

function* walkTypeScriptFiles(dir: string): Generator<string> {
  try {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      
      if (stat.isDirectory()) {
        yield* walkTypeScriptFiles(path);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        yield path;
      }
    }
  } catch {
    // Directory doesn't exist yet - this is fine
  }
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip undefined or empty lines
    const lineNumber = i + 1;

    // Skip comments and strings for token checks (but not import checks)
    const isComment = line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*');
    
    // Check imports (these should be checked even in comments since they would be syntax errors)
    for (const { pattern, desc } of FORBIDDEN_IMPORTS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: lineNumber,
          issue: desc,
        });
      }
    }

    // Check forbidden tokens (skip in comments and string literals)
    if (!isComment) {
      // Basic check: skip lines that are entirely within quotes
      const withoutStrings = line.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '');
      
      for (const { pattern, desc } of FORBIDDEN_TOKENS) {
        if (pattern.test(withoutStrings)) {
          violations.push({
            file: filePath,
            line: lineNumber,
            issue: desc,
          });
        }
      }
    }
  }

  return violations;
}

describe('Architecture: src/core boundaries', () => {
  it('enforces that src/core contains only pure TypeScript with no UI or browser dependencies', () => {
    const coreFiles = Array.from(walkTypeScriptFiles('src/core'));
    
    // Test passes vacuously if no core files exist yet
    if (coreFiles.length === 0) {
      expect(true).toBe(true);
      return;
    }

    const allViolations: Violation[] = [];
    
    for (const file of coreFiles) {
      const violations = checkFile(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map(v => `  ${v.file}:${v.line} - ${v.issue}`)
        .join('\n');
      
      expect.fail(
        `Architecture violations found in src/core:\n${report}\n\n` +
        `Core modules must be pure TypeScript with no React, UI, or browser APIs.`
      );
    }

    // Explicitly assert success
    expect(allViolations).toHaveLength(0);
  });
});
