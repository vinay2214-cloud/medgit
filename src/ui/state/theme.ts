/**
 * Theme management utilities.
 * Pure functions for storage, validation, and DOM manipulation.
 * 
 * Validates: project-bootstrap 3.3, 3.4
 */

export type Theme = 'system' | 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const STORAGE_KEY = 'medgit.theme' as const;

/**
 * Type guard: validates that a value is a valid theme string.
 */
export function isValidTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Reads theme from localStorage with error handling.
 * Returns null if storage is unavailable, throws, or contains invalid value.
 */
export function readThemeFromStorage(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) {
      return stored;
    }
    return null;
  } catch {
    // Storage unavailable (private browsing, SecurityError, etc.)
    return null;
  }
}

/**
 * Writes theme to localStorage with error handling.
 * Returns true if successful, false if storage throws or is unavailable.
 */
export function writeThemeToStorage(theme: Theme): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    return true;
  } catch {
    // Storage unavailable (QuotaExceededError, SecurityError, etc.)
    return false;
  }
}

/**
 * Applies theme to DOM by setting or removing data-theme attribute.
 * - 'light' or 'dark': sets data-theme attribute
 * - 'system': removes data-theme attribute (media query handles preference)
 */
export function applyThemeToDOM(theme: Theme): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = theme;
  }
}
