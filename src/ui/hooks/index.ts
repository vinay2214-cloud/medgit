import { useCallback, useSyncExternalStore } from 'react';

/** Breakpoints from the review-ui design: wide >= 1280, medium 768-1279, narrow < 768. */
export type Layout = 'wide' | 'medium' | 'narrow';

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

function currentLayout(): Layout {
  if (typeof window === 'undefined') return 'wide';
  const w = window.innerWidth;
  return w >= 1280 ? 'wide' : w >= 768 ? 'medium' : 'narrow';
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, currentLayout, () => 'wide');
}

/** Download text as a file through a temporary object URL. */
export function useDownload() {
  return useCallback((filename: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);
}
