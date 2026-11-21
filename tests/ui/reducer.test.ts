import { describe, expect, it } from 'vitest';
import { exportCaseFile, fixedClock, importCaseFile, type ConflictId } from '@core';
import { scenarioById, formulary } from '@ui/data';
import { derive } from '@ui/state/derive';
import { initialState, makeReducer } from '@ui/state/reducer';
import { selectChartRows, selectCounters, selectHistoryView, selectMergedLines, selectStrip } from '@ui/state/selectors';
import type { Action, AppState } from '@ui/state/types';

const reducer = makeReducer(formulary);
const run = (actions: Action[], from: AppState = initialState()) => actions.reduce(reducer, from);
const hero = () => {
  const s = scenarioById('hero');
  if (!s) throw new Error('no hero');
  return s;
};
const resolve = (conflictId: string, decision: Extract<Action, { type: 'RESOLVE' }>['decision'], reasonCode: Extract<Action, { type: 'RESOLVE' }>['reasonCode'], at = '2026-11-20T10:00:00Z'): Action => ({
  type: 'RESOLVE',
  conflictId: conflictId as ConflictId,
  decision,
  reasonCode,
  at,
});

/** Hero demo script as actions, with role switches. */
function heroDemo(): Action[] {
  return hero().demoScript.flatMap((step, i): Action[] => [
    { type: 'SET_ROLE', role: step.role },
    { type: 'RESOLVE', conflictId: step.conflictId as ConflictId, decision: step.decision, reasonCode: step.reasonCode, note: step.note, at: `2026-11-20T09:${10 + i}:00Z` },
  ]);
}

describe('reducer purity', () => {
  // Validates: review-ui 2.1
  it('the reducer and derivations read no clock, randomness, storage or network', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['src/ui/state/reducer.ts', 'src/ui/state/derive.ts', 'src/ui/state/selectors.ts']) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Date\.now|new Date\(|Math\.random|localStorage|sessionStorage|fetch\(|XMLHttpRequest|window\.|document\./);
    }
    // same input, same output
    const a = run([{ type: 'LOAD_SCENARIO', scenario: hero() }]);
    const b = run([{ type: 'LOAD_SCENARIO', scenario: hero() }]);
    expect(a).toEqual(b);
  });
});

describe('reducer', () => {
  // Validates: review-ui 1.3, 2.2
  it('LOAD_SCENARIO normalises, replays prior commits and opens Reconcile on the first open conflict', () => {
    const s = run([{ type: 'LOAD_SCENARIO', scenario: hero() }]);
    expect(s.view).toBe('reconcile');
    expect(s.sources).toHaveLength(4);
    expect(s.history).toHaveLength(2);
    expect(s.ui.selectedConflictId).toBe('amlodipine-tab::DOSE');
    expect(selectCounters(derive(s))).toEqual({ toDecide: 6, escalated: 0, agreed: 3 });
    expect(s.announcement?.text).toContain('6 to decide');
    expect(Object.keys(s)).not.toContain('merge');
  });

  // Validates: review-ui 2.3, 6.9
  it('a RESOLVE the core rejects leaves resolutions unchanged and records the error code', () => {
    const loaded = run([{ type: 'LOAD_SCENARIO', scenario: hero() }]);
    const bad = reducer(loaded, resolve('amlodipine-tab::DOSE', { type: 'choose', source: 'nobody' }, 'CLINICAL_JUDGEMENT'));
    expect(bad.resolutions).toBe(loaded.resolutions);
    expect(bad.lastError).toMatchObject({ code: 'NOT_A_CLAIMANT', where: 'strip', conflictId: 'amlodipine-tab::DOSE' });
  });

  // Validates: review-ui 6.7, 6.8
  it('the pharmacist gate holds through the reducer', () => {
    const s = run([
      { type: 'LOAD_SCENARIO', scenario: hero() },
      resolve('amlodipine-tab::DOSE', { type: 'escalate' }, 'NEEDS_PHARMACIST_REVIEW'),
    ]);
    expect(selectStrip(s, derive(s))?.mayDecide).toBe(false);
    const clinician = reducer(s, resolve('amlodipine-tab::DOSE', { type: 'choose', source: 'hospital' }, 'PER_DISPENSING_RECORD'));
    expect(clinician.lastError?.code).toBe('NOT_AUTHORISED');
    const pharm = run([{ type: 'SET_ROLE', role: 'pharmacist' }, resolve('amlodipine-tab::DOSE', { type: 'choose', source: 'hospital' }, 'PER_DISPENSING_RECORD')], s);
    expect(pharm.lastError).toBeNull();
    expect(pharm.announcement?.text).toBe('Amlodipine tablet: Dose decided. 5 to decide.');
  });

  // Validates: review-ui 2.4
  it('COMMIT while differences remain, or with an empty message, changes nothing but the error', () => {
    const loaded = run([{ type: 'LOAD_SCENARIO', scenario: hero() }, { type: 'SET_COMMIT_MESSAGE', text: 'x' }]);
    const early = reducer(loaded, { type: 'COMMIT', at: 't' });
    expect(early.history).toBe(loaded.history);
    expect(early.lastError?.code).toBe('UNRESOLVED_CONFLICTS');
    const decided = run([...heroDemo(), { type: 'SET_COMMIT_MESSAGE', text: '   ' }], loaded);
    const empty = reducer(decided, { type: 'COMMIT', at: 't' });
    expect(empty.history).toBe(decided.history);
    expect(empty.lastError?.code).toBe('MESSAGE_REQUIRED');
  });

  // Validates: review-ui 2.5, 8.5, 9.1, 9.2
  it('COMMIT appends, clears resolutions and message, and the next merge carries the decisions with nothing to decide', () => {
    const dc = hero().demoCommit;
    const s = run([
      { type: 'LOAD_SCENARIO', scenario: hero() },
      ...heroDemo(),
      { type: 'SET_ROLE', role: 'pharmacist' },
      { type: 'SET_COMMIT_MESSAGE', text: dc?.message ?? '' },
      { type: 'COMMIT', at: dc?.at ?? '' },
    ]);
    expect(s.history).toHaveLength(3);
    expect(s.resolutions).toEqual([]);
    expect(s.ui.commitMessage).toBe('');
    expect(s.ui.lastCommitId).toBe(s.history[2]?.id);
    const d = derive(s);
    expect(selectCounters(d)).toEqual({ toDecide: 0, escalated: 0, agreed: 3 });
    expect(d.draft?.canCommit).toBe(true);
    expect(selectMergedLines(d).lines).toHaveLength(9);
    // the sources still show what they really say: the patient row keeps 1/day for metformin
    const metformin = selectChartRows(s, d).find((r) => r.drugKey === 'metformin-tab');
    expect(metformin?.rowState).toBe('resolved');
    expect(metformin?.cells.find((c) => c.sourceId === 'patient')?.entry?.frequency).toEqual({ kind: 'scheduled', perDay: 1 });
    const hv = selectHistoryView(s);
    expect(hv.chain).toEqual({ ok: true });
    expect(hv.log).toHaveLength(3);
  });

  // Validates: review-ui 6.10
  it('UNDO_LAST re-records the previous decision as a new event', () => {
    const s = run([
      { type: 'LOAD_SCENARIO', scenario: hero() },
      resolve('metformin-tab::FREQUENCY', { type: 'choose', source: 'hospital' }, 'CONFIRMED_WITH_PATIENT'),
      resolve('metformin-tab::FREQUENCY', { type: 'choose', source: 'patient' }, 'CLINICAL_JUDGEMENT'),
      { type: 'UNDO_LAST', conflictId: 'metformin-tab::FREQUENCY', at: 'later' },
    ]);
    expect(s.resolutions).toHaveLength(3);
    expect(s.resolutions[2]).toMatchObject({ seq: 3, decision: { type: 'choose', source: 'hospital' }, reasonCode: 'CONFIRMED_WITH_PATIENT', at: 'later' });
  });

  // Validates: review-ui 2.6
  it('SET_VIEW to a view that needs a case stays on Start when no case is open', () => {
    expect(run([{ type: 'SET_VIEW', view: 'history' }]).view).toBe('start');
    expect(run([{ type: 'LOAD_SCENARIO', scenario: hero() }, { type: 'SET_VIEW', view: 'history' }]).view).toBe('history');
  });

  // Validates: review-ui 2.7
  it('a source that lists a medicine twice gives a merge error instead of a chart', () => {
    const sc = hero();
    const first = sc.sources[0];
    if (!first) throw new Error();
    const dup = { ...sc, sources: [{ ...first, items: [...first.items, { name: 'Glucophage', strength: '500 mg', frequency: 'BD' }] }, ...sc.sources.slice(1)] };
    const s = run([{ type: 'LOAD_SCENARIO', scenario: dup }]);
    expect(derive(s).mergeError).toEqual({ code: 'INVALID_SOURCE', id: 'hospital' });
    expect(reducer(s, resolve('x::DOSE', { type: 'escalate' }, 'NEEDS_PHARMACIST_REVIEW')).lastError?.where).toBe('merge');
  });

  // Validates: review-ui 11.3
  it('IMPORT_CASEFILE restores the history and working decisions', () => {
    const s = run([{ type: 'LOAD_SCENARIO', scenario: hero() }, resolve('metformin-tab::FREQUENCY', { type: 'choose', source: 'hospital' }, 'CONFIRMED_WITH_PATIENT')]);
    const text = exportCaseFile(
      { scenarioId: s.scenarioId, patient: s.patient ?? { label: '', age: 0, sex: '' }, syntheticNotice: s.syntheticNotice ?? '', rawSources: s.rawSources, history: s.history, resolutions: s.resolutions },
      fixedClock('2026-11-20T10:00:00Z'),
    );
    const parsed = importCaseFile(text);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const back = run([{ type: 'IMPORT_CASEFILE', state: parsed.value }]);
    expect(back.history).toEqual(s.history);
    expect(back.resolutions).toEqual(s.resolutions);
    expect(selectCounters(derive(back)).toDecide).toBe(5);
    expect(back.ui.fhirReady).toBe(true);
  });

  // Validates: review-ui 3.4
  it('the filter never changes the counters', () => {
    const s = run([{ type: 'LOAD_SCENARIO', scenario: hero() }]);
    const before = selectCounters(derive(s));
    for (const filter of ['open', 'escalated', 'resolved', 'all'] as const) {
      expect(selectCounters(derive(reducer(s, { type: 'SET_FILTER', filter })))).toEqual(before);
    }
  });
});
