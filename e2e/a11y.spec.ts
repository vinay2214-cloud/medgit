/**
 * Automated accessibility scan of the real screens, both themes, plus keyboard operation of the chart.
 * Validates: review-ui 14.1, 14.2, 14.7, 14.8, 4.6, 4.7, 15.4
 * (14.2: axe's color-contrast rule runs as part of the wcag2aa tags, in both themes.)
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`axe: Start, Reconcile and History in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('./');
    await scan(page, `start-${theme}`);

    await page.getByTestId('scenario-open-hero').click();
    await expect(page.getByTestId('counter-open')).toHaveText('6 to decide');
    await scan(page, `reconcile-${theme}`);

    // a decided row and an escalated row, so every seam and pill state is scanned
    await page.getByTestId('row-metformin-tab').click();
    await page.getByTestId('option-choose-hospital').click();
    await page.getByTestId('reason-select').selectOption('CONFIRMED_WITH_PATIENT');
    await page.getByTestId('apply').click();
    await page.getByTestId('row-amlodipine-tab').click();
    await page.getByTestId('escalate').click();
    await scan(page, `reconcile-midway-${theme}`);

    await page.getByTestId('view-markers').click();
    await scan(page, `markers-${theme}`);

    await page.getByTestId('nav-history').click();
    await scan(page, `history-${theme}`);

    await page.goto('./');
    await page.getByTestId('scenario-open-messy').click();
    await page.getByTestId('problems-panel').locator('summary').click();
    await scan(page, `messy-${theme}`);
  });
}

test('the chart is one tab stop with arrow-key navigation and Enter to select', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.getByTestId('scenario-open-hero').click();
  const rows = page.locator('[role="row"][tabindex]');
  await expect(page.locator('[role="row"][tabindex="0"]')).toHaveCount(1);
  await page.locator('[role="row"][tabindex="0"]').focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('row-salbutamol-inhaler')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(rows.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('row-aspirin-tab')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('strip')).toHaveAttribute('data-conflict', 'aspirin-tab::STATUS');
  await expect(page.locator('[role="row"][tabindex="0"]')).toHaveCount(1);
});

test('a decision can be made with the keyboard only', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.keyboard.press('Enter'); // Hero "Open" has focus on load
  await expect(page.getByTestId('counter-open')).toHaveText('6 to decide');
  await page.locator('[role="row"][tabindex="0"]').focus();
  await page.keyboard.press('Enter'); // amlodipine (first row) DOSE
  await page.getByTestId('option-choose-hospital').focus();
  await page.keyboard.press('Space');
  await page.getByTestId('reason-select').focus();
  await page.keyboard.type('Verified'); // typeahead; ArrowDown opens the picker on macOS instead of changing the value
  await expect(page.getByTestId('reason-select')).toHaveValue('VERIFIED_WITH_PRESCRIBER');
  await page.getByTestId('apply').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('counter-open')).toHaveText('5 to decide');
  // focus moved to the next open row
  await expect(page.getByTestId('row-aspirin-tab')).toBeFocused();
});
