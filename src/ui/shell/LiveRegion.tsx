/**
 * Polite ARIA live region for announcing changes to screen readers.
 * Provides announce() function through React context.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface LiveRegionContextValue {
  announce: (message: string) => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

export function useLiveRegion() {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegion must be used within LiveRegionProvider');
  }
  return context;
}

/**
 * Global announce function registry for use without hooks
 */
const announceRegistry: { current: ((message: string) => void) | null } = { current: null };

export function announce(message: string) {
  if (announceRegistry.current) {
    announceRegistry.current(message);
  }
}

interface LiveRegionProviderProps {
  children: ReactNode;
}

export function LiveRegionProvider({ children }: LiveRegionProviderProps) {
  const [message, setMessage] = useState('');

  const announceMessage = useCallback((msg: string) => {
    // Clear first to ensure the message is announced even if it's the same
    setMessage('');
    // Use setTimeout to ensure the clear happens before the new message
    setTimeout(() => setMessage(msg), 10);
  }, []);

  // Register announce function in effect to avoid side effects during render
  useEffect(() => {
    announceRegistry.current = announceMessage;
    return () => {
      announceRegistry.current = null;
    };
  }, [announceMessage]);

  const value = { announce: announceMessage };

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </LiveRegionContext.Provider>
  );
}
