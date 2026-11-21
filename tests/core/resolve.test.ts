import { describe, expect, it } from 'vitest';
import { applyResolutions, formatEntry, mergeSources, validateResolution, type MergeResult, type Resolution } from '@core';
import { src } from '../helpers/build';

type Candidate = Omit<Resolution, 'seq'>;

function fixture(): MergeResult {
  const r = mergeSources(
    [
      src('gp', { 'x-tab': '5 mg|1/day|active', 'y-tab': '1 mg|2/day|active', 'z-tab': '2 mg|1/day|active' }),
      src('hospital', { 'x-tab': '10 mg|1/day|active', 'y-tab': '1 mg|2/day|active', 'w-tab': '4 mg|prn|active', 'z-tab': '3 mg|1/day|stopped' }),
    ],
    null,
  );
  if (!r.ok) throw new Error();
  return r.value;
}

const clin = { role: 'clinician' as const };
const pharm = { role: 'pharmacist' as const };

function cand(over: Partial<Candidate>): Candidate {
  return { conflictId: 'x-tab::DOSE', decision: { type: 'choose', source: 'gp' }, reasonCode: 'VERIFIED_WITH_PRESCRIBER', by: clin, at: 't', ...over };
}

/** Apply candidates in order, failing on rejection. */
function apply(m: MergeResult, cs: Candidate[]): Resolution[] {
  const out: Resolution[] = [];
  for (const c of cs) {
    const r = validateResolution(m, out, c);
    if (!r.ok) throw new Error(`${c.conflictId}: ${r.error.code}`);
    out.push(r.value);
  }
  return out;
}

describe('validateResolution', () => {
  const m = fixture();

  // Validates: merge-engine 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
  it.each([
    ['unknown conflict', cand({ conflictId: 'nope::DOSE' }), 'INVALID_DECISION'],
    ['missing reason', cand({ reasonCode: '' as Resolution['reasonCode'] }), 'REASON_REQUIRED'],
    ['include on a field conflict', cand({ decision: { type: 'include' } }), 'INVALID_DECISION'],
    ['choose on an omission', cand({ conflictId: 'w-tab::OMISSION' }), 'INVALID_DECISION'],
    ['escalate without review reason', cand({ decision: { type: 'escalate' } }), 'INVALID_DECISION'],
    ['review reason without escalate', cand({ reasonCode: 'NEEDS_PHARMACIST_REVIEW' }), 'INVALID_DECISION'],
    ['choose a non-claimant', cand({ decision: { type: 'choose', source: 'pharmacy' } }), 'NOT_A_CLAIMANT'],
    ['choose an omitting source', cand({ conflictId: 'w-tab::OMISSION', decision: { type: 'include' }, reasonCode: 'CLINICAL_JUDGEMENT' }), null],
    ['custom with wrong type', cand({ decision: { type: 'custom', value: 'stopped' } }), 'INVALID_DECISION'],
    ['custom with zero dose', cand({ decision: { type: 'custom', value: { values: [0], unit: 'mg' } } }), 'INVALID_DECISION'],
    ['custom with three values', cand({ decision: { type: 'custom', value: { values: [1, 2, 3], unit: 'mg' } } }), 'INVALID_DECISION'],
    ['custom with a valid dose', cand({ decision: { type: 'custom', value: { values: [7.5], unit: 'mg' } } }), null],
    ['custom frequency on a dose conflict', cand({ decision: { type: 'custom', value: { kind: 'prn' } } }), 'INVALID_DECISION'],
    ['note of 281 characters', cand({ note: 'n'.repeat(281) }), 'INVALID_DECISION'],
    ['note of 280 characters', cand({ note: 'n'.repeat(280) }), null],
  ])('%s', (_name, c, code) => {
    const r = validateResolution(m, [], c);
    if (code === null) expect(r.ok).toBe(true);
    else expect(r.ok ? null : r.error.code).toBe(code);
  });

  // Validates: merge-engine 6.8
  it('numbers events one above the highest existing seq', () => {
    const rs = apply(m, [cand({}), cand({ conflictId: 'z-tab::STATUS', decision: { type: 'choose', source: 'gp' } })]);
    expect(rs.map((r) => r.seq)).toEqual([1, 2]);
  });

  // Validates: merge-engine 7.1, 7.2, 7.3, 7.4, 7.5
  it('enforces the pharmacist gate on escalated conflicts in core', () => {
    const esc = apply(m, [cand({ decision: { type: 'escalate' }, reasonCode: 'NEEDS_PHARMACIST_REVIEW' })]);
    const rej = validateResolution(m, esc, cand({}));
    expect(rej.ok ? null : rej.error.code).toBe('NOT_AUTHORISED');
    expect(validateResolution(m, esc, cand({ decision: { type: 'escalate' }, reasonCode: 'NEEDS_PHARMACIST_REVIEW' })).ok).toBe(true);
    expect(validateResolution(m, esc, cand({ by: pharm })).ok).toBe(true);
    // a clinician may re-decide a conflict that is not escalated
    const decided = apply(m, [cand({}), cand({ decision: { type: 'choose', source: 'hospital' } })]);
    expect(decided).toHaveLength(2);
  });
});

describe('applyResolutions', () => {
  const m = fixture();

  // Validates: merge-engine 8.7
  it('with no resolutions holds exactly the clean entries and every conflict is open', () => {
    const d = applyResolutions(m, []);
    expect(d.entries.map((e) => e.drugKey)).toEqual(['y-tab']);
    expect(d.pendingCount).toBe(m.conflicts.length);
    expect(d.canCommit).toBe(false);
    expect(Object.values(d.states).every((s) => s === 'open')).toBe(true);
    expect(d.pendingDrugKeys).toEqual(['w-tab', 'x-tab', 'z-tab']);
  });

  // Validates: merge-engine 8.1, 8.5, 9.2
  it('exclude on an omission supersedes the drug and leaves it off', () => {
    const fixture2 = mergeSources([src('a', { 'q-tab': '1 mg|1/day|active' }), src('b', { 'q-tab': '2 mg|1/day|active' }), src('c', {})], null);
    if (!fixture2.ok) throw new Error();
    const rs = apply(fixture2.value, [cand({ conflictId: 'q-tab::OMISSION', decision: { type: 'exclude' }, reasonCode: 'CLINICAL_JUDGEMENT' })]);
    const d = applyResolutions(fixture2.value, rs);
    expect(d.states).toEqual({ 'q-tab::OMISSION': 'resolved', 'q-tab::DOSE': 'superseded' });
    expect(d.excluded).toEqual(['q-tab']);
    expect(d.entries).toEqual([]);
    expect(d.canCommit).toBe(true);
  });

  // Validates: merge-engine 8.2, 8.3
  it('an included drug with a pending DOSE stays out of entries until the DOSE is decided', () => {
    const fixture2 = mergeSources([src('a', { 'q-tab': '1 mg|1/day|active' }), src('b', { 'q-tab': '2 mg|1/day|active' }), src('c', {})], null);
    if (!fixture2.ok) throw new Error();
    const inc = apply(fixture2.value, [cand({ conflictId: 'q-tab::OMISSION', decision: { type: 'include' }, reasonCode: 'CLINICAL_JUDGEMENT' })]);
    expect(applyResolutions(fixture2.value, inc).pendingDrugKeys).toEqual(['q-tab']);
    const both = apply(fixture2.value, [
      cand({ conflictId: 'q-tab::OMISSION', decision: { type: 'include' }, reasonCode: 'CLINICAL_JUDGEMENT' }),
      cand({ conflictId: 'q-tab::DOSE', decision: { type: 'choose', source: 'b' } }),
    ]);
    const d = applyResolutions(fixture2.value, both);
    expect(d.entries.map(formatEntry)).toEqual(['2 mg|1/day|active']);
  });

  // Validates: merge-engine 8.3, 8.6, 8.8
  it('uses the chosen value, the typed value for custom (marked manual), and the latest decision', () => {
    const rs = apply(m, [
      cand({ decision: { type: 'choose', source: 'gp' } }),
      cand({ decision: { type: 'custom', value: { values: [7.5], unit: 'mg' } }, reasonCode: 'CLINICAL_JUDGEMENT' }),
      cand({ conflictId: 'z-tab::DOSE', decision: { type: 'choose', source: 'hospital' } }),
      cand({ conflictId: 'z-tab::STATUS', decision: { type: 'choose', source: 'gp' } }),
      cand({ conflictId: 'w-tab::OMISSION', decision: { type: 'include' }, reasonCode: 'PER_DISCHARGE_SUMMARY' }),
    ]);
    const d = applyResolutions(m, rs);
    expect(d.canCommit).toBe(true);
    expect(Object.fromEntries(d.entries.map((x) => [x.drugKey, formatEntry(x)]))).toEqual({
      'w-tab': '4 mg|prn|active',
      'x-tab': '7.5 mg|1/day|active',
      'y-tab': '1 mg|2/day|active',
      'z-tab': '3 mg|1/day|active',
    });
    expect(d.effective.map((r) => [r.conflictId, r.seq, r.manual])).toEqual([
      ['w-tab::OMISSION', 5, false],
      ['x-tab::DOSE', 2, true],
      ['z-tab::DOSE', 3, false],
      ['z-tab::STATUS', 4, false],
    ]);
  });

  // Validates: merge-engine 8.4, 9.3
  it('an escalated conflict blocks the commit', () => {
    const rs = apply(m, [cand({ decision: { type: 'escalate' }, reasonCode: 'NEEDS_PHARMACIST_REVIEW' })]);
    const d = applyResolutions(m, rs);
    expect(d.states['x-tab::DOSE']).toBe('escalated');
    expect(d.pendingDrugKeys).toContain('x-tab');
  });

  // Validates: merge-engine 9.3
  it('ignores events for unknown conflicts and invalid decisions without throwing', () => {
    const junk = [
      { seq: 1, conflictId: 'nope::DOSE', decision: { type: 'include' }, reasonCode: 'CLINICAL_JUDGEMENT', by: clin, at: 't' },
      { seq: 2, conflictId: 'x-tab::DOSE', decision: { type: 'choose', source: 'pharmacy' }, reasonCode: 'CLINICAL_JUDGEMENT', by: clin, at: 't' },
    ] as Resolution[];
    const d = applyResolutions(m, junk);
    expect(d.states['x-tab::DOSE']).toBe('open');
    expect(d.effective).toEqual([]);
  });
});
