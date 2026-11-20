/**
 * E2E tests for Task 6: Application Shell
 * Tests AppShell, SyntheticChip, LiveRegion, skip link, and footer.
 */

import { test, expect } from '@playwright/test';

test.describe('Application Shell', () => {
  test('renders synthetic chip and footer', async ({ page }) => {
    await page.goto('/');

    // Check synthetic chip is visible
    const chip = page.getByText('Synthetic data').first();
    await expect(chip).toBeVisible();

    // Check footer text
    const footer = page.getByText('Synthetic data. Not for clinical use.');
    await expect(footer).toBeVisible();
  });

  test('renders MedGit header mark', async ({ page }) => {
    await page.goto('/');

    const heading = page.getByRole('heading', { name: 'MedGit' });
    await expect(heading).toBeVisible();
  });

  test('skip link is hidden but focusable', async ({ page }) => {
    await page.goto('/');

    // Skip link should be in DOM but visually hidden
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeAttached();

    // Focus the skip link (Tab key)
    await page.keyboard.press('Tab');

    // When focused, it should be visible
    await expect(skipLink).toBeVisible();

    // Verify it links to #main
    await expect(skipLink).toHaveAttribute('href', '#main');
  });

  test('main content area has correct id', async ({ page }) => {
    await page.goto('/');

    // Main element should have id="main" for skip link target
    const main = page.locator('main#main');
    await expect(main).toBeAttached();
  });

  test('has polite live region for announcements', async ({ page }) => {
    await page.goto('/');

    // Live region should exist with correct ARIA attributes
    const liveRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(liveRegion).toBeAttached();
  });

  test.describe('Responsive layout', () => {
    const viewports = [
      { name: 'Desktop', width: 1440, height: 900 },
      { name: 'Tablet', width: 1024, height: 768 },
      { name: 'Mobile', width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      test(`renders correctly at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');

        // Synthetic chip should always be visible
        const chip = page.getByText('Synthetic data').first();
        await expect(chip).toBeVisible();

        // Footer should always be visible
        const footer = page.getByText('Synthetic data. Not for clinical use.');
        await expect(footer).toBeVisible();

        // Header mark should be visible
        const heading = page.getByRole('heading', { name: 'MedGit' });
        await expect(heading).toBeVisible();
      });
    }
  });

  test.describe('Theme application', () => {
    test('applies light theme correctly', async ({ page }) => {
      await page.goto('/');

      // Set light theme in storage
      await page.evaluate(() => {
        localStorage.setItem('medgit.theme', 'light');
      });
      await page.reload();

      // Check data-theme attribute
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', 'light');
    });

    test('applies dark theme correctly', async ({ page }) => {
      await page.goto('/');

      // Set dark theme in storage
      await page.evaluate(() => {
        localStorage.setItem('medgit.theme', 'dark');
      });
      await page.reload();

      // Check data-theme attribute
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', 'dark');
    });

    test('handles system theme (no data-theme attribute)', async ({ page }) => {
      await page.goto('/');

      // Clear storage to get system theme
      await page.evaluate(() => {
        localStorage.removeItem('medgit.theme');
      });
      await page.reload();

      // Should not have data-theme attribute for system
      const html = page.locator('html');
      const dataTheme = await html.getAttribute('data-theme');
      expect(dataTheme).toBeNull();
    });
  });

  test.describe('Accessibility', () => {
    test('has visible focus indicators', async ({ page }) => {
      await page.goto('/');

      // Tab to skip link and verify focus styling
      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: /skip to main content/i });

      // Should have focus-visible ring
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
    });

    test('maintains focus order', async ({ page }) => {
      await page.goto('/');

      // First tab should focus skip link
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.textContent);
      expect(focused).toContain('Skip to main');

      // Subsequent tabs should move through interactive elements in order
      // (This is a basic check - detailed tab order will be tested in review-ui)
    });
  });
});
