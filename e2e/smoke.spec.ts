/**
 * Smoke test: shell, theme control, no cross-origin requests, type scale present.
 * Validates: project-bootstrap 3.5, 3.3, 4.3, review-ui 16.3
 */
import { expect, test } from '@playwright/test';

test('chip and footer are visible, the theme menu switches theme, and no request leaves the origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && u.origin !== origin) foreign.push(r.url());
  });

  await page.goto('./');
  await expect(page.getByText('Synthetic data', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic data. Not for clinical use.')).toBeVisible();

  await page.getByTestId('theme-menu').click();
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-menu').click();
  await page.getByTestId('theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('theme-menu').click();
  await page.getByTestId('theme-system').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

  // exercise the whole app so lazily requested assets (fonts) are included
  await page.getByTestId('scenario-open-hero').click();
  await page.getByTestId('nav-history').click();
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
});

// Regression: the Tailwind v4 type scale must exist (text-* utilities were silently missing before).
test('the type scale is applied', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toHaveCSS('font-size', '36px');
  await page.getByTestId('scenario-open-hero').click();
  await expect(page.locator('h1')).toHaveCSS('font-size', '22px');
});

test('a view that needs a case falls back to Start when none is open', async ({ page }) => {
  // Validates: review-ui 2.6
  await page.goto('./#/history');
  await expect(page.locator('h1')).toHaveText('Reconcile medicine lists');
  await expect(page).toHaveURL(/#\/start$/);
});

// Regression: the deployed site logged a 404 for the missing favicon. No console errors anywhere in the flow.
test('no console errors from load to history', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByTestId('scenario-open-hero').click();
  await page.getByTestId('row-metformin-tab').click();
  await page.getByTestId('nav-history').click();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
  // the icon is served
  const icon = await page.request.get(new URL('favicon.svg', page.url()).toString());
  expect(icon.status()).toBe(200);
});
