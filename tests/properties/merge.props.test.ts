import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyResolutions,
  equalValues,
  FIELD_KINDS,
  formatField,
  mergeSources,
  renderMarkers,
  validateResolution,
  type Commit,
  type MergeResult,
  type Resolution,
  type SourceList,
} from '@core';
import { runs } from '../helpers/fc';
import { genBase, genSourceLists, genValidDecision, resolveAll } from '../helpers/gen';

const opts = () => ({ numRuns: runs(), verbose: 1 as const });

function merge(sources: SourceList[], base: Commit | null = null): MergeResult {
  const r = mergeSources(sources, base);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

/** Merge plus one valid decision per conflict. */
const genDecided = genSourceLists.chain((sources) => {
  const m = merge(sources);
  return fc.tuple(fc.constant(sources), fc.constant(m), fc.tuple(...m.conflicts.map(genValidDecision)));
});

function record(m: MergeResult, cands: Omit<Resolution, 'seq'>[]): Resolution[] {
  const out: Resolution[] = [];
  for (const c of cands) {
    const r = validateResolution(m, out, c);
    if (!r.ok) throw new Error(`${c.conflictId}: ${r.error.code}`);
    out.push(r.value);
  }
  return out;
}

describe('merge-engine properties', () => {
  // Validates: merge-engine 2.6, 9.2
  it('P-M1 coverage', () => {
    fc.assert(
      fc.property(genSourceLists, (sources) => {
        const m = merge(sources);
        const cleanKeys = new Set(m.clean.map((c) => c.entry.drugKey));
        const conflictKeys = new Set(m.conflicts.map((c) => c.drugKey));
        for (const s of sources) for (const e of s.entries) expect(cleanKeys.has(e.drugKey) !== conflictKeys.has(e.drugKey)).toBe(true);
      }),
      opts(),
    );
  });

  // Validates: merge-engine 8.3, 8.7, 9.1, 9.3
  it('P-M2 no invention', () => {
    fc.assert(
      fc.property(genDecided, fc.nat(), ([sources, m, picks], cut) => {
        const all = record(m, resolveAll(m.conflicts, picks));
        const rs = all.slice(0, all.length === 0 ? 0 : cut % (all.length + 1));
        const draft = applyResolutions(m, rs);
        if (rs.length === 0) expect(draft.entries).toEqual(m.clean.map((c) => c.entry));
        const customs = rs.flatMap((r) => (r.decision.type === 'custom' ? [JSON.stringify(r.decision.value)] : []));
        for (const entry of draft.entries) {
          const held = sources.flatMap((s) => s.entries.filter((e) => e.drugKey === entry.drugKey));
          expect(held.length).toBeGreaterThan(0);
          for (const { field } of FIELD_KINDS) {
            const value = JSON.stringify(entry[field]);
            const ok = held.some((h) => JSON.stringify(h[field]) === value) || customs.includes(value);
            expect(ok, `${entry.drugKey}.${field} = ${value}`).toBe(true);
          }
        }
      }),
      opts(),
    );
  });

  // Validates: merge-engine 4.1, 4.2
  it('P-M3 order independence', () => {
    fc.assert(
      fc.property(genSourceLists.chain((s) => fc.tuple(fc.constant(s), fc.shuffledSubarray(s, { minLength: s.length, maxLength: s.length }))), ([a, b]) => {
        expect(merge(b)).toEqual(merge(a));
      }),
      opts(),
    );
  });

  // Validates: merge-engine 2.1, 2.2, 2.3, 4.4
  it('P-M4 unanimity', () => {
    fc.assert(
      fc.property(genSourceLists, (sources) => {
        const m = merge(sources);
        const [first, ...rest] = sources;
        if (!first) return;
        const same = (s: SourceList) => s.entries.length === first.entries.length && s.entries.every((e, i) => { const f = first.entries[i]; return f !== undefined && f.drugKey === e.drugKey && equalValues(f, e); });
        if (rest.every(same)) {
          expect(m.conflicts).toEqual([]);
          expect(m.clean.map((c) => c.entry.drugKey)).toEqual(first.entries.map((e) => e.drugKey));
        }
        const keys = new Set(sources.flatMap((s) => s.entries.map((e) => e.drugKey)));
        for (const k of keys) {
          const listed = sources.map((s) => s.entries.find((e) => e.drugKey === k));
          const unanimous = listed.every((e) => e !== undefined && listed[0] !== undefined && equalValues(e, listed[0]));
          expect(m.clean.some((c) => c.entry.drugKey === k)).toBe(unanimous);
        }
        // the same list under several ids has no conflicts
        expect(merge(sources.map((s) => ({ ...first, id: s.id }))).conflicts).toEqual([]);
      }),
      opts(),
    );
  });

  // Validates: merge-engine 5.4
  it('P-M5 base independence', () => {
    fc.assert(
      fc.property(genSourceLists, genBase, genBase, (sources, a, b) => {
        const none = merge(sources).conflicts;
        expect(merge(sources, a).conflicts).toEqual(none);
        expect(merge(sources, b).conflicts).toEqual(none);
      }),
      opts(),
    );
  });

  // Validates: merge-engine 5.1, 5.2, 5.3
  it('P-M6 base labelling', () => {
    fc.assert(
      fc.property(genSourceLists, genBase, (sources, base) => {
        const m = merge(sources, base);
        for (const c of m.clean) {
          const b = base.entries.find((e) => e.drugKey === c.entry.drugKey);
          const strings = (x: typeof c.entry) => FIELD_KINDS.map(({ field }) => formatField(field, x)).join('|');
          expect(c.changeVsBase).toBe(b === undefined ? 'added' : strings(b) === strings(c.entry) ? 'unchanged' : 'changed');
        }
        const listed = new Set(sources.flatMap((s) => s.entries.map((e) => e.drugKey)));
        expect(m.removedVsBase).toEqual(base.entries.map((e) => e.drugKey).filter((k) => !listed.has(k)).sort());
        expect(merge(sources).clean.every((c) => c.changeVsBase === null)).toBe(true);
      }),
      opts(),
    );
  });

  // Validates: merge-engine 7.2, 7.3, 8.4
  it('P-M7 gate', () => {
    fc.assert(
      fc.property(genDecided, ([, m, picks]) => {
        const rs = record(m, resolveAll(m.conflicts, picks));
        const d = applyResolutions(m, rs);
        expect(d.canCommit).toBe(true);
        expect(Object.values(d.states).some((s) => s === 'open' || s === 'escalated')).toBe(false);
        const first = m.conflicts[0];
        const pick = picks[0];
        if (!first || !pick) return;
        const esc = record(m, [{ conflictId: first.id, decision: { type: 'escalate' }, reasonCode: 'NEEDS_PHARMACIST_REVIEW', by: { role: 'clinician' }, at: 't' }]);
        expect(applyResolutions(m, esc).canCommit).toBe(false);
        const clin = validateResolution(m, esc, { conflictId: first.id, ...pick, by: { role: 'clinician' }, at: 't' });
        expect(clin.ok ? 'accepted' : clin.error.code).toBe('NOT_AUTHORISED');
        expect(validateResolution(m, esc, { conflictId: first.id, ...pick, by: { role: 'pharmacist' }, at: 't' }).ok).toBe(true);
      }),
      opts(),
    );
  });

  // Validates: merge-engine 8.8
  it('P-M8 latest wins', () => {
    fc.assert(
      fc.property(
        genSourceLists.filter((s) => merge(s).conflicts.length > 0).chain((s) => {
          const m = merge(s);
          const c = m.conflicts[0];
          if (!c) throw new Error();
          return fc.tuple(fc.constant(m), fc.array(genValidDecision(c), { minLength: 1, maxLength: 5 }));
        }),
        ([m, picks]) => {
          const c = m.conflicts[0];
          if (!c) return;
          const rs = record(m, picks.map((p) => ({ conflictId: c.id, ...p, by: { role: 'pharmacist' }, at: 't' })));
          const d = applyResolutions(m, rs);
          const eff = d.effective.find((r) => r.conflictId === c.id);
          expect(eff?.seq).toBe(rs[rs.length - 1]?.seq);
          expect(eff?.decision).toEqual(picks[picks.length - 1]?.decision);
        },
      ),
      opts(),
    );
  });

  // Validates: merge-engine 3.1, 3.2, 3.3, 3.4
  it('P-M9 markers carry every fact', () => {
    fc.assert(
      fc.property(genSourceLists, (sources) => {
        const m = merge(sources);
        const text = renderMarkers(m.conflicts, m.sources);
        expect(renderMarkers(m.conflicts, m.sources)).toBe(text);
        const blocks = text === '' ? [] : text.split('\n\n');
        expect(blocks).toHaveLength(m.conflicts.length);
        m.conflicts.forEach((c, i) => {
          const block = blocks[i] ?? '';
          expect(block.startsWith(`${c.drugKey}  ${c.kind}\n`)).toBe(true);
          for (const claim of c.claims) {
            expect(block).toMatch(new RegExp(`(<<<<<<<|=======|>>>>>>>) [^\\n]*\\b${claim.source}\\b`));
            if (c.kind !== 'OMISSION' && claim.entry) {
              const field = FIELD_KINDS.find((f) => f.kind === c.kind)?.field ?? 'status';
              expect(block).toContain(`\n${formatField(field, claim.entry)}\n`);
            }
          }
        });
      }),
      opts(),
    );
  });
});
