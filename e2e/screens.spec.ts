/**
 * Screenshot matrix for review. Written to e2e/__screens__ (git-ignored).
 * The 1440x900 light Start, Reconcile (before, midway, after) and History shots come from hero.spec.ts.
 * Validates: review-ui 17.3, 15.4
 */
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const [w, h] of [
    [1024, 768],
    [390, 844],
  ] as const) {
    test(`Reconcile at ${w}x${h} in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('./');
      await page.getByTestId('scenario-open-hero').click();
      await expect(page.getByTestId('counter-open')).toHaveText('6 to decide');
      await page.screenshot({ path: `e2e/__screens__/reconcile-${w}-${theme}.png`, fullPage: true });
    });
  }
  test(`History at 1440x900 in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('./');
    await page.getByTestId('scenario-open-hero').click();
    await page.getByTestId('nav-history').click();
    await expect(page.getByTestId('chain-status')).toHaveText('Chain verified');
    await page.screenshot({ path: `e2e/__screens__/history-1440-${theme}.png`, fullPage: true });
  });
}
