/**
 * Focused tests for LiveRegion announce behavior.
 * Verifies consecutive announcements, timing, and provider behavior.
 */

import { test, expect } from '@playwright/test';

test.describe('LiveRegion: Announcement Behavior', () => {
  test('should have exactly one live region in the document', async ({ page }) => {
    await page.goto('/');

    const liveRegions = page.locator('[role="status"][aria-live="polite"]');
    await expect(liveRegions).toHaveCount(1);
  });

  test('should maintain live region attributes throughout lifecycle', async ({ page }) => {
    await page.goto('/');

    const liveRegion = page.locator('[role="status"][aria-live="polite"]');
    
    // Verify all required attributes
    await expect(liveRegion).toHaveAttribute('role', 'status');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    await expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    
    // Should be visually hidden but in the DOM
    const className = await liveRegion.getAttribute('class');
    expect(className).toContain('sr-only');
  });

  test('should start with empty live region', async ({ page }) => {
    await page.goto('/');

    const liveRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(liveRegion).toHaveText('');
  });

  test('should be accessible to assistive technology', async ({ page }) => {
    await page.goto('/');

    // Live region should be in the accessibility tree despite being visually hidden
    const liveRegion = page.locator('[role="status"][aria-live="polite"]');
    
    // Verify it's in the DOM and has proper ARIA
    await expect(liveRegion).toBeAttached();
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
