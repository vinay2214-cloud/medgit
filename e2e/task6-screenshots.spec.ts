/**
 * Screenshot tests for Task 6: Application Shell
 * Captures screenshots at required viewports in both themes.
 */

import { test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const themes = ['light', 'dark'] as const;

test.describe('Task 6: Screenshots', () => {
  for (const theme of themes) {
    for (const viewport of viewports) {
      test(`captures ${viewport.name} in ${theme} theme`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');

        // Set theme
        await page.evaluate((t) => {
          localStorage.setItem('medgit.theme', t);
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.reload();

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);

        // Take screenshot
        await page.screenshot({
          path: `e2e/screenshots/task6-appshell-${viewport.name}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }
});
