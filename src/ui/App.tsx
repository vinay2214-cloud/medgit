/**
 * MedGit application root: store, shell, views, announcements.
 */
import { useEffect } from 'react';
import { ErrorBoundary, ExportMenu, RoleSwitch, ThemeMenu, ViewNav } from './shell/Controls';
import { AppShell } from './shell/AppShell';
import { useLiveRegion } from './shell/LiveRegion';
import { StoreProvider, useStore } from './state/store';
import { HistoryView } from './views/HistoryView';
import { ReconcileView } from './views/ReconcileView';
import { StartView } from './views/StartView';

/** Feeds state.announcement into the polite live region. Validates: review-ui 3.3, 14.5 */
function Announcer() {
  const { state } = useStore();
  const { announce } = useLiveRegion();
  const a = state.announcement;
  useEffect(() => {
    if (a) announce(a.text);
  }, [a, announce]);
  return null;
}

function Views() {
  const { state } = useStore();
  if (state.view === 'reconcile' && state.sources.length) return <ReconcileView />;
  if (state.view === 'history' && state.sources.length) return <HistoryView />;
  return <StartView />;
}

function Shell() {
  const { state } = useStore();
  const caseTitle = state.patient && state.scenarioTitle ? `${state.patient.label}. ${state.scenarioTitle}` : undefined;
  return (
    <AppShell caseTitle={caseTitle} navSlot={<ViewNav />} roleSlot={<RoleSwitch />} themeSlot={<ThemeMenu />} exportSlot={<ExportMenu />}>
      <Announcer />
      <ErrorBoundary>
        <Views />
      </ErrorBoundary>
    </AppShell>
  );
}

function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

export default App;
