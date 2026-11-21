import { describe, expect, it } from 'vitest';
import { applyResolutions, fieldOfKind, formatEntry, formatField, type Conflict } from '@core';
import { heroScenario, runHeroDemo, scenarioMerge, scenarios } from '../helpers/data';

function claimsAsStrings(c: Conflict): Record<string, string | null> {
  return Object.fromEntries(
    c.claims.map((cl) => [
      cl.source,
      c.kind === 'OMISSION' ? (cl.entry ? formatEntry(cl.entry) : null) : cl.entry ? formatField(fieldOfKind(c.kind), cl.entry) : null,
    ]),
  );
}

describe('golden: merge against scenario fixtures', () => {
  for (const sc of scenarios) {
    // Validates: merge-engine 9.5, 3.1, 3.6, 5.1, 5.3
    it(`${sc.id}: clean, conflicts and removedVsBase match expected`, () => {
      const m = scenarioMerge(sc);
      expect(m.clean.map((c) => ({ drugKey: c.entry.drugKey, agreedBy: c.agreedBy, changeVsBase: c.changeVsBase }))).toEqual(sc.expected.clean);
      expect(m.conflicts.map((c) => ({ id: c.id, kind: c.kind, claims: claimsAsStrings(c) }))).toEqual(sc.expected.conflicts);
      expect(m.removedVsBase).toEqual(sc.expected.removedVsBase);
    });
  }
});

describe('golden: hero demo script', () => {
  // Validates: merge-engine 9.4
  it('every step is accepted and the draft equals expectedAfterDemoScript.entries', () => {
    const { merge, resolutions } = runHeroDemo();
    const draft = applyResolutions(merge, resolutions);
    const expected = heroScenario.expectedAfterDemoScript;
    expect(expected).toBeDefined();
    expect(draft.canCommit).toBe(true);
    expect(draft.pendingCount).toBe(0);
    expect(Object.fromEntries(draft.entries.map((e) => [e.drugKey, formatEntry(e)]))).toEqual(expected?.entries);
    expect(draft.effective).toHaveLength(6);
    expect(merge.conflicts).toHaveLength(expected?.counts.conflictsTotal ?? -1);
  });

  // Validates: merge-engine 7.2, 7.5
  it('the escalated amlodipine step is rejected for a clinician', () => {
    const { merge, resolutions } = runHeroDemo();
    const escalateOnly = resolutions.filter((r) => r.seq <= 2);
    const draft = applyResolutions(merge, escalateOnly);
    expect(draft.states['amlodipine-tab::DOSE']).toBe('escalated');
  });
});
