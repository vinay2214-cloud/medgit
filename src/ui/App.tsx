/**
 * MedGit application root.
 * Placeholder until the review-ui spec implements the full interface.
 */

import { AppShell } from './shell/AppShell';

function App() {
  return (
    <AppShell>
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-2xl">
          <p className="text-body text-ink-muted">
            MedGit is loading scenarios.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export default App;
