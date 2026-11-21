/**
 * fast-check generators. Small universes so that conflicts are common (see .kiro/steering/testing-pbt.md).
 */
import fc from 'fast-check';
import {
  applyResolutions,
  commitDraft,
  fixedClock,
  mergeSources,
  validateResolution,
  type Commit,
  type Conflict,
  type Decision,
  type FormularyItem,
  type Frequency,
  type MedEntry,
  type ReasonCode,
  type Resolution,
  type Role,
  type SourceList,
  type Status,
  type Strength,
} from '@core';
import { formulary } from './data';

// ------------------------------------------------------------------ normaliser

export const genFormularyItem: fc.Arbitrary<FormularyItem> = fc.constantFrom(...formulary.items);

export const genFreqCanonical: fc.Arbitrary<Frequency> = fc.oneof(
  fc.constantFrom<1 | 2 | 3 | 4>(1, 2, 3, 4).map((perDay): Frequency => ({ kind: 'scheduled', perDay })),
  fc.constant<Frequency>({ kind: 'prn' }),
);

export const genStatus: fc.Arbitrary<Status> = fc.constantFrom<Status>('active', 'stopped', 'on-hold');

/** Random upper/lower case per character. */
export function genMessyCase(s: string): fc.Arbitrary<string> {
  return fc.array(fc.boolean(), { minLength: s.length, maxLength: s.length }).map((flags) =>
    [...s].map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase())).join(''),
  );
}

/** Tokens joined by random runs of separators from " -_/." with random case. */
export function genMessyAlias(alias: string): fc.Arbitrary<string> {
  const toks = alias.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const sep = fc.stringMatching(/^[ \-_/.]{1,3}$/);
  return fc
    .tuple(fc.array(sep, { minLength: toks.length + 1, maxLength: toks.length + 1 }), genMessyCase(toks.join('\u0000')))
    .map(([seps, cased]) => {
      const parts = cased.split('\u0000');
      return (seps[0] ?? '') + parts.map((p, i) => p + (i < parts.length - 1 ? (seps[i + 1] ?? ' ') : '')).join('') + (seps[toks.length] ?? '');
    });
}

// ------------------------------------------------------------------ merge universe

export const SOURCE_IDS = ['gp', 'hospital', 'patient', 'pharmacy'] as const;
export const DRUG_KEYS = ['aspirin-tab', 'atorvastatin-tab', 'metformin-tab', 'amlodipine-tab', 'paracetamol-tab'] as const;
const STRENGTHS: Strength[] = [{ values: [5], unit: 'mg' }, { values: [10], unit: 'mg' }, { values: [800, 160], unit: 'mg' }];
const FREQS: Frequency[] = [{ kind: 'scheduled', perDay: 1 }, { kind: 'scheduled', perDay: 2 }, { kind: 'prn' }];

const genEntryValues = fc.record({
  strength: fc.oneof({ weight: 6, arbitrary: fc.constantFrom(...STRENGTHS) }, { weight: 1, arbitrary: fc.constant(null) }),
  frequency: fc.constantFrom(...FREQS),
  status: fc.constantFrom<Status>('active', 'stopped'),
});

function entryOf(drugKey: string, v: { strength: Strength | null; frequency: Frequency; status: Status }, name: string): MedEntry {
  return {
    drugKey,
    displayName: name,
    strength: v.strength === null ? null : { values: [...v.strength.values], unit: v.strength.unit },
    frequency: { ...v.frequency },
    status: v.status,
    flags: [],
  };
}

/** A per-drug "prototype" value shared by sources with probability, so agreement is common. */
export const genSourceLists: fc.Arbitrary<SourceList[]> = fc
  .tuple(
    fc.subarray([...SOURCE_IDS], { minLength: 2, maxLength: 4 }),
    fc.array(genEntryValues, { minLength: DRUG_KEYS.length, maxLength: DRUG_KEYS.length }),
  )
  .chain(([ids, protos]) =>
    fc.tuple(
      ...ids.map((id) =>
        fc
          .array(
            fc.record({
              listed: fc.integer({ min: 1, max: 10 }).map((n) => n > 3), // omitted with probability 0.3
              own: fc.oneof({ weight: 3, arbitrary: fc.constant(null) }, { weight: 1, arbitrary: genEntryValues }),
            }),
            { minLength: DRUG_KEYS.length, maxLength: DRUG_KEYS.length },
          )
          .map(
            (choices): SourceList => ({
              id,
              label: `${id} list`,
              kind: 'prescriber',
              asOf: '2026-11-01',
              valid: true,
              entries: DRUG_KEYS.flatMap((k, i) => {
                const c = choices[i];
                const proto = protos[i];
                if (!c || !proto || !c.listed) return [];
                return [entryOf(k, c.own ?? proto, `${k} from ${id}`)];
              }).sort((a, b) => (a.drugKey < b.drugKey ? -1 : 1)),
            }),
          ),
      ),
    ),
  );

export const genBase: fc.Arbitrary<Commit> = fc
  .array(fc.tuple(fc.constantFrom(...DRUG_KEYS), genEntryValues), { maxLength: 5 })
  .map((pairs) => {
    const map = new Map(pairs.map(([k, v]) => [k, entryOf(k, v, k)]));
    return {
      id: 'base',
      parentId: null,
      message: 'base',
      author: { role: 'pharmacist' },
      at: '2026-01-01T00:00:00Z',
      entries: [...map.values()].sort((a, b) => (a.drugKey < b.drugKey ? -1 : 1)),
      resolutions: [],
      agreements: [],
      sourcesSeen: [],
    } as Commit;
  });

const HUMAN_REASONS: ReasonCode[] = ['VERIFIED_WITH_PRESCRIBER', 'CONFIRMED_WITH_PATIENT', 'PER_DISPENSING_RECORD', 'PER_DISCHARGE_SUMMARY', 'CLINICAL_JUDGEMENT'];

/** A decision that validateResolution accepts for this conflict (ignoring authorisation). */
export function genValidDecision(conflict: Conflict): fc.Arbitrary<{ decision: Decision; reasonCode: ReasonCode }> {
  const reason = fc.constantFrom(...HUMAN_REASONS);
  if (conflict.kind === 'OMISSION') {
    return fc.record({ decision: fc.constantFrom<Decision>({ type: 'include' }, { type: 'exclude' }), reasonCode: reason });
  }
  const claimants = conflict.claims.filter((c) => c.entry !== null).map((c) => c.source);
  const custom: fc.Arbitrary<Decision> =
    conflict.kind === 'DOSE'
      ? fc.constantFrom(...STRENGTHS, { values: [7.5], unit: 'mg' as const }).map((value) => ({ type: 'custom', value }))
      : conflict.kind === 'FREQUENCY'
        ? genFreqCanonical.map((value) => ({ type: 'custom', value }))
        : genStatus.map((value) => ({ type: 'custom', value }));
  return fc.record({
    decision: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...claimants).map((source): Decision => ({ type: 'choose', source })) }, { weight: 1, arbitrary: custom }),
    reasonCode: reason,
  });
}

/** Valid decisions (pharmacist) for every conflict, in conflict order. */
export function resolveAll(conflicts: Conflict[], picks: { decision: Decision; reasonCode: ReasonCode }[], role: Role = 'pharmacist'): Omit<Resolution, 'seq'>[] {
  return conflicts.map((c, i) => {
    const p = picks[i];
    if (!p) throw new Error('missing pick');
    return { conflictId: c.id, decision: p.decision, reasonCode: p.reasonCode, by: { role }, at: `2026-11-20T10:00:${String(i % 60).padStart(2, '0')}Z` };
  });
}

/** History of n commits: merge generated sources against the head, decide everything, commit. */
export function genChain(n: { min: number; max: number }): fc.Arbitrary<Commit[]> {
  const round = fc.tuple(genSourceLists, fc.array(fc.nat(), { minLength: 20, maxLength: 20 }));
  return fc.array(round, { minLength: n.min, maxLength: n.max }).map((rounds) => {
    const history: Commit[] = [];
    rounds.forEach(([sources, seeds], r) => {
      const head = history[history.length - 1] ?? null;
      const m = mergeSources(sources, head);
      if (!m.ok) throw new Error(m.error.code);
      const events: Resolution[] = [];
      m.value.conflicts.forEach((c, i) => {
        const seed = seeds[i % seeds.length] ?? 0;
        const claimants = c.claims.filter((x) => x.entry !== null);
        const decision: Decision =
          c.kind === 'OMISSION'
            ? seed % 2 === 0
              ? { type: 'include' }
              : { type: 'exclude' }
            : { type: 'choose', source: claimants[seed % claimants.length]?.source ?? '' };
        const reasonCode = HUMAN_REASONS[seed % HUMAN_REASONS.length] ?? 'CLINICAL_JUDGEMENT';
        const v = validateResolution(m.value, events, { conflictId: c.id, decision, reasonCode, by: { role: 'pharmacist' }, at: `t${r}-${i}` });
        if (!v.ok) throw new Error(v.error.code);
        events.push(v.value);
      });
      const c = commitDraft({
        merge: m.value,
        draft: applyResolutions(m.value, events),
        parent: head,
        message: `Round ${r}`,
        author: { role: 'pharmacist', name: 'Demo Pharmacist' },
        clock: fixedClock(`2026-11-${String(10 + r).padStart(2, '0')}T10:00:00Z`),
      });
      if (!c.ok) throw new Error(c.error.code);
      history.push(c.value);
    });
    return history;
  });
}

/** JSON-like values with non-ASCII keys, nested arrays and objects, finite numbers. */
export const genJson: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constant(null),
    fc.boolean(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.string({ unit: 'grapheme' }),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(fc.string({ unit: 'grapheme', maxLength: 6 }).filter((k) => k !== '__proto__'), tie('value'), { maxKeys: 4 }),
  ),
})).value;
