/**
 * Component tests for the review UI.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ConflictId } from '@core';
import { formulary, scenarioById } from '@ui/data';
import { derive } from '@ui/state/derive';
import { initialState, makeReducer } from '@ui/state/reducer';
import { selectChartRows, selectStrip } from '@ui/state/selectors';
import { StoreProvider } from '@ui/state/store';
import type { Action, AppState } from '@ui/state/types';
import { DecisionStrip } from '@ui/components/DecisionStrip';
import { CommitPanel } from '@ui/components/Panels';
import { KindPill, SeamLine, StatePill } from '@ui/components/Primitives';
import { rowAccessibleName } from '@ui/components/ReviewChart';
import { HistoryView } from '@ui/views/HistoryView';

afterEach(cleanup);

const reducer = makeReducer(formulary);
function heroState(actions: Action[] = []): AppState {
  const hero = scenarioById('hero');
  if (!hero) throw new Error();
  return [{ type: 'LOAD_SCENARIO', scenario: hero } as Action, ...actions].reduce(reducer, initialState());
}

describe('presentational pieces', () => {
  // Validates: review-ui 5.1, 5.4
  it('SeamLine carries its state and is hidden from assistive technology', () => {
    const { container } = render(<SeamLine state="escalated" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-state')).toBe('escalated');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  // Validates: review-ui 4.5, 14.3
  it.each([
    ['open', 'To decide'],
    ['escalated', 'With pharmacist'],
    ['resolved', 'Decided'],
    ['superseded', 'Left off the list'],
    ['agreed', 'Agreed by all'],
  ] as const)('StatePill %s has the text %s and an icon', (state, text) => {
    const { container } = render(<StatePill state={state} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  // Validates: review-ui 4.3
  it('KindPill names the conflict kind', () => {
    const { container } = render(<KindPill kind="OMISSION" state="open" />);
    expect(container.textContent).toBe('Not on every list');
  });
});

describe('chart row accessible names', () => {
  // Validates: review-ui 4.8
  it('describes agreed, single-conflict and multi-conflict rows', () => {
    const s = heroState();
    const rows = selectChartRows(s, derive(s));
    const name = (k: string) => rowAccessibleName(rows.find((r) => r.drugKey === k) ?? rows[0]!);
    expect(name('atorvastatin-tab')).toBe('Atorvastatin tablet. Agreed.');
    expect(name('metformin-tab')).toBe('Metformin tablet. Frequency conflict. To decide.');
    const messy = scenarioById('messy');
    if (!messy) throw new Error();
    const m = reducer(initialState(), { type: 'LOAD_SCENARIO', scenario: messy });
    const mrows = selectChartRows(m, derive(m));
    const para = mrows.find((r) => r.drugKey === 'paracetamol-tab');
    expect(para && rowAccessibleName(para)).toBe('Paracetamol tablet. Not on every list and Dose conflict and Frequency conflict. To decide.');
  });
});

describe('DecisionStrip', () => {
  const noop = () => undefined;
  function strip(s: AppState, onResolve = vi.fn()) {
    const view = selectStrip(s, derive(s));
    if (!view) throw new Error('no strip');
    render(<DecisionStrip view={view} error={s.lastError} onResolve={onResolve} onUndo={noop} onSelectConflict={noop} />);
    return onResolve;
  }

  // Validates: review-ui 6.2, 6.4
  it('offers one option per claimant plus a custom value for a field conflict, and requires a reason', () => {
    const onResolve = strip(heroState());
    for (const id of ['gp', 'hospital', 'patient', 'pharmacy']) expect(screen.getByTestId(`option-choose-${id}`)).toBeTruthy();
    expect(screen.getByTestId('option-custom')).toBeTruthy();
    expect(screen.queryByTestId('option-include')).toBeNull();
    fireEvent.click(screen.getByTestId('option-choose-hospital'));
    expect((screen.getByTestId('apply') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'PER_DISPENSING_RECORD' } });
    expect((screen.getByTestId('apply') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('apply'));
    expect(onResolve).toHaveBeenCalledWith('amlodipine-tab::DOSE', { type: 'choose', source: 'hospital' }, 'PER_DISPENSING_RECORD', '');
  });

  // Validates: review-ui 6.2, 6.1
  it('offers include and leave off for an omission and shows "Not listed" claims', () => {
    strip(heroState([{ type: 'SELECT_CONFLICT', id: 'cotrimoxazole-tab::OMISSION' as ConflictId }]));
    expect(screen.getByTestId('option-include')).toBeTruthy();
    expect(screen.getByTestId('option-exclude')).toBeTruthy();
    expect(within(screen.getByTestId('claim-gp')).getByText('Not listed')).toBeTruthy();
  });

  // Validates: review-ui 6.3
  it('keeps Apply disabled and shows an inline error while a custom value is invalid', () => {
    strip(heroState());
    fireEvent.click(screen.getByTestId('option-custom'));
    fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'CLINICAL_JUDGEMENT' } });
    fireEvent.change(screen.getByTestId('custom-strength'), { target: { value: '0' } });
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid value.');
    expect((screen.getByTestId('apply') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('custom-strength'), { target: { value: '7.5' } });
    expect((screen.getByTestId('apply') as HTMLButtonElement).disabled).toBe(false);
  });

  // Validates: review-ui 6.7, 6.8
  it('disables decisions for a clinician on an escalated conflict and enables them for a pharmacist', () => {
    const esc: Action = { type: 'RESOLVE', conflictId: 'amlodipine-tab::DOSE' as ConflictId, decision: { type: 'escalate' }, reasonCode: 'NEEDS_PHARMACIST_REVIEW', at: 't' };
    strip(heroState([esc]));
    expect(screen.getByTestId('waiting').textContent).toBe('Waiting for a pharmacist.');
    expect((screen.getByTestId('option-choose-hospital') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('apply') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    strip(heroState([esc, { type: 'SET_ROLE', role: 'pharmacist' }]));
    expect(screen.queryByTestId('waiting')).toBeNull();
    expect((screen.getByTestId('option-choose-hospital') as HTMLButtonElement).disabled).toBe(false);
  });

  // Validates: review-ui 6.9
  it('shows the copy-deck message for a rejected decision', () => {
    const bad: Action = { type: 'RESOLVE', conflictId: 'amlodipine-tab::DOSE' as ConflictId, decision: { type: 'choose', source: 'nobody' }, reasonCode: 'CLINICAL_JUDGEMENT', at: 't' };
    strip(heroState([bad]));
    expect(screen.getByTestId('strip-error').textContent).toBe('That source does not hold a value for this medicine.');
  });
});

describe('CommitPanel', () => {
  const base = { escalatedOnly: false, message: '', role: 'clinician' as const, error: null, lastCommit: null, sticky: false, onMessage: () => undefined, onCommit: () => undefined };
  // Validates: review-ui 8.1, 8.2
  it.each([
    [0, true, null],
    [1, false, 'Resolve 1 more difference to sign off.'],
    [3, false, 'Resolve 3 more differences to sign off.'],
  ])('with %i pending', (pendingCount, canCommit, text) => {
    render(<CommitPanel {...base} pendingCount={pendingCount} canCommit={canCommit} />);
    expect(screen.queryByTestId('commit-disabled-reason')?.textContent ?? null).toBe(text);
    expect((screen.getByTestId('sign-off') as HTMLButtonElement).disabled).toBe(!canCommit);
  });

  // Validates: review-ui 8.3
  it('shows an error when the message is empty on submit', () => {
    const onCommit = vi.fn();
    render(<CommitPanel {...base} pendingCount={0} canCommit onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('sign-off'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Write a short message.');
  });
});

describe('HistoryView', () => {
  // Validates: review-ui 9.2, 9.6
  it('reports a tampered history as broken at the right commit', () => {
    const s = heroState();
    const second = s.history[1];
    if (!second) throw new Error();
    const tampered: AppState = { ...s, view: 'history', history: [s.history[0]!, { ...second, message: 'edited' }] };
    render(
      <StoreProvider initial={tampered}>
        <HistoryView />
      </StoreProvider>,
    );
    expect(screen.getByTestId('chain-status').textContent).toContain('Chain broken at commit 2');
  });

  // Validates: review-ui 9.6
  it('shows an empty message with a link when nothing is signed off', () => {
    const s: AppState = { ...heroState(), history: [], view: 'history' };
    render(
      <StoreProvider initial={s}>
        <HistoryView />
      </StoreProvider>,
    );
    expect(screen.getByText('Nothing signed off yet.')).toBeTruthy();
    expect(screen.getByText('Go to reconcile').getAttribute('href')).toBe('#/reconcile');
  });
});

describe('robustness and copy', () => {
  // Validates: review-ui 16.1
  it('the error boundary shows the generic message and a reload button', async () => {
    const { ErrorBoundary } = await import('@ui/shell/Controls');
    const Boom = () => {
      throw new Error('render failure');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong. Reload the page and try again.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    spy.mockRestore();
  });

  // Validates: review-ui 16.2
  it('every copy-deck key in docs/UX_SPEC.md section 8 has the same string in src/ui/copy.ts', async () => {
    const { readFileSync } = await import('node:fs');
    const { copy, copyForError } = await import('@ui/copy');
    const deck = readFileSync('docs/UX_SPEC.md', 'utf8').split('## 8. Copy deck')[1]?.split('\n## ')[0] ?? '';
    const rows = [...deck.matchAll(/^\| ([a-zA-Z.]+(?:\.[A-Z_]+)?) \| (.+) \|$/gm)].map((m) => [m[1] ?? '', m[2] ?? ''] as const).filter(([k]) => k !== 'Key');
    expect(rows.length).toBeGreaterThan(60);
    const fill = (s: string) => s.replace('{n}', '3').replace('{reason}', 'R').replace('{role}', 'Pharmacist').replace('{time}', 'T').replace('{source}', 'S');
    const lookup = (key: string): string | undefined => {
      const [head, ...rest] = key.split('.');
      if (head === 'err') return copyForError(rest.join('.'), 'S');
      let v: unknown = copy;
      for (const part of [head, ...rest]) v = (v as Record<string, unknown> | undefined)?.[part ?? ''];
      if (typeof v === 'function') return (v as (...a: unknown[]) => string)(...(key === 'commit.done' ? ['Pharmacist', 'T'] : key === 'merged.decided' ? ['R'] : [3]));
      return typeof v === 'string' ? v : undefined;
    };
    const aliases: Record<string, string> = {
      'merged.provenance.agreed': 'merged.agreed',
      'merged.provenance.decided': 'merged.decided',
      'merged.provenance.manual': 'merged.manual',
      'history.empty.link': 'history.emptyLink',
      'export.fhirDisabled': 'export.fhirDisabled',
      'empty.noConflicts': 'empty.noConflicts',
    };
    const missing = rows.filter(([k, v]) => lookup(aliases[k] ?? k) !== fill(v)).map(([k, v]) => `${k}: "${v}" -> "${String(lookup(aliases[k] ?? k))}"`);
    expect(missing).toEqual([]);
  });
});
