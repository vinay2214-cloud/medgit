/**
 * Component tests for LiveRegion production API.
 * Tests the actual announce() function and provider lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { LiveRegionProvider, announce } from '@ui/shell/LiveRegion';

describe('LiveRegion Production API', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.restoreAllMocks();
  });

  describe('announce() function integration', () => {
    it('should update live region when announce() is called', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent).toBe('');

      // Call production announce() function
      act(() => {
        announce('Medication conflict detected');
        vi.runAllTimers();
      });

      expect(liveRegion?.textContent).toBe('Medication conflict detected');
    });

    it('should handle consecutive identical announcements', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');

      // First announcement
      act(() => {
        announce('Same message');
        vi.runAllTimers();
      });

      expect(liveRegion?.textContent).toBe('Same message');

      // Second identical announcement
      // Implementation clears first, then sets after timeout
      act(() => {
        announce('Same message');
      });

      // After clearing
      expect(liveRegion?.textContent).toBe('');

      // After setTimeout
      act(() => {
        vi.runAllTimers();
      });

      expect(liveRegion?.textContent).toBe('Same message');
    });

    it('should update to different messages correctly', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');

      // First message
      act(() => {
        announce('First message');
        vi.runAllTimers();
      });
      expect(liveRegion?.textContent).toBe('First message');

      // Second different message
      act(() => {
        announce('Second message');
        vi.runAllTimers();
      });
      expect(liveRegion?.textContent).toBe('Second message');

      // Third different message
      act(() => {
        announce('Third message');
        vi.runAllTimers();
      });
      expect(liveRegion?.textContent).toBe('Third message');
    });

    it('should not throw when announce() is called before provider mounts', () => {
      // No provider rendered, registry.current is null
      expect(() => {
        announce('Test message');
      }).not.toThrow();

      // Should be safe no-op
      vi.runAllTimers();
    });

    it('should clear announcement with empty string', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');

      // Set a message
      act(() => {
        announce('Message to clear');
        vi.runAllTimers();
      });
      expect(liveRegion?.textContent).toBe('Message to clear');

      // Clear with empty string
      act(() => {
        announce('');
        vi.runAllTimers();
      });
      expect(liveRegion?.textContent).toBe('');
    });
  });

  describe('Provider lifecycle', () => {
    it('should clean up registration on unmount', () => {
      const { container, unmount } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');

      // Verify it works while mounted
      act(() => {
        announce('Test message');
        vi.runAllTimers();
      });
      expect(liveRegion?.textContent).toBe('Test message');

      // Unmount the provider
      unmount();

      // announce() should not throw after unmount
      expect(() => {
        announce('After unmount');
      }).not.toThrow();

      // Timer should not cause issues
      act(() => {
        vi.runAllTimers();
      });
    });

    it('should register working callback after remount', () => {
      // First mount
      const { unmount: unmount1 } = render(
        <LiveRegionProvider>
          <div>First mount</div>
        </LiveRegionProvider>
      );

      act(() => {
        announce('First mount message');
        vi.runAllTimers();
      });

      // Unmount
      unmount1();

      // Second mount
      const { container: container2 } = render(
        <LiveRegionProvider>
          <div>Second mount</div>
        </LiveRegionProvider>
      );

      const liveRegion2 = container2.querySelector('[role="status"]');

      // Should work with new provider
      act(() => {
        announce('Second mount message');
        vi.runAllTimers();
      });

      expect(liveRegion2?.textContent).toBe('Second mount message');
    });

    it('should handle rapid announcements without stale timers', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');

      // Rapid successive calls
      act(() => {
        announce('Message 1');
        announce('Message 2');
        announce('Message 3');
        announce('Message 4');
        announce('Message 5');

        // Run all pending timers
        vi.runAllTimers();
      });

      // Last message should win
      expect(liveRegion?.textContent).toBe('Message 5');

      // No stale timers left
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('Singleton registry lifecycle', () => {
    it('should have only one active callback at a time', () => {
      // First provider
      const { container: container1 } = render(
        <LiveRegionProvider>
          <div>Provider 1</div>
        </LiveRegionProvider>
      );

      const liveRegion1 = container1.querySelector('[role="status"]');

      act(() => {
        announce('Message for provider 1');
        vi.runAllTimers();
      });

      expect(liveRegion1?.textContent).toBe('Message for provider 1');

      // Second provider (simulates multiple mounts)
      const { container: container2 } = render(
        <LiveRegionProvider>
          <div>Provider 2</div>
        </LiveRegionProvider>
      );

      const liveRegion2 = container2.querySelector('[role="status"]');

      // announce() now calls the second provider's callback
      act(() => {
        announce('Message for provider 2');
        vi.runAllTimers();
      });

      // Second provider receives the message
      expect(liveRegion2?.textContent).toBe('Message for provider 2');

      // First provider does NOT receive the message (last-mounted wins)
      expect(liveRegion1?.textContent).toBe('Message for provider 1');
    });

    it('should not allow old provider to clear newer registration', () => {
      // First provider
      const { unmount: unmount1 } = render(
        <LiveRegionProvider>
          <div>Provider 1</div>
        </LiveRegionProvider>
      );

      // Second provider mounts (registers itself)
      const { container: container2 } = render(
        <LiveRegionProvider>
          <div>Provider 2</div>
        </LiveRegionProvider>
      );

      const liveRegion2 = container2.querySelector('[role="status"]');

      // Verify second provider is active
      act(() => {
        announce('Test for provider 2');
        vi.runAllTimers();
      });
      expect(liveRegion2?.textContent).toBe('Test for provider 2');

      // Unmount first provider (cleanup runs)
      unmount1();

      // Second provider should STILL work
      // (cleanup from first provider should not clear second provider's registration)
      act(() => {
        announce('After first unmount');
        vi.runAllTimers();
      });

      expect(liveRegion2?.textContent).toBe('After first unmount');
    });
  });

  describe('ARIA attributes and structure', () => {
    it('should render live region with correct ARIA attributes', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
      expect(liveRegion?.classList.contains('sr-only')).toBe(true);
    });

    it('should start with empty content', () => {
      const { container } = render(
        <LiveRegionProvider>
          <div>App content</div>
        </LiveRegionProvider>
      );

      const liveRegion = container.querySelector('[role="status"]');
      expect(liveRegion?.textContent).toBe('');
    });
  });
});
