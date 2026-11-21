/**
 * The hero flow end to end, driven by data/scenarios/hero.json (demoScript, demoCommit, expectedAfterDemoScript).
 * Validates: review-ui 17.1, 17.2, 6.5, 6.6, 6.7, 6.8, 8.4, 8.5, 9.2
 */
import { expect, test, type Page } from '@playwright/test';
import hero from '../data/scenarios/hero.json' with { type: 'json' };

const SHOTS = 'e2e/__screens__';

async function decide(page: Page, step: (typeof hero.demoScript)[number]) {
  const drugKey = step.conflictId.slice(0, step.conflictId.lastIndexOf('::'));
  const kind = step.conflictId.slice(step.conflictId.lastIndexOf('::') + 2);
  await page.getByTestId(`role-${step.role}`).click();
  await page.getByTestId(`row-${drugKey}`).click();
  const strip = page.getByTestId('strip');
  await expect(strip).toHaveAttribute('data-conflict', step.conflictId);
  if (await page.getByTestId(`strip-tab-${kind}`).count()) await page.getByTestId(`strip-tab-${kind}`).click();
  if (step.note) await strip.getByTestId('note-input').fill(step.note);
  const d = step.decision as { type: string; source?: string };
  if (d.type === 'escalate') {
    await strip.getByTestId('escalate').click();
    return;
  }
  await strip.getByTestId(d.type === 'choose' ? `option-choose-${d.source}` : `option-${d.type}`).click();
  await strip.getByTestId('reason-select').selectOption(step.reasonCode);
  await strip.getByTestId('apply').click();
}

test.describe('hero flow', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

  test('decides all six differences, signs off, and the history matches the golden data', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('scenario-open-hero')).toBeFocused();
    await page.screenshot({ path: `${SHOTS}/start-1440-light.png`, fullPage: true });

    await page.getByTestId('scenario-open-hero').click();
    await expect(page).toHaveURL(/#\/reconcile$/);
    await expect(page.getByTestId('counter-open')).toHaveText('6 to decide');
    await expect(page.getByTestId('counter-agreed')).toHaveText('3 agreed');
    await expect(page.getByTestId('row-metformin-tab')).toHaveAttribute('aria-label', 'Metformin tablet. Frequency conflict. To decide.');
    await page.screenshot({ path: `${SHOTS}/reconcile-before-1440-light.png`, fullPage: true });

    for (const [i, step] of hero.demoScript.entries()) {
      // The pharmacist gate holds in the interface: after the escalation a clinician cannot decide amlodipine.
      if (i === 2) {
        await page.getByTestId('role-clinician').click();
        await page.getByTestId('row-amlodipine-tab').click();
        await expect(page.getByTestId('waiting')).toHaveText('Waiting for a pharmacist.');
        await expect(page.getByTestId('apply')).toBeDisabled();
        await expect(page.getByTestId('row-amlodipine-tab')).toHaveAttribute('data-state', 'escalated');
        await expect(page.getByTestId('counter-escalated')).toHaveText('1 escalated');
        await page.screenshot({ path: `${SHOTS}/reconcile-midway-1440-light.png`, fullPage: true });
      }
      await decide(page, step);
      await expect(page.getByTestId('strip-error')).toHaveCount(0);
    }

    await expect(page.getByTestId('counter-open')).toHaveText('0 to decide');
    await expect(page.getByTestId('counter-escalated')).toHaveText('0 escalated');
    for (const key of Object.keys(hero.expectedAfterDemoScript.entries)) {
      await expect(page.getByTestId(`merged-line-${key}`)).toBeVisible();
    }
    await expect(page.getByTestId('merged-sub')).toHaveText('9 medicines decided, 0 waiting');
    await expect(page.getByTestId('merged-line-aspirin-tab')).toContainText('stopped');
    await page.screenshot({ path: `${SHOTS}/reconcile-after-1440-light.png`, fullPage: true });

    // Sign off as the demo commit's author role
    await page.getByTestId(`role-${hero.demoCommit.author.role}`).click();
    await page.getByTestId('commit-message').fill(hero.demoCommit.message);
    await page.getByTestId('sign-off').click();
    await expect(page.getByTestId('commit-id')).toHaveText(/^[0-9a-f]{7}$/);
    await expect(page.getByTestId('history-link')).toBeFocused();
    // After sign-off: decisions carried by the head commit, nothing left to decide
    await expect(page.getByTestId('counter-open')).toHaveText('0 to decide');

    await page.getByTestId('history-link').click();
    await expect(page).toHaveURL(/#\/history$/);
    await expect(page.getByTestId('chain-status')).toHaveText('Chain verified');
    await expect(page.locator('[data-testid^="log-item-"]')).toHaveCount(3);
    const ids: string[] = [];
    for (const n of [2, 1, 0]) ids.push((await page.getByTestId(`log-item-${n}`).locator('code').innerText()).trim());

    await page.getByTestId('tab-changes').click();
    for (const k of hero.expectedAfterDemoScript.diffVsHead.added) await expect(page.getByTestId(`diff-added-${k}`)).toBeVisible();
    await expect(page.locator('[data-testid^="diff-added-"]')).toHaveCount(3);
    await expect(page.locator('[data-testid^="diff-changed-"]')).toHaveCount(1);
    await expect(page.getByTestId('diff-changed-aspirin-tab-status')).toContainText('active');
    await expect(page.getByTestId('diff-changed-aspirin-tab-status')).toContainText('stopped');

    await page.getByTestId('tab-list').click();
    await page.getByTestId('toggle-last-changed').click();
    for (const [key, b] of Object.entries(hero.expectedAfterDemoScript.blame)) {
      await expect(page.getByTestId(`blame-commit-${key}`)).toHaveText(ids[b.blamedCommit] ?? 'missing');
      if (b.lastDecision) await expect(page.getByTestId(`blame-${key}`)).toContainText(`Decided in ${ids[b.lastDecision.commit]}`);
      else await expect(page.getByTestId(`blame-${key}`)).toContainText('Agreed by all sources');
    }
    await page.screenshot({ path: `${SHOTS}/history-1440-light.png`, fullPage: true });
  });
});
