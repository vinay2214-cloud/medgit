import { describe, expect, it } from 'vitest';
import { equalFrequency, equalStrength, mergeSources, renderMarkers, type Commit, type MergeResult } from '@core';
import { e, src } from '../helpers/build';
import { heroScenario, scenarioMerge } from '../helpers/data';

function merged(...sources: Parameters<typeof mergeSources>[0]): MergeResult {
  const r = mergeSources(sources, null);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

describe('comparison helpers', () => {
  // Validates: merge-engine 2.3
  it('compares strengths by unit and every value, nulls equal only to null', () => {
    expect(equalStrength(null, null)).toBe(true);
    expect(equalStrength(null, { values: [5], unit: 'mg' })).toBe(false);
    expect(equalStrength({ values: [5], unit: 'mg' }, { values: [5], unit: 'mcg' })).toBe(false);
    expect(equalStrength({ values: [800, 160], unit: 'mg' }, { values: [800, 160], unit: 'mg' })).toBe(true);
    expect(equalStrength({ values: [800, 160], unit: 'mg' }, { values: [800], unit: 'mg' })).toBe(false);
    expect(equalFrequency({ kind: 'prn' }, { kind: 'prn' })).toBe(true);
    expect(equalFrequency({ kind: 'scheduled', perDay: 2 }, { kind: 'scheduled', perDay: 1 })).toBe(false);
    expect(equalFrequency(null, { kind: 'prn' })).toBe(false);
  });
});

describe('mergeSources', () => {
  // Validates: merge-engine 1.1, 1.2, 1.3
  it('rejects too few sources, duplicate ids and invalid sources', () => {
    expect(mergeSources([src('a', {})], null)).toEqual({ ok: false, error: { code: 'TOO_FEW_SOURCES' } });
    expect(mergeSources([src('a', {}), src('a', {})], null)).toEqual({ ok: false, error: { code: 'DUPLICATE_SOURCE_ID', id: 'a' } });
    expect(mergeSources([src('a', {}), src('b', {}, false)], null)).toEqual({ ok: false, error: { code: 'INVALID_SOURCE', id: 'b' } });
  });

  // Validates: merge-engine 2.1, 4.2
  it('two agreeing sources give one clean entry agreed by both, sorted', () => {
    const m = merged(src('hospital', { 'x-tab': '5 mg|1/day|active' }), src('gp', { 'x-tab': '5 mg|1/day|active' }));
    expect(m.conflicts).toEqual([]);
    expect(m.clean).toEqual([{ entry: e('x-tab', '5 mg|1/day|active'), agreedBy: ['gp', 'hospital'], changeVsBase: null }]);
    expect(m.sources.map((s) => s.id)).toEqual(['gp', 'hospital']);
  });

  // Validates: merge-engine 2.2, 3.1
  it('an omission is a conflict with a claim for every source', () => {
    const m = merged(src('a', { 'x-tab': '5 mg|1/day|active' }), src('b', {}), src('c', { 'x-tab': '5 mg|1/day|active' }));
    expect(m.clean).toEqual([]);
    expect(m.conflicts).toHaveLength(1);
    expect(m.conflicts[0]?.id).toBe('x-tab::OMISSION');
    expect(m.conflicts[0]?.claims.map((c) => [c.source, c.entry === null])).toEqual([['a', false], ['b', true], ['c', false]]);
  });

  // Validates: merge-engine 3.2, 3.3, 3.4, 3.5, 3.6
  it('reports every field conflict separately, with claims from listing sources only, in kind order', () => {
    const m = merged(
      src('a', { 'x-tab': '5 mg|1/day|active' }),
      src('b', { 'x-tab': '10 mg|2/day|stopped' }),
      src('c', {}),
    );
    expect(m.conflicts.map((c) => c.id)).toEqual(['x-tab::OMISSION', 'x-tab::DOSE', 'x-tab::FREQUENCY', 'x-tab::STATUS']);
    expect(m.conflicts[1]?.claims.map((c) => c.source)).toEqual(['a', 'b']);
  });

  // Validates: merge-engine 2.3
  it('a null strength against a value is a DOSE conflict; two nulls agree', () => {
    expect(merged(src('a', { 'x-tab': 'null|1/day|active' }), src('b', { 'x-tab': '5 mg|1/day|active' })).conflicts[0]?.kind).toBe('DOSE');
    expect(merged(src('a', { 'x-tab': 'null|1/day|active' }), src('b', { 'x-tab': 'null|1/day|active' })).clean).toHaveLength(1);
  });

  // Validates: merge-engine 2.5
  it('does not compare display names or flags, and unions flags on the clean entry', () => {
    const a = src('a', { 'x-tab': '5 mg|1/day|active' });
    const b = src('b', { 'x-tab': '5 mg|1/day|active' });
    const be = b.entries[0];
    if (!be) throw new Error();
    be.displayName = 'Something else';
    be.flags = ['STRENGTH_NOT_IN_FORMULARY'];
    const m = merged(a, b);
    expect(m.clean[0]?.entry.displayName).toBe('x-tab');
    expect(m.clean[0]?.entry.flags).toEqual(['STRENGTH_NOT_IN_FORMULARY']);
  });

  // Validates: merge-engine 2.4
  it('no majority, recency or source kind wins: three against one is still a conflict', () => {
    const newer = { ...src('patient', { 'x-tab': '10 mg|1/day|active' }), asOf: '2026-12-31', kind: 'patient' as const };
    const m = merged(src('gp', { 'x-tab': '5 mg|1/day|active' }), src('hospital', { 'x-tab': '5 mg|1/day|active' }), src('pharmacy', { 'x-tab': '5 mg|1/day|active' }), newer);
    expect(m.clean).toEqual([]);
    expect(m.conflicts.map((c) => c.id)).toEqual(['x-tab::DOSE']);
    expect(m.conflicts[0]?.claims).toHaveLength(4);
  });

  // Validates: merge-engine 4.3
  it('reads no clock, randomness or global state: repeated calls give equal results', () => {
    const args = [src('a', { 'x-tab': '5 mg|1/day|active' }), src('b', { 'y-tab': '1 mg|prn|active' })];
    expect(mergeSources(args, null)).toEqual(mergeSources(args, null));
  });

  // Validates: merge-engine 1.4, 4.4
  it('does not mutate inputs and finds no conflicts when one list is supplied under several ids', () => {
    const s = src('a', { 'x-tab': '5 mg|1/day|active', 'y-tab': '1 mg|prn|active' });
    const snapshot = JSON.stringify(s);
    const m = merged(s, { ...s, id: 'b' }, { ...s, id: 'c' });
    expect(m.conflicts).toEqual([]);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  // Validates: merge-engine 5.1, 5.2, 5.3, 5.4
  it('labels changes against a base without changing the conflicts', () => {
    const base = { id: 'base1', entries: [e('x-tab', '5 mg|1/day|active'), e('y-tab', '1 mg|1/day|active'), e('z-tab', '2 mg|1/day|active')] } as Commit;
    const sources = [
      src('a', { 'x-tab': '5 mg|1/day|active', 'y-tab': '2 mg|1/day|active', 'w-tab': '1 mg|1/day|active', 'v-tab': '1 mg|1/day|active' }),
      src('b', { 'x-tab': '5 mg|1/day|active', 'y-tab': '2 mg|1/day|active', 'w-tab': '1 mg|1/day|active' }),
    ];
    const withBase = mergeSources(sources, base);
    const noBase = mergeSources(sources, null);
    if (!withBase.ok || !noBase.ok) throw new Error();
    expect(withBase.value.clean.map((c) => [c.entry.drugKey, c.changeVsBase])).toEqual([['w-tab', 'added'], ['x-tab', 'unchanged'], ['y-tab', 'changed']]);
    expect(withBase.value.removedVsBase).toEqual(['z-tab']);
    expect(withBase.value.baseCommitId).toBe('base1');
    expect(noBase.value.removedVsBase).toEqual([]);
    expect(withBase.value.conflicts).toEqual(noBase.value.conflicts);
  });
});

describe('markers', () => {
  // Validates: merge-engine 3.3
  it('renders the hero metformin FREQUENCY conflict exactly', () => {
    const m = scenarioMerge(heroScenario);
    const c = m.conflicts.filter((x) => x.id === 'metformin-tab::FREQUENCY');
    expect(renderMarkers(c, m.sources)).toBe(
      ['metformin-tab  FREQUENCY', '<<<<<<< gp, hospital, pharmacy', '2/day', '=======', '1/day', '>>>>>>> patient', ''].join('\n'),
    );
  });

  // Validates: merge-engine 3.1
  it('renders the hero cotrimoxazole OMISSION conflict exactly', () => {
    const m = scenarioMerge(heroScenario);
    const c = m.conflicts.filter((x) => x.id === 'cotrimoxazole-tab::OMISSION');
    expect(renderMarkers(c, m.sources)).toBe(
      ['cotrimoxazole-tab  OMISSION', '<<<<<<< gp, patient, pharmacy', '(not listed)', '=======', 'listed: 800/160 mg, 2/day, active', '>>>>>>> hospital', ''].join('\n'),
    );
  });

  // Validates: merge-engine 3.1, 3.2
  it('labels every group when there are more than two, and separates blocks with one blank line', () => {
    const m = merged(src('a', { 'x-tab': '1 mg|1/day|active' }), src('b', { 'x-tab': '2 mg|1/day|active' }), src('c', { 'x-tab': '3 mg|1/day|active' }));
    expect(renderMarkers(m.conflicts)).toBe(['x-tab  DOSE', '<<<<<<< a', '1 mg', '======= b', '2 mg', '=======', '3 mg', '>>>>>>> c', ''].join('\n'));
    const two = merged(src('a', { 'x-tab': '1 mg|1/day|active' }), src('b', { 'x-tab': '2 mg|2/day|active' }));
    expect(renderMarkers(two.conflicts).split('\n\n')).toHaveLength(2);
  });
});
