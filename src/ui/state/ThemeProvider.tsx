/**
 * ThemeProvider: React Context Provider for theme management.
 * Manages theme state, persistence, and DOM updates.
 * 
 * Validates: project-bootstrap 3.3, 3.4
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  type Theme,
  type ThemeContextValue,
  readThemeFromStorage,
  writeThemeToStorage,
  applyThemeToDOM,
} from './theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize from storage or default to 'system'
  const [theme, setThemeState] = useState<Theme>(() => {
    return readThemeFromStorage() ?? 'system';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    writeThemeToStorage(newTheme);
    applyThemeToDOM(newTheme);
  };

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context.
 * Must be used within ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
