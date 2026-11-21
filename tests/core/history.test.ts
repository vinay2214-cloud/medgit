import { describe, expect, it } from 'vitest';
import {
  applyResolutions,
  blame,
  commitDraft,
  diffCommits,
  fixedClock,
  log,
  mergeSources,
  replayPriorCommits,
  validateResolution,
  verifyChain,
  type Commit,
  type MergeResult,
  type SourceList,
} from '@core';
import { src } from '../helpers/build';
import { formulary, heroAfterCommit, heroScenario } from '../helpers/data';

const author = { role: 'pharmacist' as const, name: 'Demo Pharmacist' };

/** Merge agreeing sources against a parent and commit them. */
function commitOf(parent: Commit | null, entries: Record<string, string>, at: string, message = 'Sign off'): Commit {
  const sources: SourceList[] = [src('a', entries), src('b', entries)];
  const m = mergeSources(sources, parent);
  if (!m.ok) throw new Error();
  const c = commitDraft({ merge: m.value, draft: applyResolutions(m.value, []), parent, message, author, clock: fixedClock(at) });
  if (!c.ok) throw new Error(c.error.code);
  return c.value;
}

describe('commitDraft', () => {
  const conflicted = mergeSources([src('a', { 'x-tab': '1 mg|1/day|active' }), src('b', { 'x-tab': '2 mg|1/day|active' })], null);
  if (!conflicted.ok) throw new Error();
  const m: MergeResult = conflicted.value;

  // Validates: history-audit 1.1
  it('refuses an unresolved draft', () => {
    const r = commitDraft({ merge: m, draft: applyResolutions(m, []), parent: null, message: 'x', author, clock: fixedClock('t') });
    expect(r).toEqual({ ok: false, error: { code: 'UNRESOLVED_CONFLICTS' } });
  });

  // Validates: history-audit 1.2
  it.each([['empty', '   '], ['201 characters', 'm'.repeat(201)]])('refuses a %s message', (_n, message) => {
    const ok = mergeSources([src('a', {}), src('b', {})], null);
    if (!ok.ok) throw new Error();
    const r = commitDraft({ merge: ok.value, draft: applyResolutions(ok.value, []), parent: null, message, author, clock: fixedClock('t') });
    expect(r).toEqual({ ok: false, error: { code: 'MESSAGE_REQUIRED' } });
  });

  // Validates: history-audit 1.3, 1.4, 1.5, 1.6
  it('builds the commit from the draft, links the parent, uses the clock and does not mutate inputs', () => {
    const v = validateResolution(m, [], { conflictId: 'x-tab::DOSE', decision: { type: 'choose', source: 'b' }, reasonCode: 'CLINICAL_JUDGEMENT', by: author, at: 't1' });
    if (!v.ok) throw new Error();
    const draft = applyResolutions(m, [v.value]);
    const parent = commitOf(null, { 'y-tab': '1 mg|1/day|active' }, '2026-01-01T00:00:00Z');
    const snapshot = JSON.stringify({ m, draft, parent });
    const r = commitDraft({ merge: m, draft, parent, message: '  Reconcile  ', author, clock: fixedClock('2026-02-02T00:00:00Z') });
    if (!r.ok) throw new Error();
    expect(r.value.parentId).toBe(parent.id);
    expect(r.value.at).toBe('2026-02-02T00:00:00Z');
    expect(r.value.message).toBe('Reconcile');
    expect(r.value.entries).toEqual(draft.entries);
    expect(r.value.resolutions).toEqual(draft.effective);
    expect(r.value.sourcesSeen).toEqual([{ id: 'a', asOf: '2026-11-01' }, { id: 'b', asOf: '2026-11-01' }]);
    expect(r.value.id).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify({ m, draft, parent })).toBe(snapshot);
    // later mutation of the draft cannot reach the commit
    const first = draft.entries[0];
    if (first) first.status = 'stopped';
    expect(r.value.entries[0]?.status).toBe('active');
  });
});

describe('verifyChain and log', () => {
  const c0 = commitOf(null, { 'x-tab': '1 mg|1/day|active' }, '2026-01-01T00:00:00Z');
  const c1 = commitOf(c0, { 'x-tab': '1 mg|1/day|active', 'y-tab': '2 mg|prn|active' }, '2026-02-01T00:00:00Z');
  const c2 = commitOf(c1, { 'y-tab': '2 mg|prn|active' }, '2026-03-01T00:00:00Z');

  // Validates: history-audit 3.1
  it('accepts an empty history and a valid chain', () => {
    expect(verifyChain([])).toEqual({ ok: true, value: true });
    expect(verifyChain([c0, c1, c2])).toEqual({ ok: true, value: true });
  });

  // Validates: history-audit 3.2, 3.3
  it.each([
    ['a broken first commit', [{ ...c0, parentId: 'abc' }, c1, c2], 0],
    ['a broken parent link', [c0, c2], 1],
    ['a changed message', [c0, { ...c1, message: 'edited' }, c2], 1],
    ['a changed id', [c0, c1, { ...c2, id: c2.id.replace(/^./, '0') === c2.id ? 'f' + c2.id.slice(1) : '0' + c2.id.slice(1) }], 2],
  ])('reports %s', (_n, history, index) => {
    expect(verifyChain(history as Commit[])).toEqual({ ok: false, error: { code: 'CHAIN_BROKEN', index } });
  });

  // Validates: history-audit 4.1, 4.2
  it('logs newest first without changing the history', () => {
    const h = [c0, c1, c2];
    const lines = log(h);
    expect(lines.map((l) => l.id)).toEqual([c2.id, c1.id, c0.id]);
    expect(lines[1]).toEqual({ id: c1.id, message: 'Sign off', author, at: c1.at, entryCount: 2, resolutionCount: 0 });
    expect(h.map((c) => c.id)).toEqual([c0.id, c1.id, c2.id]);
  });
});

describe('diff and blame', () => {
  const c0 = commitOf(null, { 'x-tab': '1 mg|1/day|active' }, '2026-01-01T00:00:00Z');
  const c1 = commitOf(c0, { 'x-tab': '2 mg|2/day|stopped', 'y-tab': '2 mg|prn|active' }, '2026-02-01T00:00:00Z');
  const c2 = commitOf(c1, { 'x-tab': '1 mg|1/day|active', 'y-tab': '2 mg|prn|active' }, '2026-03-01T00:00:00Z');

  // Validates: history-audit 5.1, 5.2, 5.3, 5.4
  it('lists added, removed and changed fields in order; root diffs against empty; self-diff is empty', () => {
    expect(diffCommits(null, c0)).toEqual({ added: ['x-tab'], removed: [], changed: [] });
    expect(diffCommits(c0, c1)).toEqual({
      added: ['y-tab'],
      removed: [],
      changed: [
        { drugKey: 'x-tab', field: 'strength', from: '1 mg', to: '2 mg' },
        { drugKey: 'x-tab', field: 'frequency', from: '1/day', to: '2/day' },
        { drugKey: 'x-tab', field: 'status', from: 'active', to: 'stopped' },
      ],
    });
    expect(diffCommits(c1, c0).removed).toEqual(['y-tab']);
    expect(diffCommits(c1, c1)).toEqual({ added: [], removed: [], changed: [] });
  });

  // Validates: history-audit 6.1, 6.2, 6.3, 6.4
  it('blames the commit where a value reverted, not where it first appeared', () => {
    const b = blame([c0, c1, c2]);
    expect(b.map((l) => [l.drugKey, l.blamedCommitId])).toEqual([['x-tab', c2.id], ['y-tab', c1.id]]);
    expect(b.every((l) => l.reasonCodes.length === 0 && l.lastDecision === null)).toBe(true);
    expect(blame([])).toEqual([]);
  });
});

describe('replayPriorCommits', () => {
  // Validates: history-audit 7.1, 7.2
  it('builds a chained history deterministically with empty resolutions and agreements by drug', () => {
    const a = replayPriorCommits(heroScenario.priorCommits, formulary);
    const b = replayPriorCommits(heroScenario.priorCommits, formulary);
    expect(a).toEqual(b);
    expect(a[0]?.resolutions).toEqual([]);
    expect(a[0]?.sourcesSeen).toEqual([]);
    expect(a[0]?.agreements).toEqual(a[0]?.entries.map((e) => ({ drugKey: e.drugKey, agreedBy: [] })));
    expect(a[0]?.message).toBe(heroScenario.priorCommits[0]?.message);
    expect(verifyChain(a).ok).toBe(true);
  });

  // Validates: history-audit 8.1, 8.2
  it('history functions do not modify commits', () => {
    const { history } = heroAfterCommit();
    const snapshot = JSON.stringify(history);
    log(history);
    blame(history);
    verifyChain(history);
    diffCommits(history[0] ?? null, history[1] as Commit);
    expect(JSON.stringify(history)).toBe(snapshot);
  });
});
