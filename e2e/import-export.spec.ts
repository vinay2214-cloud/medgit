/**
 * Case file round trip in the browser, FHIR export gating, and a corrupted import.
 * Validates: review-ui 11.1, 11.2, 11.3, 11.4
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function decideAllHero(page: Page) {
  const steps: [string, string, string?][] = [
    ['metformin-tab', 'option-choose-hospital'],
    ['amlodipine-tab', 'option-choose-hospital'],
    ['aspirin-tab', 'option-choose-gp'],
    ['cotrimoxazole-tab', 'option-include'],
    ['paracetamol-tab', 'option-choose-hospital'],
    ['salbutamol-inhaler', 'option-include'],
  ];
  for (const [row, option] of steps) {
    await page.getByTestId(`row-${row}`).click();
    await page.getByTestId(option).click();
    await page.getByTestId('reason-select').selectOption('CLINICAL_JUDGEMENT');
    await page.getByTestId('apply').click();
  }
  await expect(page.getByTestId('counter-open')).toHaveText('0 to decide');
}

test.use({ viewport: { width: 1440, height: 900 } });

test('export the case after sign-off, import it again and see the same history', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('scenario-open-hero').click();

  // FHIR export is disabled until a sign-off exists in this session
  await page.getByTestId('export-menu').click();
  await expect(page.getByTestId('export-fhir')).toHaveAttribute('data-disabled', '');
  await expect(page.getByText('Sign off a list first to export a FHIR bundle.')).toBeVisible();
  await page.keyboard.press('Escape');

  await decideAllHero(page);
  await page.getByTestId('commit-message').fill('Reconcile medicines at discharge');
  await page.getByTestId('sign-off').click();
  const shortId = (await page.getByTestId('commit-id').innerText()).trim();

  await page.getByTestId('export-menu').click();
  const [fhir] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-fhir').click()]);
  expect(fhir.suggestedFilename()).toBe(`medgit-fhir-${shortId}.json`);
  const bundle = JSON.parse(readFileSync((await fhir.path()) ?? '', 'utf8')) as { entry: unknown[]; meta: { tag: { code: string }[] } };
  expect(bundle.entry).toHaveLength(9);
  expect(bundle.meta.tag[0]?.code).toBe('synthetic');

  await page.getByTestId('export-menu').click();
  const [caseDl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-case').click()]);
  expect(caseDl.suggestedFilename()).toBe(`medgit-case-hero-${shortId}.json`);
  const casePath = (await caseDl.path()) ?? '';
  expect(readFileSync(casePath, 'utf8')).toContain('SYNTHETIC DATA');

  // reload (state resets) and import
  await page.goto('./');
  await page.reload();
  await page.getByTestId('import-input').setInputFiles(casePath);
  await expect(page).toHaveURL(/#\/reconcile$/);
  await expect(page.getByTestId('counter-open')).toHaveText('0 to decide');
  await page.getByTestId('nav-history').click();
  await expect(page.locator('[data-testid^="log-item-"]')).toHaveCount(3);
  await expect(page.getByTestId('log-item-0').locator('code')).toHaveText(shortId);
  await expect(page.getByTestId('chain-status')).toHaveText('Chain verified');
});

test('a corrupted file shows the copy-deck error with details, and a tampered chain is reported', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('import-input').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"medgit.case/1"') });
  await expect(page.getByTestId('import-error')).toContainText('This file is not a valid MedGit case file.');
  await page.getByTestId('import-error').getByText('Details').click();
  await expect(page.getByTestId('import-error')).toContainText('not valid JSON');

  // a valid file whose second commit was edited after export
  await page.getByTestId('scenario-open-hero').click();
  await page.getByTestId('export-menu').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-case').click()]);
  const file = JSON.parse(readFileSync((await dl.path()) ?? '', 'utf8')) as { history: { message: string }[] };
  const second = file.history[1];
  if (second) second.message = 'Edited after sign-off';
  await page.getByTestId('nav-start').click();
  await page.getByTestId('import-input').setInputFiles({ name: 'tampered.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('chain-status')).toContainText('Chain broken at commit 2');
});

test('files over 2 MB are refused before reading', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('import-input').setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 32) });
  await expect(page.getByTestId('import-error')).toContainText('This file is not a valid MedGit case file.');
});
