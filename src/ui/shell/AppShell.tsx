/**
 * Application shell: skip link, header, main, footer, live region.
 * The product mark is not a heading: each view has its own single h1.
 * Validates: project-bootstrap 3.5, 3.6; review-ui 14.8
 */

import { type ReactNode } from 'react';
import { Mark } from '../components/Primitives';
import { copy } from '../copy';
import { SyntheticChip } from './SyntheticChip';
import { LiveRegionProvider } from './LiveRegion';

interface AppShellProps {
  children: ReactNode;
  caseTitle?: ReactNode;
  navSlot?: ReactNode;
  roleSlot?: ReactNode;
  themeSlot?: ReactNode;
  exportSlot?: ReactNode;
}

export function AppShell({ children, caseTitle, navSlot, roleSlot, themeSlot, exportSlot }: AppShellProps) {
  return (
    <LiveRegionProvider>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet focus:text-on-violet focus:rounded-[var(--radius-row)] focus:no-underline"
      >
        {copy.nav.skip}
      </a>

      <div className="min-h-screen flex flex-col bg-bg">
        <header className="border-b border-line bg-surface">
          <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
              <Mark />
              {navSlot}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
              <SyntheticChip />
              {roleSlot}
              {themeSlot}
              {exportSlot}
            </div>
          </div>
          {caseTitle && (
            <div className="max-w-[1440px] mx-auto px-4 md:px-6 pb-3 -mt-1 text-small text-ink-muted wrap-anywhere" data-testid="case-title">
              {caseTitle}
            </div>
          )}
        </header>

        <main id="main" tabIndex={-1} className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-6 focus:outline-none">
          {children}
        </main>

        <footer className="border-t border-line bg-surface py-4 mt-auto">
          <div className="max-w-[1440px] mx-auto px-4 md:px-6">
            <p className="text-small text-ink-muted text-center">{copy.notice.synthetic}</p>
          </div>
        </footer>
      </div>
    </LiveRegionProvider>
  );
}
