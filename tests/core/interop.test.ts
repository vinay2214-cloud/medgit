import { describe, expect, it } from 'vitest';
import { exportCaseFile, fixedClock, fromFhirBundle, importCaseFile, toFhirBundle, type CaseState, type Commit } from '@core';
import { heroAfterCommit, heroScenario } from '../helpers/data';

function state(): CaseState {
  const { history } = heroAfterCommit();
  return { scenarioId: 'hero', patient: heroScenario.patient, syntheticNotice: heroScenario.syntheticNotice, rawSources: heroScenario.sources, history, resolutions: [] };
}

function exported(): Record<string, unknown> {
  return JSON.parse(exportCaseFile(state(), fixedClock('2026-11-20T10:00:00Z'))) as Record<string, unknown>;
}

function message(text: string): string | null {
  const r = importCaseFile(text);
  return r.ok ? null : r.error.message;
}

describe('case file export', () => {
  // Validates: interop-export 1.3, 1.4
  it('is deterministic and holds no interface settings', () => {
    const s = state();
    const a = exportCaseFile(s, fixedClock('2026-11-20T10:00:00Z'));
    expect(exportCaseFile(s, fixedClock('2026-11-20T10:00:00Z'))).toBe(a);
    expect(Object.keys(JSON.parse(a) as object)).toEqual(['schema', 'syntheticNotice', 'exportedAt', 'scenarioId', 'patient', 'sources', 'history', 'resolutions']);
    expect(a).not.toMatch(/"(theme|view|filter|boardView|commitMessage)"/);
  });
});

describe('case file import', () => {
  // Validates: interop-export 2.2, 2.4
  it.each([
    ['empty string', '', 'not valid JSON'],
    ['not JSON', '{nope', 'not valid JSON'],
    ['JSON array', '[]', 'file is not an object'],
    ['wrong schema', JSON.stringify({ ...exported(), schema: 'medgit.case/2' }), 'schema'],
    ['missing patient', JSON.stringify({ ...exported(), patient: undefined }), 'patient'],
    ['empty notice', JSON.stringify({ ...exported(), syntheticNotice: ' ' }), 'syntheticNotice'],
  ])('rejects %s', (_n, text, fragment) => expect(message(text)).toContain(fragment));

  // Validates: interop-export 2.2, 2.3
  it('names the first nested problem', () => {
    const f = exported() as { history: { entries: { strength: unknown }[] }[] };
    const entry = f.history[1]?.entries[3];
    if (entry) entry.strength = { values: ['5'], unit: 'mg' };
    expect(message(JSON.stringify(f))).toBe('history[1].entries[3].strength.values[0] is not a number');
    const g = exported() as { resolutions: unknown[] };
    g.resolutions = [{ seq: 1, conflictId: 'x', decision: { type: 'include' }, reasonCode: 'CLINICAL_JUDGEMENT', by: { role: 'clinician' }, at: 't' }];
    expect(message(JSON.stringify(g))).toBe('resolutions[0].conflictId is not valid');
  });

  // Validates: interop-export 2.2
  it('enforces the size and count limits', () => {
    expect(message(' '.repeat(2_000_001))).toContain('2,000,000');
    const f = exported() as { sources: unknown[] };
    const first = f.sources[0];
    f.sources = Array.from({ length: 9 }, () => first);
    expect(message(JSON.stringify(f))).toContain('sources has more than 8');
    const g = exported() as { sources: { items: unknown[] }[] };
    const s0 = g.sources[0];
    if (s0) s0.items = Array.from({ length: 201 }, () => ({ name: 'x' }));
    expect(message(JSON.stringify(g))).toContain('more than 200');
    const h = exported() as { history: unknown[] };
    h.history = Array.from({ length: 101 }, () => h.history[0]);
    expect(message(JSON.stringify(h))).toContain('more than 100');
    const k = exported() as { resolutions: unknown[] };
    k.resolutions = Array.from({ length: 501 }, () => ({}));
    expect(message(JSON.stringify(k))).toContain('more than 500');
  });

  // Validates: interop-export 2.6
  it('drops unknown fields', () => {
    const f = exported() as Record<string, unknown> & { patient: Record<string, unknown> };
    f.extra = 1;
    f.patient.nhsNumber = 'nope';
    const r = importCaseFile(JSON.stringify(f));
    expect(r).toEqual({ ok: true, value: state() });
  });
});

describe('FHIR import', () => {
  // Validates: interop-export 4.2, 4.3, 4.4
  it.each([
    ['null', null],
    ['a string', 'Bundle'],
    ['a searchset bundle', { resourceType: 'Bundle', type: 'searchset', entry: [] }],
    ['another resource', { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Patient' } }] }],
    ['a statement without status', { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'MedicationStatement', medicationCodeableConcept: { text: 'x' } } }] }],
    ['a statement without coding or text', { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'MedicationStatement', status: 'active', medicationCodeableConcept: {} } }] }],
  ])('rejects %s without throwing', (_n, input) => {
    const r = fromFhirBundle(input);
    expect(r.ok ? null : r.error.code).toBe('FHIR_INVALID');
    // the importer only reads values back; it adds no flags, advice or validity claims
    const good = fromFhirBundle(toFhirBundle(heroAfterCommit().commit, { patientLabel: 'Sample Patient A' }));
    if (good.ok) for (const e of good.value) expect(Object.keys(e)).toEqual(['drugKey', 'displayName', 'strength', 'frequency', 'status', 'flags']);
  });

  // Validates: interop-export 3.5, 4.1
  it('exports an unmapped drug with text only and reads it back by slug', () => {
    const { commit } = heroAfterCommit();
    const c: Commit = { ...commit, entries: [{ drugKey: 'unmapped:ashwagandha-churna', displayName: 'Ashwagandha churna', strength: null, frequency: null, status: 'active', flags: ['UNMAPPED_DRUG'] }] };
    const b = toFhirBundle(c, { patientLabel: 'Sample Patient C' });
    expect(b.entry[0]?.resource.medicationCodeableConcept).toEqual({ text: 'Ashwagandha churna' });
    expect(b.entry[0]?.resource.dosage).toBeUndefined();
    const back = fromFhirBundle(b);
    expect(back.ok && back.value[0]?.drugKey).toBe('unmapped:ashwagandha-churna');
  });
});
