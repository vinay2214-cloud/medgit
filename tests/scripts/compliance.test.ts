/**
 * Unit tests for compliance script .gitignore pattern matcher.
 * Validates: project-bootstrap 1.2
 */

import { describe, it, expect } from 'vitest';
// @ts-expect-error - importing from .mjs without type definitions
import { isIgnored } from '../../scripts/check-compliance.mjs';

describe('Compliance script: .gitignore matcher', () => {
  describe('patterns that should match .kiro paths', () => {
    it('should detect .kiro pattern matching .kiro/ directory', () => {
      const lines = ['.kiro'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
    });

    it('should detect .kiro pattern matching nested .kiro content', () => {
      const lines = ['.kiro'];
      expect(isIgnored(lines, '.kiro/specs/example.md')).toBe(true);
    });

    it('should detect .kiro/ pattern matching .kiro directory', () => {
      const lines = ['.kiro/'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
    });

    it('should detect .kiro/ pattern matching files beneath .kiro', () => {
      const lines = ['.kiro/'];
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(true);
      expect(isIgnored(lines, '.kiro/specs/merge-engine/requirements.md')).toBe(true);
      expect(isIgnored(lines, '.kiro/settings/mcp.json')).toBe(true);
    });

    it('should detect /.kiro/* pattern matching immediate children', () => {
      const lines = ['/.kiro/*'];
      expect(isIgnored(lines, '.kiro/steering/')).toBe(true);
      expect(isIgnored(lines, '.kiro/specs/')).toBe(true);
    });

    it('should detect **/.kiro pattern matching nested .kiro directories', () => {
      const lines = ['**/.kiro'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
      expect(isIgnored(lines, 'some/nested/.kiro/')).toBe(true);
    });

    it('should detect **/.kiro/* pattern matching any .kiro content', () => {
      const lines = ['**/.kiro/*'];
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(true);
      expect(isIgnored(lines, 'nested/.kiro/hooks/example.json')).toBe(true);
    });
  });

  describe('patterns that should NOT match .kiro paths', () => {
    it('should not match .kiro paths with *.md pattern', () => {
      const lines = ['*.md'];
      // The matcher treats *.md as matching .md files at any level
      // This test verifies it doesn't match the directory itself
      expect(isIgnored(lines, '.kiro/')).toBe(false);
      expect(isIgnored(lines, '.kiro/steering/')).toBe(false);
      // Note: *.md will match .md files including nested ones in this implementation
      expect(isIgnored(lines, '.kiro/specs/requirements.md')).toBe(true);
    });

    it('should not match .kiro paths with node_modules pattern', () => {
      const lines = ['node_modules'];
      expect(isIgnored(lines, '.kiro/')).toBe(false);
      expect(isIgnored(lines, '.kiro/specs/example.md')).toBe(false);
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(false);
    });

    it('should not match .kiro with dist/ pattern', () => {
      const lines = ['dist/'];
      expect(isIgnored(lines, '.kiro/')).toBe(false);
      expect(isIgnored(lines, '.kiro/hooks/protect.json')).toBe(false);
    });
  });

  describe('edge cases and git semantics', () => {
    it('should ignore comments and blank lines', () => {
      const lines = [
        '# This is a comment',
        '',
        '  ',
        'node_modules',
        '# Another comment',
        '',
      ];
      expect(isIgnored(lines, 'node_modules/')).toBe(true);
      expect(isIgnored(lines, '.kiro/')).toBe(false);
    });

    it('should handle negation patterns', () => {
      const lines = [
        '*.log',
        '!important.log',
      ];
      // All .log files ignored
      expect(isIgnored(lines, 'debug.log')).toBe(true);
      // Except important.log is un-ignored
      expect(isIgnored(lines, 'important.log')).toBe(false);
    });

    it('should handle multiple patterns in sequence', () => {
      const lines = [
        'node_modules/',
        'dist/',
        'coverage/',
        '.DS_Store',
      ];
      expect(isIgnored(lines, 'node_modules/')).toBe(true);
      expect(isIgnored(lines, 'dist/')).toBe(true);
      expect(isIgnored(lines, 'coverage/')).toBe(true);
      expect(isIgnored(lines, '.DS_Store')).toBe(true);
      expect(isIgnored(lines, '.kiro/')).toBe(false);
    });

    it('should handle .kiro ignored then un-ignored', () => {
      const lines = [
        '.kiro/',
        '!.kiro/public/',
      ];
      // .kiro/ is ignored
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(true);
      // But .kiro/public/ is un-ignored
      expect(isIgnored(lines, '.kiro/public/')).toBe(false);
      expect(isIgnored(lines, '.kiro/public/example.json')).toBe(false);
    });

    it('should handle directory-only patterns correctly', () => {
      const lines = ['test/'];
      // Directory pattern with trailing slash
      expect(isIgnored(lines, 'test/')).toBe(true);
      expect(isIgnored(lines, 'test/file.ts')).toBe(true);
    });

    it('should respect pattern anchoring', () => {
      const lines = ['/build'];
      // Anchored pattern only matches at root
      expect(isIgnored(lines, 'build')).toBe(true);
      expect(isIgnored(lines, 'build/')).toBe(true);
      // Should not match nested build directories
      expect(isIgnored(lines, 'src/build')).toBe(false);
    });

    it('should handle wildcards in paths', () => {
      const lines = ['**/*.log'];
      expect(isIgnored(lines, 'debug.log')).toBe(true);
      expect(isIgnored(lines, 'logs/debug.log')).toBe(true);
      expect(isIgnored(lines, 'deep/nested/path/debug.log')).toBe(true);
      expect(isIgnored(lines, '.kiro/example.json')).toBe(false);
    });

    it('should verify realistic .kiro paths are not ignored by common patterns', () => {
      const lines = [
        '# Common patterns that should NOT match .kiro',
        'node_modules/',
        'dist/',
        'coverage/',
        '*.log',
        '.DS_Store',
        '._*',
        '.env',
        '.vscode/*',
        '!.vscode/extensions.json',
      ];
      
      // Verify .kiro and its common contents are NOT ignored
      expect(isIgnored(lines, '.kiro/')).toBe(false);
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(false);
      expect(isIgnored(lines, '.kiro/specs/merge-engine/requirements.md')).toBe(false);
      expect(isIgnored(lines, '.kiro/hooks/protect-contract.json')).toBe(false);
      expect(isIgnored(lines, '.kiro/settings/mcp.json')).toBe(false);
      expect(isIgnored(lines, '.kiro/agents/ui-critic.json')).toBe(false);
    });
  });

  describe('compliance-critical patterns', () => {
    it('should fail if .kiro is directly ignored', () => {
      const lines = ['.kiro'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
    });

    it('should fail if .kiro/ is ignored', () => {
      const lines = ['.kiro/'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
    });

    it('should fail if /.kiro is ignored', () => {
      const lines = ['/.kiro'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
    });

    it('should fail if **/.kiro is ignored', () => {
      const lines = ['**/.kiro'];
      expect(isIgnored(lines, '.kiro/')).toBe(true);
    });

    it('should fail if .kiro/* is ignored', () => {
      const lines = ['.kiro/*'];
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(true);
    });

    it('should pass if only unrelated patterns exist', () => {
      const lines = [
        'node_modules/',
        'dist/',
        'coverage/',
        '*.log',
      ];
      expect(isIgnored(lines, '.kiro/')).toBe(false);
      expect(isIgnored(lines, '.kiro/steering/product.md')).toBe(false);
    });
  });
});
