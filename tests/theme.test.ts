/**
 * Unit tests for theme management utilities.
 * Tests storage operations, validation, and error handling.
 * 
 * Validates: project-bootstrap 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  type Theme,
  STORAGE_KEY,
  isValidTheme,
  readThemeFromStorage,
  writeThemeToStorage,
} from '../src/ui/state/theme';

// Mock localStorage for testing
class MockStorage {
  private store: Record<string, string> = {};
  private shouldThrow = false;

  getItem(key: string): string | null {
    if (this.shouldThrow) {
      throw new Error('SecurityError: localStorage access denied');
    }
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrow) {
      throw new Error('QuotaExceededError: localStorage quota exceeded');
    }
    this.store[key] = value;
  }

  clear(): void {
    this.store = {};
  }

  setShouldThrow(value: boolean): void {
    this.shouldThrow = value;
  }
}

describe('Theme utilities', () => {
  let mockStorage: MockStorage;
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    mockStorage = new MockStorage();
    originalLocalStorage = global.localStorage;
    global.localStorage = mockStorage as unknown as Storage;
  });

  afterEach(() => {
    if (originalLocalStorage) {
      global.localStorage = originalLocalStorage;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).localStorage;
    }
  });

  describe('isValidTheme', () => {
    it('accepts "system"', () => {
      expect(isValidTheme('system')).toBe(true);
    });

    it('accepts "light"', () => {
      expect(isValidTheme('light')).toBe(true);
    });

    it('accepts "dark"', () => {
      expect(isValidTheme('dark')).toBe(true);
    });

    it('rejects null', () => {
      expect(isValidTheme(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isValidTheme(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidTheme('')).toBe(false);
    });

    it('rejects numbers', () => {
      expect(isValidTheme(0)).toBe(false);
      expect(isValidTheme(1)).toBe(false);
    });

    it('rejects objects', () => {
      expect(isValidTheme({})).toBe(false);
      expect(isValidTheme({ theme: 'light' })).toBe(false);
    });

    it('rejects arrays', () => {
      expect(isValidTheme([])).toBe(false);
      expect(isValidTheme(['light'])).toBe(false);
    });

    it('rejects similar strings with different case', () => {
      expect(isValidTheme('System')).toBe(false);
      expect(isValidTheme('LIGHT')).toBe(false);
      expect(isValidTheme('Dark')).toBe(false);
    });

    it('rejects similar strings with whitespace', () => {
      expect(isValidTheme(' system')).toBe(false);
      expect(isValidTheme('light ')).toBe(false);
      expect(isValidTheme(' dark ')).toBe(false);
    });

    it('rejects other strings', () => {
      expect(isValidTheme('invalid')).toBe(false);
      expect(isValidTheme('theme')).toBe(false);
      expect(isValidTheme('auto')).toBe(false);
    });
  });

  describe('readThemeFromStorage', () => {
    it('returns "system" from storage', () => {
      mockStorage.setItem(STORAGE_KEY, 'system');
      expect(readThemeFromStorage()).toBe('system');
    });

    it('returns "light" from storage', () => {
      mockStorage.setItem(STORAGE_KEY, 'light');
      expect(readThemeFromStorage()).toBe('light');
    });

    it('returns "dark" from storage', () => {
      mockStorage.setItem(STORAGE_KEY, 'dark');
      expect(readThemeFromStorage()).toBe('dark');
    });

    it('returns null when storage is empty', () => {
      expect(readThemeFromStorage()).toBe(null);
    });

    it('returns null for invalid stored value', () => {
      mockStorage.setItem(STORAGE_KEY, 'invalid');
      expect(readThemeFromStorage()).toBe(null);
    });

    it('returns null for empty string', () => {
      mockStorage.setItem(STORAGE_KEY, '');
      expect(readThemeFromStorage()).toBe(null);
    });

    it('returns null when storage.getItem throws', () => {
      mockStorage.setShouldThrow(true);
      expect(readThemeFromStorage()).toBe(null);
    });

    it('returns null when localStorage is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).localStorage;
      expect(readThemeFromStorage()).toBe(null);
    });

    it('uses exact storage key', () => {
      expect(STORAGE_KEY).toBe('medgit.theme');
      mockStorage.setItem('medgit.theme', 'dark');
      expect(readThemeFromStorage()).toBe('dark');
    });
  });

  describe('writeThemeToStorage', () => {
    it('writes "system" to storage', () => {
      const result = writeThemeToStorage('system');
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEY)).toBe('system');
    });

    it('writes "light" to storage', () => {
      const result = writeThemeToStorage('light');
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEY)).toBe('light');
    });

    it('writes "dark" to storage', () => {
      const result = writeThemeToStorage('dark');
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEY)).toBe('dark');
    });

    it('overwrites existing value', () => {
      mockStorage.setItem(STORAGE_KEY, 'light');
      writeThemeToStorage('dark');
      expect(mockStorage.getItem(STORAGE_KEY)).toBe('dark');
    });

    it('returns false when storage.setItem throws', () => {
      mockStorage.setShouldThrow(true);
      const result = writeThemeToStorage('light');
      expect(result).toBe(false);
    });

    it('returns false when localStorage is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (global as any).localStorage;
      const result = writeThemeToStorage('dark');
      expect(result).toBe(false);
    });

    it('uses exact storage key', () => {
      writeThemeToStorage('light');
      expect(mockStorage.getItem('medgit.theme')).toBe('light');
    });
  });

  describe('storage error scenarios', () => {
    it('handles SecurityError on read gracefully', () => {
      mockStorage.setShouldThrow(true);
      const result = readThemeFromStorage();
      expect(result).toBe(null);
    });

    it('handles QuotaExceededError on write gracefully', () => {
      mockStorage.setShouldThrow(true);
      const result = writeThemeToStorage('dark');
      expect(result).toBe(false);
    });

    it('handles read error followed by successful write', () => {
      mockStorage.setShouldThrow(true);
      expect(readThemeFromStorage()).toBe(null);
      
      mockStorage.setShouldThrow(false);
      expect(writeThemeToStorage('light')).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEY)).toBe('light');
    });

    it('handles write error followed by successful read', () => {
      mockStorage.setItem(STORAGE_KEY, 'dark');
      
      mockStorage.setShouldThrow(true);
      expect(writeThemeToStorage('light')).toBe(false);
      
      mockStorage.setShouldThrow(false);
      expect(readThemeFromStorage()).toBe('dark'); // Old value still there
    });
  });

  describe('theme value consistency', () => {
    const validThemes: Theme[] = ['system', 'light', 'dark'];

    it('all valid themes can be written and read', () => {
      for (const theme of validThemes) {
        mockStorage.clear();
        writeThemeToStorage(theme);
        expect(readThemeFromStorage()).toBe(theme);
      }
    });

    it('validates all theme constants are covered', () => {
      // Ensure we test all three valid themes
      expect(validThemes).toHaveLength(3);
      expect(validThemes).toContain('system');
      expect(validThemes).toContain('light');
      expect(validThemes).toContain('dark');
    });
  });
});
