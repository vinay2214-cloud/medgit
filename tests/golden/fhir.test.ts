import { describe, expect, it } from 'vitest';
import { fromFhirBundle, SYNTHETIC_TAG, toFhirBundle } from '@core';
import { heroAfterCommit } from '../helpers/data';

function bundle() {
  const { commit } = heroAfterCommit();
  return { commit, b: toFhirBundle(commit, { patientLabel: 'Sample Patient A' }) };
}

function res(b: ReturnType<typeof toFhirBundle>, key: string) {
  const r = b.entry.find((e) => e.resource.medicationCodeableConcept.coding?.[0]?.code === key)?.resource;
  if (!r) throw new Error(`no resource for ${key}`);
  return r;
}

describe('golden: FHIR bundle from the hero demo commit', () => {
  // Validates: interop-export 3.1, 3.2, 3.3, 3.9
  it('has nine tagged MedicationStatements with commit-derived ids, in drugKey order', () => {
    const { commit, b } = bundle();
    expect(b.resourceType).toBe('Bundle');
    expect(b.type).toBe('collection');
    expect(b.meta.tag).toEqual([SYNTHETIC_TAG]);
    expect(b.identifier).toEqual({ system: 'urn:medgit:commit', value: commit.id });
    expect(b.timestamp).toBe(commit.at);
    expect(b.entry).toHaveLength(9);
    const short = commit.id.slice(0, 7);
    for (const e of b.entry) {
      expect(e.resource.resourceType).toBe('MedicationStatement');
      expect(e.resource.meta.tag).toEqual([SYNTHETIC_TAG]);
      expect(e.resource.id.startsWith(`${short}-`)).toBe(true);
      expect(e.fullUrl).toBe(`urn:medgit:${e.resource.id}`);
      expect(e.resource.dateAsserted).toBe(commit.at);
      expect(e.resource.subject.display).toBe('Sample Patient A');
    }
    const keys = b.entry.map((e) => e.resource.medicationCodeableConcept.coding?.[0]?.code);
    expect(keys).toEqual([...keys].sort());
  });

  // Validates: interop-export 3.4, 3.5, 3.6, 3.7, 3.8
  it('exports status, strength, timing and reasons as specified', () => {
    const { b } = bundle();
    expect(res(b, 'aspirin-tab').status).toBe('stopped');
    expect(res(b, 'salbutamol-inhaler').dosage?.[0]?.asNeededBoolean).toBe(true);
    expect(res(b, 'salbutamol-inhaler').dosage?.[0]?.timing).toBeUndefined();
    expect(res(b, 'cotrimoxazole-tab').extension?.[0]).toEqual({ url: 'urn:medgit:ext:strength', valueString: '800/160 mg' });
    expect(res(b, 'metformin-tab').dosage?.[0]).toEqual({
      text: '500 mg, 2/day',
      timing: { repeat: { frequency: 2, period: 1, periodUnit: 'd' } },
      asNeededBoolean: false,
    });
    expect(res(b, 'metformin-tab').note?.[0]?.text).toBe('Decided: Confirmed with patient');
    expect(res(b, 'atorvastatin-tab').note?.[0]?.text).toBe('Agreed by all sources');
    expect(res(b, 'atorvastatin-tab').medicationCodeableConcept).toEqual({
      coding: [{ system: 'urn:medgit:formulary', code: 'atorvastatin-tab', display: 'Atorvastatin tablet' }],
      text: 'Atorvastatin tablet',
    });
  });

  // Validates: interop-export 3.10, 4.1
  it('is deterministic and reads back to the same values', () => {
    const { commit, b } = bundle();
    expect(toFhirBundle(commit, { patientLabel: 'Sample Patient A' })).toEqual(b);
    const back = fromFhirBundle(JSON.parse(JSON.stringify(b)));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.value.map((e) => ({ k: e.drugKey, s: e.strength, f: e.frequency, st: e.status }))).toEqual(
        commit.entries.map((e) => ({ k: e.drugKey, s: e.strength, f: e.frequency, st: e.status })),
      );
    }
  });
});
