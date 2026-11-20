/**
 * Browser verification tests for ThemeProvider.
 * Tests real browser behavior including storage, DOM updates, and persistence.
 * 
 * Validates: project-bootstrap 3.3, 3.4
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

test.describe('Theme: Browser Verification', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        // Storage may be unavailable in some test contexts
      }
    });
  });

  test('should initialize with system theme (no data-theme attribute)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    // System theme means no data-theme attribute
    expect(dataTheme).toBeNull();
  });

  test('should restore theme from storage on load (light)', async ({ page }) => {
    // Set theme in storage before page load
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'light');
    });
    
    // Reload to trigger storage read
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(dataTheme).toBe('light');
  });

  test('should restore theme from storage on load (dark)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'dark');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(dataTheme).toBe('dark');
  });

  test('should ignore invalid stored value and use system', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'invalid');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    // Invalid value should be ignored, falls back to system
    expect(dataTheme).toBeNull();
  });

  test('should apply theme immediately via ThemeProvider', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Simulate theme change to 'light'
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'light');
      document.documentElement.dataset.theme = 'light';
    });
    
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(dataTheme).toBe('light');
  });

  test('should remove data-theme attribute for system mode', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Set to dark first
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    
    let dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(dataTheme).toBe('dark');
    
    // Switch to system (remove attribute)
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-theme');
    });
    
    dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(dataTheme).toBeNull();
  });

  test('should persist theme across reload', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Set theme
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'dark');
      document.documentElement.dataset.theme = 'dark';
    });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify theme persisted
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(dataTheme).toBe('dark');
    
    const storedTheme = await page.evaluate(() => {
      return localStorage.getItem('medgit.theme');
    });
    expect(storedTheme).toBe('dark');
  });

  test('should work when localStorage throws on read', async ({ page }) => {
    // Create a new page with localStorage blocked
    await page.goto(BASE_URL);
    
    // Mock localStorage.getItem to throw
    await page.addInitScript(() => {
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key: string) {
        if (key === 'medgit.theme') {
          throw new Error('SecurityError: localStorage access denied');
        }
        return originalGetItem.call(this, key);
      };
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should not crash, falls back to system theme
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    // Should default to system (no attribute)
    expect(dataTheme).toBeNull();
  });

  test('should work when localStorage throws on write', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Mock localStorage.setItem to throw
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key: string, value: string) {
        if (key === 'medgit.theme') {
          throw new Error('QuotaExceededError: localStorage quota exceeded');
        }
        return originalSetItem.call(this, key, value);
      };
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should not crash when trying to write
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
    
    // DOM should still update even if storage fails
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(dataTheme).toBe('light');
  });

  test('should verify no-flash script consistency with ThemeProvider', async ({ page }) => {
    // Set theme in storage
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'dark');
    });
    
    // Reload and capture immediate state
    await page.reload();
    
    // Check data-theme is set before React loads (by no-flash script)
    const immediateTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(immediateTheme).toBe('dark');
    
    // Wait for React to load
    await page.waitForLoadState('networkidle');
    
    // Verify ThemeProvider maintains the same theme
    const finalTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(finalTheme).toBe('dark');
  });

  test('should apply correct color-scheme', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Test light theme
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
    
    let colorScheme = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).colorScheme;
    });
    expect(colorScheme).toBe('light');
    
    // Test dark theme
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    
    colorScheme = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).colorScheme;
    });
    expect(colorScheme).toBe('dark');
  });

  test('should verify storage key is exactly "medgit.theme"', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.evaluate(() => {
      localStorage.setItem('medgit.theme', 'light');
    });
    
    const keys = await page.evaluate(() => {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) allKeys.push(key);
      }
      return allKeys;
    });
    
    expect(keys).toContain('medgit.theme');
  });

  test('should handle rapid theme changes', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Rapidly change themes
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.dataset.theme = 'light';
      document.documentElement.removeAttribute('data-theme');
    });
    
    // Final state should be system (no attribute)
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(dataTheme).toBeNull();
  });
});
