/**
 * MedGit application root.
 * Placeholder until the review-ui spec implements the full interface.
 */

function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg text-ink">
      <div className="text-center max-w-2xl px-8">
        <h1 className="text-4xl font-bold mb-4">
          MedGit
        </h1>
        <p className="text-base leading-relaxed mb-4">
          Medicine list reconciliation is loading scenarios.
        </p>
        <p className="text-sm py-2 px-4 bg-surface rounded-md inline-block">
          Synthetic data
        </p>
        <footer className="mt-12 text-sm text-ink-muted">
          Synthetic data. Not for clinical use.
        </footer>
      </div>
    </div>
  );
}

export default App;
