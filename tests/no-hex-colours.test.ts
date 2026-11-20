/**
 * No hard-coded colours test: validates that hex colours only exist in tokens.css.
 * Validates: project-bootstrap 3.7
 *
 * Rules enforced:
 * - No hex colour literals (#RGB, #RRGGBB, #RRGGBBAA) outside src/ui/styles/tokens.css
 * - No rgb() or hsl() function literals
 * - Exception: rgb(18 38 58 / 0.18) shadow in tokens.css only
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

interface ColourViolation {
  file: string;
  line: number;
  column: number;
  match: string;
}

const HEX_COLOUR_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_PATTERN = /\brgb\(/g;
const HSL_PATTERN = /\bhsl\(/g;

function* walkUIFiles(dir: string): Generator<string> {
  try {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      
      if (stat.isDirectory()) {
        yield* walkUIFiles(path);
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.css')) &&
        !entry.startsWith('._')
      ) {
        yield path;
      }
    }
  } catch {
    // Directory doesn't exist yet - this is fine
  }
}

function checkFileForColours(filePath: string): ColourViolation[] {
  const violations: ColourViolation[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip tokens.css entirely
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (normalizedPath.includes('src/ui/styles/tokens.css')) {
    return violations;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip undefined or empty lines
    const lineNumber = i + 1;

    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Check for hex colours
    let match: RegExpExecArray | null;
    const hexPattern = new RegExp(HEX_COLOUR_PATTERN.source, 'g');
    while ((match = hexPattern.exec(line)) !== null) {
      // Skip if it's in a comment on the same line
      const beforeMatch = line.substring(0, match.index);
      if (beforeMatch.includes('//')) continue;
      
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        match: match[0] ?? '',
      });
    }

    // Check for rgb() literals
    const rgbPattern = new RegExp(RGB_PATTERN.source, 'g');
    while ((match = rgbPattern.exec(line)) !== null) {
      const beforeMatch = line.substring(0, match.index);
      if (beforeMatch.includes('//')) continue;
      
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        match: 'rgb(',
      });
    }

    // Check for hsl() literals
    const hslPattern = new RegExp(HSL_PATTERN.source, 'g');
    while ((match = hslPattern.exec(line)) !== null) {
      const beforeMatch = line.substring(0, match.index);
      if (beforeMatch.includes('//')) continue;
      
      violations.push({
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        match: 'hsl(',
      });
    }
  }

  return violations;
}

describe('Design system: no hard-coded colours', () => {
  it('enforces that hex colours and colour functions only exist in tokens.css', () => {
    const uiFiles = Array.from(walkUIFiles('src/ui'));
    
    // Test passes if no UI files exist yet (vacuous truth)
    if (uiFiles.length === 0) {
      expect(true).toBe(true);
      return;
    }

    const allViolations: ColourViolation[] = [];
    
    for (const file of uiFiles) {
      const violations = checkFileForColours(file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map(v => {
          const relPath = relative(process.cwd(), v.file);
          return `  ${relPath}:${v.line}:${v.column} - found "${v.match}"`;
        })
        .join('\n');
      
      expect.fail(
        `Hard-coded colour literals found in src/ui:\n${report}\n\n` +
        `All colours must be defined as design tokens in src/ui/styles/tokens.css and referenced through Tailwind classes or CSS variables.`
      );
    }

    // Explicitly assert success
    expect(allViolations).toHaveLength(0);
  });
});
