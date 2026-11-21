/**
 * Behaviour of the review screens beyond the hero flow.
 */
import { expect, test, type Page } from '@playwright/test';

async function openHero(page: Page) {
  await page.goto('./');
  await page.getByTestId('scenario-open-hero').click();
  await expect(page.getByTestId('counter-open')).toHaveText('6 to decide');
}

async function decide(page: Page, row: string, option: string, reason = 'CLINICAL_JUDGEMENT') {
  await page.getByTestId(`row-${row}`).click();
  await page.getByTestId(option).click();
  await page.getByTestId('reason-select').selectOption(reason);
  await page.getByTestId('apply').click();
}

test.describe('wide layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Validates: review-ui 1.1, 1.2, 1.4, 1.5
  test('Start lists Hero, Clean and Messy with counts and the notice; Hero has focus', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('h1')).toHaveText('Reconcile medicine lists');
    await expect(page.getByText('Compare lists from every source, decide each difference, and sign off with a record.')).toBeVisible();
    const titles = await page.locator('main h2').allInnerTexts();
    expect(titles).toEqual(['After a hospital stay: four lists, six discrepancies', 'Routine review: everyone agrees', 'Messy lists: brands, units and unknown items']);
    await expect(page.getByText('Sample Patient A. 4 sources. 8 medicines.')).toBeVisible();
    await expect(page.getByText('SYNTHETIC DATA. Invented for a software demonstration.')).toBeVisible();
    await expect(page.getByTestId('scenario-open-hero')).toBeFocused();
  });

  // Validates: review-ui 3.1, 4.1, 4.2, 4.4, 4.9, 5.5
  test('the chart has one column per source in id order, values per cell, and seams only under conflict rows', async ({ page }) => {
    await openHero(page);
    const heads = page.locator('[data-testid^="source-head-"]');
    await expect(heads).toHaveCount(4);
    expect(await heads.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual(['source-head-gp', 'source-head-hospital', 'source-head-patient', 'source-head-pharmacy']);
    await expect(page.getByTestId('source-head-hospital')).toContainText('as of 14 Nov 2026');
    await expect(page.getByTestId('cell-metformin-tab-patient')).toHaveText('500 mg1 / day');
    await expect(page.getByTestId('cell-aspirin-tab-gp')).toContainText('stopped');
    await expect(page.getByTestId('cell-salbutamol-inhaler-gp')).toHaveText('Not listed');
    await expect(page.getByTestId('row-atorvastatin-tab')).toContainText('Agreed by all');
    // 6 conflict rows have a seam, 3 agreed rows do not
    await expect(page.locator('[role="row"] .seam')).toHaveCount(6);
    await expect(page.getByTestId('row-atorvastatin-tab').locator('.seam')).toHaveCount(0);
    for (const id of ['counter-open', 'counter-escalated', 'counter-agreed']) await expect(page.getByTestId(id).locator('svg')).toHaveCount(1);
    // rows are ordered by display name
    const names = await page.locator('[role="row"][data-testid^="row-"] [role="gridcell"]:first-child').allInnerTexts();
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  });

  // Validates: review-ui 5.2, 5.6
  test('deciding closes the seam (dashed to solid) and nothing animates while idle', async ({ page }) => {
    await openHero(page);
    const seam = page.getByTestId('row-metformin-tab').locator('.seam');
    await expect(seam).toHaveAttribute('data-state', 'open');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await decide(page, 'metformin-tab', 'option-choose-hospital', 'CONFIRMED_WITH_PATIENT');
    await expect(seam).toHaveAttribute('data-state', 'resolved');
    await expect.poll(() => seam.locator('line').evaluate((l) => getComputedStyle(l).strokeDasharray)).toMatch(/^12(px)?,?\s+0(px)?$/);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  });

  // Validates: review-ui 5.3
  test('with reduced motion the seam changes state immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHero(page);
    await decide(page, 'metformin-tab', 'option-choose-hospital');
    const line = page.getByTestId('row-metformin-tab').locator('.seam line');
    expect(await line.evaluate((l) => getComputedStyle(l).transitionDuration)).toMatch(/^0s/);
  });

  // Validates: review-ui 3.3, 14.5
  test('decisions, role changes and the counter are announced in the polite live region', async ({ page }) => {
    await openHero(page);
    const live = page.locator('[role="status"][aria-live="polite"]');
    await decide(page, 'metformin-tab', 'option-choose-hospital');
    await expect(live).toHaveText('Metformin tablet: Frequency decided. 5 to decide.');
    await page.getByTestId('role-pharmacist').click();
    await expect(live).toHaveText('Role: Pharmacist');
  });

  // Validates: review-ui 3.4, 3.5, 10.1, 10.2, 10.3
  test('filters change the rows not the counters; the markers view shows git-style blocks and selects conflicts', async ({ page }) => {
    await openHero(page);
    await decide(page, 'metformin-tab', 'option-choose-hospital');
    await page.getByTestId('filter-resolved').click();
    await expect(page.locator('[role="row"][data-testid^="row-"]')).toHaveCount(1);
    await expect(page.getByTestId('counter-open')).toHaveText('5 to decide');
    await page.getByTestId('filter-open').click();
    await expect(page.locator('[role="row"][data-testid^="row-"]')).toHaveCount(5);
    await page.getByTestId('filter-all').click();

    await page.getByTestId('view-markers').click();
    const block = page.getByTestId('marker-paracetamol-tab::DOSE');
    await expect(block.locator('pre')).toHaveText('paracetamol-tab  DOSE\n<<<<<<< gp, hospital, pharmacy\n500 mg\n=======\n650 mg\n>>>>>>> patient\n');
    await expect(block).toContainText('To decide');
    await expect(page.getByTestId('marker-metformin-tab::FREQUENCY')).toContainText('Decided');
    await block.click();
    await expect(page.getByTestId('strip')).toHaveAttribute('data-conflict', 'paracetamol-tab::DOSE');
    // the choice persists while the case is open
    await page.getByTestId('nav-history').click();
    await page.getByTestId('nav-reconcile').click();
    await expect(page.getByTestId('view-markers')).toHaveAttribute('data-state', 'on');
  });

  // Validates: review-ui 6.11, 7.1, 7.2, 7.3
  test('a multi-conflict medicine shows tabs; the reconciled list shows provenance, waiting lines and left-off count', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('scenario-open-messy').click();
    await page.getByTestId('row-paracetamol-tab').click();
    await expect(page.getByTestId('strip-tab-OMISSION')).toBeVisible();
    await expect(page.getByTestId('strip-tab-DOSE')).toBeVisible();
    await expect(page.getByTestId('strip-tab-FREQUENCY')).toBeVisible();
    await page.getByTestId('option-exclude').click();
    await page.getByTestId('reason-select').selectOption('CONFIRMED_WITH_PATIENT');
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('row-paracetamol-tab')).toContainText('Left off the list');
    await expect(page.getByTestId('merged-excluded')).toHaveText('1 left off by decision');
    await expect(page.getByTestId('merged-waiting-metformin-tab')).toHaveText('Waiting: Metformin tablet');
    await expect(page.getByTestId('merged-waiting-metformin-tab')).not.toContainText('mg');
    await expect(page.getByTestId('merged-line-cotrimoxazole-tab')).toContainText('Agreed by all');

    await page.getByTestId('row-metformin-tab').click();
    await page.getByTestId('option-custom').click();
    await page.getByTestId('custom-strength').fill('1000');
    await page.getByTestId('reason-select').selectOption('VERIFIED_WITH_PRESCRIBER');
    await page.getByTestId('apply').click();
    await expect(page.getByTestId('merged-line-metformin-tab')).toContainText('Entered by hand');
    await expect(page.getByTestId('merged-sub')).toHaveText('2 medicines decided, 3 waiting');
  });

  // Validates: review-ui 4.10, 12.1, 12.3
  test('Messy shows Unreadable cells and a problems panel that cannot be dismissed', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('scenario-open-messy').click();
    await expect(page.getByTestId('cell-metformin-tab-hospital')).toContainText('Unreadable');
    const panel = page.getByTestId('problems-panel');
    await expect(panel).toBeVisible();
    await page.getByTestId('cell-metformin-tab-hospital').getByRole('button', { name: 'See problems' }).click();
    await expect(panel).toHaveAttribute('open', '');
    await expect(panel).toContainText("Could not recognise 'Ashwagandha churna'. It is kept as written and compared by name.");
    await expect(panel).toContainText("Could not read the frequency 'as directed'.");
    await expect(panel.getByRole('button')).toHaveCount(0);
  });

  // Validates: review-ui 12.2
  test('Hero and Clean have no problems panel; Clean has nothing to decide and can be signed off at once', async ({ page }) => {
    await openHero(page);
    await expect(page.getByTestId('problems-panel')).toHaveCount(0);
    await page.getByTestId('nav-start').click();
    await page.getByTestId('scenario-open-clean').click();
    await expect(page.getByTestId('problems-panel')).toHaveCount(0);
    await expect(page.getByTestId('no-conflicts')).toHaveText('All sources agree. Nothing to decide.');
    await page.getByTestId('commit-message').fill('Routine review');
    await page.getByTestId('sign-off').click();
    await expect(page.getByTestId('commit-id')).toBeVisible();
  });

  // Validates: review-ui 9.3, 9.4, 9.5
  test('History shows changes, list with last changed, and decisions with manual labels; ids are monospace', async ({ page }) => {
    await openHero(page);
    await decide(page, 'metformin-tab', 'option-choose-hospital', 'CONFIRMED_WITH_PATIENT');
    await page.getByTestId('row-amlodipine-tab').click();
    await page.getByTestId('option-custom').click();
    await page.getByTestId('custom-strength').fill('5');
    await page.getByTestId('reason-select').selectOption('PER_DISPENSING_RECORD');
    await page.getByTestId('apply').click();
    await decide(page, 'aspirin-tab', 'option-choose-gp');
    await decide(page, 'cotrimoxazole-tab', 'option-include');
    await decide(page, 'paracetamol-tab', 'option-choose-hospital');
    await decide(page, 'salbutamol-inhaler', 'option-include');
    await page.getByTestId('commit-message').fill('Sign off');
    await page.getByTestId('sign-off').click();
    await page.getByTestId('history-link').click();
    await page.getByTestId('tab-decisions').click();
    await expect(page.getByTestId('decision-amlodipine-tab::DOSE')).toContainText('Entered by hand');
    await expect(page.getByTestId('decision-metformin-tab::FREQUENCY')).toContainText('Confirmed with patient');
    await page.getByTestId('log-item-2').click();
    await page.getByTestId('tab-changes').click();
    await expect(page.getByTestId('changes-panel')).toContainText('Metformin tablet');
    expect(await page.getByTestId('log-item-0').locator('code').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Atkinson Hyperlegible Mono');
  });

  // Validates: review-ui 15.1, 15.2, 15.3
  test('role and theme controls are labelled; the role tooltip explains it is not sign-in', async ({ page }) => {
    await openHero(page);
    await expect(page.getByRole('radiogroup', { name: 'Role' })).toBeVisible();
    await page.getByTestId('role-pharmacist').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Switches who is deciding. Escalated items need a pharmacist.');
    await expect(page.getByTestId('theme-menu')).toHaveAccessibleName(/Theme/);
    await page.getByTestId('row-amlodipine-tab').click();
    await page.getByTestId('escalate').click();
    await page.getByTestId('role-clinician').click();
    await page.getByTestId('row-amlodipine-tab').click();
    await expect(page.getByTestId('apply')).toBeDisabled();
    await page.getByTestId('role-pharmacist').click();
    await expect(page.getByTestId('waiting')).toHaveCount(0);
  });

  // Validates: review-ui 14.4
  test('every form control in the strip and commit panel has a visible label', async ({ page }) => {
    await openHero(page);
    await page.getByTestId('option-custom').click();
    for (const el of await page.locator('main select, main textarea, main input:not([type=file])').all()) {
      const id = await el.getAttribute('id');
      expect(id).not.toBeNull();
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
    }
  });
});

test.describe('medium layout (drawer)', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  // Validates: review-ui 13.2
  test('selecting a row opens a right drawer with focus inside; Escape closes it and returns focus to the row', async ({ page }) => {
    await openHero(page);
    await page.getByTestId('row-metformin-tab').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('strip')).toHaveAttribute('data-conflict', 'metformin-tab::FREQUENCY');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('row-metformin-tab')).toBeFocused();
    // only one strip exists
    await page.getByTestId('row-metformin-tab').click();
    await expect(page.getByTestId('strip')).toHaveCount(1);
  });
});

test.describe('narrow layout (cards and bottom sheet)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  // Validates: review-ui 13.3
  test('medicines are cards; the strip opens as a bottom sheet; the commit panel is sticky', async ({ page }) => {
    await openHero(page);
    await expect(page.getByTestId('chart-cards')).toBeVisible();
    await expect(page.getByRole('grid')).toHaveCount(0);
    await page.getByTestId('row-metformin-tab').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(830);
    await page.keyboard.press('Escape');
    expect(await page.getByTestId('commit-panel').evaluate((e) => getComputedStyle(e).position)).toBe('sticky');
  });

  // Validates: review-ui 14.6
  test('interactive targets are at least 40 by 40 CSS pixels', async ({ page }) => {
    await openHero(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, a[href], select, textarea, label:has(> [role="radio"])')]
        .filter((e) => e.offsetParent !== null && !e.closest('.sr-only') && e.tabIndex !== -1)
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 40 || r.height < 40))
        .map(({ e, r }) => `${e.tagName} "${(e.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(small).toEqual([]);
  });
});

// Validates: review-ui 13.1, 13.4
for (const width of [360, 390, 768, 1024, 1280, 1440, 1920]) {
  test(`no horizontal scrolling at ${width}px on Start, Reconcile and History`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openHero(page);
    if (width >= 1280) await expect(page.locator('aside').getByTestId('strip')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByTestId('nav-history').click({ trial: false }); // fails if anything overlaps the nav
    await expect(page).toHaveURL(/#\/history$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByTestId('nav-start').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}
