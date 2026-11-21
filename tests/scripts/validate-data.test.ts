/**
 * Unit tests for data validation script.
 * Validates: project-bootstrap 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT_PATH = join(process.cwd(), 'scripts/validate-data.mjs');
const tempDirs: string[] = [];

/**
 * Create a temporary test directory with data/ structure.
 * Returns the temp directory path.
 */
function createTempDataDir(structure: {
  formulary?: unknown;
  scenarios?: Record<string, unknown>;
  vectors?: unknown;
}): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'medgit-test-'));
  tempDirs.push(tempDir);

  const dataDir = join(tempDir, 'data');
  mkdirSync(dataDir);

  if (structure.formulary !== undefined) {
    writeFileSync(
      join(dataDir, 'formulary.json'),
      JSON.stringify(structure.formulary, null, 2)
    );
  }

  if (structure.scenarios) {
    const scenariosDir = join(dataDir, 'scenarios');
    mkdirSync(scenariosDir);
    for (const [name, content] of Object.entries(structure.scenarios)) {
      writeFileSync(
        join(scenariosDir, `${name}.json`),
        JSON.stringify(content, null, 2)
      );
    }
  }

  if (structure.vectors !== undefined) {
    const vectorsDir = join(dataDir, 'vectors');
    mkdirSync(vectorsDir);
    writeFileSync(
      join(vectorsDir, 'canonical.json'),
      JSON.stringify(structure.vectors, null, 2)
    );
  }

  return tempDir;
}

/**
 * Run the validation script in the given directory.
 * Returns exit code, stdout and stderr.
 */
function runValidation(cwd: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync('node', [SCRIPT_PATH], {
    cwd,
    encoding: 'utf8',
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

afterEach(() => {
  // Clean up all temporary directories
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
  tempDirs.length = 0;
});

describe('Data validation script', () => {
  describe('Requirement 5.1: Formulary schema, IDs and required fields', () => {
    // Validates: project-bootstrap 5.1
    it('should reject missing schema', () => {
      const tempDir = createTempDataDir({
        formulary: { items: [] },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('schema');
    });

    // Validates: project-bootstrap 5.1
    it('should reject invalid schema version', () => {
      const tempDir = createTempDataDir({
        formulary: { schema: 'medgit.formulary/2', items: [] },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('medgit.formulary/1');
    });

    // Validates: project-bootstrap 5.1
    it('should reject duplicate formulary IDs', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 100mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[100]],
              aliases: ['ASA'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('duplicate');
      expect(result.stderr).toContain('aspirin-tab');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing id', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing id');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing ingredient', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing ingredient');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing display', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing display');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing form', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing form');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing route', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing route');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing canonicalUnit', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing canonicalUnit');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing strengths', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              aliases: ['Aspirin'],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing strengths');
    });

    // Validates: project-bootstrap 5.1
    it('should reject item missing aliases', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('missing aliases');
    });

    // Validates: project-bootstrap 5.1
    it('should accept valid formulary', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin', 'ASA'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('passed');
    });
  });

  describe('Requirement 5.2: Normalized alias collision', () => {
    // Validates: project-bootstrap 5.2
    it('should reject normalized alias collision', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin-75'],
            },
            {
              id: 'metformin-tab',
              ingredient: 'Metformin',
              display: 'Metformin 500mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[500]],
              aliases: ['Aspirin 75'], // Normalizes to same as 'Aspirin-75'
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
      expect(result.stderr).toContain('alias');
      expect(result.stderr).toContain('both');
    });

    // Validates: project-bootstrap 5.2
    it('should accept non-colliding aliases', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin', 'ASA'],
            },
            {
              id: 'metformin-tab',
              ingredient: 'Metformin',
              display: 'Metformin 500mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[500]],
              aliases: ['Metformin', 'Glucophage'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Requirement 5.3: Scenario structure', () => {
    // Validates: project-bootstrap 5.3
    it('should reject invalid scenario schema', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/2',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('medgit.scenario/1');
    });

    // Validates: project-bootstrap 5.3
    it('should reject missing syntheticNotice', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('syntheticNotice');
    });

    // Validates: project-bootstrap 5.3
    it('should reject empty syntheticNotice', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: '   ',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('syntheticNotice');
    });

    // Validates: project-bootstrap 5.3
    it('should reject scenario with fewer than two sources', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [{ id: 'hospital', items: [] }],
            expected: { conflicts: [], clean: [] },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('two sources');
    });

    // Validates: project-bootstrap 5.3
    it('should reject duplicate source IDs', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'hospital', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('duplicate');
      expect(result.stderr).toContain('hospital');
    });

    // Validates: project-bootstrap 5.3
    it('should reject missing expected block', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('expected');
    });
  });

  describe('Requirement 5.4: Conflict ID format', () => {
    // Validates: project-bootstrap 5.4
    it('should reject malformed conflict ID without separator', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [{ id: 'aspirin-tab-DOSE', kind: 'DOSE' }],
              clean: [],
            },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('conflict id');
      expect(result.stderr).toContain('<drugKey>::<KIND>');
    });

    // Validates: project-bootstrap 5.4
    it('should reject invalid conflict KIND', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [{ id: 'aspirin-tab::INVALID', kind: 'INVALID' }],
              clean: [],
            },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('conflict id');
      expect(result.stderr).toContain('aspirin-tab::INVALID');
    });

    // Validates: project-bootstrap 5.4
    it('should reject conflict with kind mismatch', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [{ id: 'aspirin-tab::DOSE', kind: 'FREQUENCY' }],
              clean: [],
            },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('aspirin-tab::DOSE');
      expect(result.stderr).toContain('FREQUENCY');
    });

    // Validates: project-bootstrap 5.4
    it('should reject conflict with unknown drugKey', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [{ id: 'unknown-drug::DOSE', kind: 'DOSE' }],
              clean: [],
            },
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('unknown-drug::DOSE');
      expect(result.stderr).toContain('not in the formulary');
    });

    // Validates: project-bootstrap 5.4
    it('should accept unmapped drugKey', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [{ id: 'unmapped:herbal-tea::DOSE', kind: 'DOSE' }],
              clean: [],
            },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
    });

    // Validates: project-bootstrap 5.4
    it('should accept all valid conflict KINDs', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [
                { id: 'aspirin-tab::OMISSION', kind: 'OMISSION' },
                { id: 'aspirin-tab::DOSE', kind: 'DOSE' },
                { id: 'aspirin-tab::FREQUENCY', kind: 'FREQUENCY' },
                { id: 'aspirin-tab::STATUS', kind: 'STATUS' },
              ],
              clean: [],
            },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Requirement 5.5: DemoScript conflict references', () => {
    // Validates: project-bootstrap 5.5
    it('should reject demoScript with non-existent conflict ID', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [{ id: 'aspirin-tab::DOSE', kind: 'DOSE' }],
              clean: [],
            },
            demoScript: [{ conflictId: 'aspirin-tab::FREQUENCY' }],
          },
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('test.json');
      expect(result.stderr).toContain('demoScript');
      expect(result.stderr).toContain('aspirin-tab::FREQUENCY');
      expect(result.stderr).toContain('not in expected.conflicts');
    });

    // Validates: project-bootstrap 5.5
    it('should accept demoScript with valid conflict references', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: {
              conflicts: [
                { id: 'aspirin-tab::DOSE', kind: 'DOSE' },
                { id: 'aspirin-tab::FREQUENCY', kind: 'FREQUENCY' },
              ],
              clean: [],
            },
            demoScript: [
              { conflictId: 'aspirin-tab::DOSE' },
              { conflictId: 'aspirin-tab::FREQUENCY' },
            ],
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Requirement 5.6: Vectors validation', () => {
    // Validates: project-bootstrap 5.6
    it('should reject vector missing canonical field', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('canonical.json');
      expect(result.stderr).toContain('test');
      expect(result.stderr).toContain('canonical');
    });

    // Validates: project-bootstrap 5.6
    it('should reject vector missing sha256 field', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('canonical.json');
      expect(result.stderr).toContain('test');
      expect(result.stderr).toContain('sha256');
    });

    // Validates: project-bootstrap 5.6
    it('should reject vector with invalid sha256 format', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256: 'not-a-valid-hex-string',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('canonical.json');
      expect(result.stderr).toContain('test');
      expect(result.stderr).toContain('sha256');
    });

    // Validates: project-bootstrap 5.6
    it('should reject vector with short sha256', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256: 'abcdef123456',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('canonical.json');
      expect(result.stderr).toContain('64-character');
    });

    // Validates: project-bootstrap 5.6
    it('should accept valid 64-character hex sha256', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Requirement 5.7: Error reporting', () => {
    // Validates: project-bootstrap 5.7
    it('should exit with non-zero code for invalid data', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'wrong-schema',
          items: [],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
    });

    // Validates: project-bootstrap 5.7
    it('should identify the affected file in error output', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'test-id',
              ingredient: 'Test',
              display: 'Test display',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[100]],
              // Missing aliases
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('formulary.json');
    });

    // Validates: project-bootstrap 5.7
    it('should explain the failure reason in output', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'test-id',
              ingredient: 'Test',
              display: 'Test display',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[100]],
              // Missing aliases
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('missing');
      expect(result.stderr).toContain('aliases');
    });

    // Validates: project-bootstrap 5.7
    it('should exit with zero for completely valid data', () => {
      const tempDir = createTempDataDir({
        formulary: {
          schema: 'medgit.formulary/1',
          items: [
            {
              id: 'aspirin-tab',
              ingredient: 'Aspirin',
              display: 'Aspirin 75mg tablet',
              form: 'tablet',
              route: 'oral',
              canonicalUnit: 'mg',
              strengths: [[75]],
              aliases: ['Aspirin'],
            },
          ],
        },
        scenarios: {
          test: {
            schema: 'medgit.scenario/1',
            syntheticNotice: 'Test data',
            sources: [
              { id: 'hospital', items: [] },
              { id: 'gp', items: [] },
            ],
            expected: { conflicts: [], clean: [] },
          },
        },
        vectors: {
          canonical: [
            {
              name: 'test',
              canonical: '{"test":true}',
              sha256:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
          ],
        },
      });
      const result = runValidation(tempDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('passed');
    });
  });
});
