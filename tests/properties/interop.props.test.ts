import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { exportCaseFile, fixedClock, fromFhirBundle, importCaseFile, renderRaw, toFhirBundle, type CaseState, type RawSourceList, type Resolution } from '@core';
import { runs } from '../helpers/fc';
import { genChain, genSourceLists } from '../helpers/gen';

const opts = () => ({ numRuns: runs(), verbose: 1 as const });

const genRawSources: fc.Arbitrary<RawSourceList[]> = genSourceLists.map((lists) =>
  lists.map((l) => ({ id: l.id, label: l.label, kind: l.kind, asOf: l.asOf, items: l.entries.map(renderRaw) })),
);

const genResolutions: fc.Arbitrary<Resolution[]> = fc.array(
  fc.record(
    {
      conflictId: fc.constantFrom('aspirin-tab::DOSE', 'metformin-tab::OMISSION', 'unmapped:x::STATUS'),
      decision: fc.constantFrom<Resolution['decision']>({ type: 'include' }, { type: 'escalate' }, { type: 'choose', source: 'gp' }, { type: 'custom', value: 'stopped' }, { type: 'custom', value: { values: [5], unit: 'mg' } }, { type: 'custom', value: { kind: 'prn' } }),
      reasonCode: fc.constantFrom<Resolution['reasonCode']>('CLINICAL_JUDGEMENT', 'NEEDS_PHARMACIST_REVIEW'),
      note: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
      by: fc.record({ role: fc.constantFrom<'clinician' | 'pharmacist'>('clinician', 'pharmacist'), name: fc.option(fc.constant('Demo Clinician'), { nil: undefined }) }, { requiredKeys: ['role'] }),
      at: fc.constant('2026-11-20T10:00:00Z'),
    },
    { requiredKeys: ['conflictId', 'decision', 'reasonCode', 'by', 'at'] },
  ),
  { maxLength: 5 },
).map((rs) => rs.map((r, i) => ({ ...r, seq: i + 1 }) as Resolution));

const genCaseState: fc.Arbitrary<CaseState> = fc.record({
  scenarioId: fc.option(fc.constantFrom('hero', 'clean', 'messy'), { nil: null }),
  patient: fc.record({ label: fc.constant('Sample Patient A'), age: fc.integer({ min: 18, max: 99 }), sex: fc.constantFrom('F', 'M') }),
  syntheticNotice: fc.constant('SYNTHETIC DATA. Not for clinical use.'),
  rawSources: genRawSources,
  history: genChain({ min: 0, max: 3 }),
  resolutions: genResolutions,
});

/** Drop undefined-valued keys so deep equality compares what JSON can hold. */
function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('interop-export properties', () => {
  // Validates: interop-export 1.1, 1.3, 2.1
  it('P-I1 case file round trip', () => {
    fc.assert(
      fc.property(genCaseState, (s) => {
        const text = exportCaseFile(s, fixedClock('2026-11-20T10:00:00Z'));
        expect(exportCaseFile(s, fixedClock('2026-11-20T10:00:00Z'))).toBe(text);
        const back = importCaseFile(text);
        expect(back.ok).toBe(true);
        if (back.ok) expect(plain(back.value)).toEqual(plain(s));
      }),
      opts(),
    );
  });

  // Validates: interop-export 2.2, 2.3, 2.4
  it('P-I2 import totality', () => {
    const genBroken = genCaseState.chain((s) => {
      const file = JSON.parse(exportCaseFile(s, fixedClock('2026-11-20T10:00:00Z'))) as Record<string, unknown>;
      const keys = Object.keys(file);
      return fc.tuple(fc.constant(file), fc.constantFrom(...keys), fc.constantFrom<unknown>(undefined, null, 7, 'x', [], {}));
    }).map(([file, key, value]) => JSON.stringify({ ...file, [key]: value }));
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json(), genBroken), (text) => {
        let r: ReturnType<typeof importCaseFile> | undefined;
        expect(() => { r = importCaseFile(text); }).not.toThrow();
        expect(r?.ok === true || r?.error.code === 'CASEFILE_INVALID').toBe(true);
      }),
      opts(),
    );
  });

  // Validates: interop-export 3.1, 3.7, 3.10, 4.1
  it('P-I3 FHIR round trip', () => {
    fc.assert(
      fc.property(genChain({ min: 1, max: 2 }), (history) => {
        const commit = history[history.length - 1];
        if (!commit) return;
        const b = toFhirBundle(commit, { patientLabel: 'Sample Patient A' });
        expect(toFhirBundle(commit, { patientLabel: 'Sample Patient A' })).toEqual(b);
        const back = fromFhirBundle(plain(b));
        expect(back.ok).toBe(true);
        if (back.ok) {
          const pick = (e: { drugKey: string; strength: unknown; frequency: unknown; status: string }) => ({ k: e.drugKey, s: e.strength, f: e.frequency, st: e.status });
          expect(back.value.map(pick)).toEqual(commit.entries.map(pick));
        }
      }),
      opts(),
    );
  });
});
