/**
 * Reconcile: summary, chart (or markers), decision strip, reconciled list, sign-off.
 * The strip is rendered once: beside the chart (wide), in a right drawer (medium), in a bottom sheet (narrow).
 * Validates: review-ui 2.7, 3.3, 6.5, 8.4, 8.5, 13.1, 13.2, 13.3
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConflictId, Decision, ReasonCode } from '@core';
import { copy, copyForError } from '../copy';
import { useLayout } from '../hooks';
import { filterRows, nextOpenRow, rowConflictToSelect, selectChartRows, selectCounters, selectIssues, selectMergedLines, selectStrip, type ChartRow } from '../state/selectors';
import { systemClock, useStore } from '../state/store';
import { DecisionStrip } from '../components/DecisionStrip';
import { CommitPanel, IssuesPanel, MarkerView, MergedList, SummaryBar } from '../components/Panels';
import { ChartCards, ReviewChart } from '../components/ReviewChart';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet';

function focusTarget(id: string, before?: () => void) {
  requestAnimationFrame(() => {
    before?.();
    const el = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  });
}

export function ReconcileView() {
  const { state, dispatch, derived } = useStore();
  const layout = useLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const afterResolve = useRef<string | null>(null);
  const lastSeenCommit = useRef(state.ui.lastCommitId);

  const rows = useMemo(() => selectChartRows(state, derived), [state, derived]);
  const visible = filterRows(rows, state.ui.filter);
  const counters = selectCounters(derived);
  const merged = selectMergedLines(derived);
  const strip = selectStrip(state, derived);
  const issues = selectIssues(state);
  const problemSources = new Set(issues.map((g) => g.sourceId));
  const selectedDrugKey = strip?.conflict.drugKey ?? null;
  const draft = derived.draft;

  const selectRow = (row: ChartRow) => {
    const id = rowConflictToSelect(row);
    if (!id) return;
    dispatch({ type: 'SELECT_CONFLICT', id });
    if (layout !== 'wide') setSheetOpen(true);
  };

  const onResolve = (conflictId: ConflictId, decision: Decision, reasonCode: ReasonCode, note: string) => {
    afterResolve.current = conflictId.slice(0, conflictId.lastIndexOf('::'));
    dispatch({ type: 'RESOLVE', conflictId, decision, reasonCode, note, at: systemClock.now() });
  };

  // After an accepted decision: move to the next open difference, or to the sign-off message.
  useEffect(() => {
    const from = afterResolve.current;
    if (from === null) return;
    afterResolve.current = null;
    if (state.lastError?.where === 'strip') return;
    const current = rows.find((r) => r.drugKey === from);
    const sameRowOpen = current?.conflicts.find((c) => c.state === 'open');
    const target = sameRowOpen ? current : nextOpenRow(rows.filter((r) => r.rowState === 'open' || (state.role === 'pharmacist' && r.rowState === 'escalated')), from);
    if (target) {
      const id = sameRowOpen?.id ?? rowConflictToSelect(target);
      if (id) dispatch({ type: 'SELECT_CONFLICT', id });
      focusTarget(`row-${target.drugKey}`, () => setSheetOpen(false));
    } else if (draft?.canCommit) {
      focusTarget('commit-message', () => setSheetOpen(false));
    }
  }, [state.resolutions, state.lastError, rows, draft, dispatch, state.role]);

  // After a sign-off: focus the link to the history.
  useEffect(() => {
    if (state.ui.lastCommitId && state.ui.lastCommitId !== lastSeenCommit.current) {
      lastSeenCommit.current = state.ui.lastCommitId;
      focusTarget('history-link');
    }
  }, [state.ui.lastCommitId]);

  if (derived.mergeError) {
    const e = derived.mergeError;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-title font-bold text-ink">{state.scenarioTitle}</h1>
        <p role="alert" className="p-4 rounded-[var(--radius-row)] bg-conflict-bg text-conflict font-semibold" data-testid="merge-error">
          {copyForError(e.code, 'id' in e ? (state.sources.find((s) => s.id === e.id)?.label ?? e.id) : undefined)}
        </p>
        <IssuesPanel groups={issues} open={problemsOpen} onToggle={setProblemsOpen} />
      </div>
    );
  }
  if (!derived.merge || !draft) return null;
  const merge = derived.merge;

  const stripNode = strip ? (
    <DecisionStrip
      key={strip.conflict.id}
      view={strip}
      error={state.lastError}
      onResolve={onResolve}
      onUndo={(id) => {
        afterResolve.current = null;
        dispatch({ type: 'UNDO_LAST', conflictId: id, at: systemClock.now() });
      }}
      onSelectConflict={(id) => dispatch({ type: 'SELECT_CONFLICT', id })}
    />
  ) : (
    <p className="text-body text-ink-muted">{merge.conflicts.length ? copy.strip.empty : copy.empty.noConflicts}</p>
  );

  const chartProps = {
    rows: visible,
    sources: merge.sources,
    selectedDrugKey,
    onSelect: selectRow,
    openProblems: issues.length
      ? () => {
          setProblemsOpen(true);
          requestAnimationFrame(() => document.getElementById('problems')?.querySelector('summary')?.focus());
        }
      : null,
    problemSources,
  };

  const board =
    state.ui.boardView === 'markers' ? (
      <MarkerView
        conflicts={merge.conflicts}
        states={draft.states}
        selectedId={state.ui.selectedConflictId}
        onSelect={(id) => {
          dispatch({ type: 'SELECT_CONFLICT', id });
          if (layout !== 'wide') setSheetOpen(true);
        }}
      />
    ) : layout === 'narrow' ? (
      <ChartCards {...chartProps} />
    ) : (
      <ReviewChart {...chartProps} />
    );

  const head = state.history[state.history.length - 1];
  const lastCommit = state.ui.lastCommitId && head?.id === state.ui.lastCommitId ? { id: head.id, role: head.author.role, at: head.at } : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-bold text-ink wrap-anywhere">{state.scenarioTitle}</h1>
        <p className="text-small text-ink-muted">
          {state.patient?.label}. {state.syntheticNotice}
        </p>
      </div>

      <div className={layout === 'narrow' ? 'sticky top-0 z-10 bg-bg' : undefined}>
        <SummaryBar
          counters={counters}
          filter={state.ui.filter}
          boardView={state.ui.boardView}
          onFilter={(filter) => dispatch({ type: 'SET_FILTER', filter })}
          onBoardView={(view) => dispatch({ type: 'SET_BOARD_VIEW', view })}
        />
      </div>

      <IssuesPanel groups={issues} open={problemsOpen} onToggle={setProblemsOpen} />

      {merge.conflicts.length === 0 && <p className="p-4 bg-resolved-bg text-resolved rounded-[var(--radius-row)] font-semibold" data-testid="no-conflicts">{copy.empty.noConflicts}</p>}

      {layout === 'wide' ? (
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          {board}
          <aside className="bg-surface border border-line rounded-[var(--radius-row)] p-5 sticky top-4" aria-label={copy.strip.decision}>
            {stripNode}
          </aside>
        </div>
      ) : (
        <>
          {board}
          <Sheet open={sheetOpen && strip !== null} onOpenChange={setSheetOpen}>
            <SheetContent
              side={layout === 'narrow' ? 'bottom' : 'right'}
              className={layout === 'narrow' ? 'max-h-[88vh] overflow-y-auto rounded-t-[var(--radius-dialog)]' : 'w-[440px] max-w-[92vw] sm:max-w-[440px] overflow-y-auto'}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                if (selectedDrugKey) focusTarget(`row-${selectedDrugKey}`);
              }}
            >
              <SheetTitle className="sr-only">{copy.strip.decision}</SheetTitle>
              <SheetDescription className="sr-only">{strip?.displayName}</SheetDescription>
              <div className="pt-6">{stripNode}</div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <div className={layout === 'wide' ? 'grid grid-cols-[minmax(0,1fr)_400px] gap-6 items-start' : 'flex flex-col gap-4'}>
        <MergedList view={merged} />
        <CommitPanel
          pendingCount={draft.pendingCount}
          escalatedOnly={counters.toDecide === 0 && counters.escalated > 0}
          canCommit={draft.canCommit}
          message={state.ui.commitMessage}
          role={state.role}
          error={state.lastError}
          lastCommit={lastCommit}
          sticky={layout === 'narrow'}
          onMessage={(text) => dispatch({ type: 'SET_COMMIT_MESSAGE', text })}
          onCommit={() => dispatch({ type: 'COMMIT', at: systemClock.now() })}
        />
      </div>
    </div>
  );
}
