/**
 * Application shell: skip link, header, main, footer, live region.
 * Host for the polite live region and top-level layout structure.
 */

import { type ReactNode } from 'react';
import { SyntheticChip } from './SyntheticChip';
import { LiveRegionProvider } from './LiveRegion';

interface AppShellProps {
  children: ReactNode;
  /**
   * Optional slot for case title (shown when a scenario is loaded)
   */
  caseTitle?: ReactNode;
  /**
   * Optional slot for role switcher (clinician/pharmacist)
   */
  roleSlot?: ReactNode;
  /**
   * Optional slot for theme menu
   */
  themeSlot?: ReactNode;
  /**
   * Optional slot for export menu
   */
  exportSlot?: ReactNode;
}

export function AppShell({
  children,
  caseTitle,
  roleSlot,
  themeSlot,
  exportSlot,
}: AppShellProps) {
  return (
    <LiveRegionProvider>
      {/* Skip link - visually hidden until focused */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet focus:text-on-violet focus:rounded-[var(--radius-row)] focus:no-underline"
      >
        Skip to main content
      </a>

      <div className="min-h-screen flex flex-col bg-bg">
        {/* Header */}
        <header className="border-b border-line bg-surface">
          <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Left side: Mark and case title */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <h1 className="text-title font-bold text-ink">
                  MedGit
                </h1>
                {caseTitle && (
                  <div className="hidden md:block text-body text-ink-muted truncate">
                    {caseTitle}
                  </div>
                )}
              </div>

              {/* Right side: Synthetic chip and action slots */}
              <div className="flex items-center gap-3 flex-wrap">
                <SyntheticChip />
                {roleSlot}
                {themeSlot}
                {exportSlot}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main id="main" className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-line bg-surface py-4 mt-auto">
          <div className="max-w-[1440px] mx-auto px-4 md:px-6">
            <p className="text-small text-ink-muted text-center">
              Synthetic data. Not for clinical use.
            </p>
          </div>
        </footer>
      </div>
    </LiveRegionProvider>
  );
}
