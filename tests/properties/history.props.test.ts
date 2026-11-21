import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyResolutions,
  blame,
  canonicalise,
  commitDraft,
  diffCommits,
  equalValues,
  FIELD_KINDS,
  fixedClock,
  formatField,
  log,
  mergeSources,
  verifyChain,
  type Commit,
} from '@core';
import { runs } from '../helpers/fc';
import { genChain, genJson, genSourceLists } from '../helpers/gen';

const opts = () => ({ numRuns: runs(), verbose: 1 as const });

function shuffleKeys(v: unknown, seed: number): unknown {
  if (Array.isArray(v)) return v.map((x, i) => shuffleKeys(x, seed + i));
  if (v === null || typeof v !== 'object') return v;
  const entries = Object.entries(v as Record<string, unknown>);
  const rotated = entries.length ? [...entries.slice(seed % entries.length), ...entries.slice(0, seed % entries.length)].reverse() : entries;
  return Object.fromEntries(rotated.map(([k, x]) => [k, shuffleKeys(x, seed + 1)]));
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v as object).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
}

function strings(c: Commit | null): Map<string, Record<string, string>> {
  return new Map((c?.entries ?? []).map((e) => [e.drugKey, Object.fromEntries(FIELD_KINDS.map(({ field }) => [field, formatField(field, e)]))]));
}

/** Clean sources (all agree) so a commit is possible without decisions. */
const genAgreed = genSourceLists.map((s) => {
  const first = s[0];
  return first ? s.map((x) => ({ ...first, id: x.id })) : s;
});

describe('history-audit properties', () => {
  // Validates: history-audit 1.3, 2.6
  it('P-H1 determinism and sensitivity', () => {
    fc.assert(
      fc.property(genAgreed, fc.string({ minLength: 1, maxLength: 50 }).filter((m) => m.trim() !== ''), (sources, message) => {
        const m = mergeSources(sources, null);
        if (!m.ok) throw new Error();
        const draft = applyResolutions(m.value, []);
        const make = (msg: string, parent: Commit | null) => commitDraft({ merge: m.value, draft, parent, message: msg, author: { role: 'pharmacist' }, clock: fixedClock('2026-11-20T10:00:00Z') });
        const a = make(message, null);
        const b = make(message, null);
        if (!a.ok || !b.ok) throw new Error();
        expect(a.value).toEqual(b.value);
        const other = make(`${message.trim()}!`, null);
        const withParent = make(message, a.value);
        expect(other.ok && other.value.id).not.toBe(a.value.id);
        expect(withParent.ok && withParent.value.id).not.toBe(a.value.id);
      }),
      opts(),
    );
  });

  // Validates: history-audit 2.1, 2.2
  it('P-H2 canonical key-order independence', () => {
    fc.assert(
      fc.property(genJson, fc.nat(), (v, seed) => {
        const a = canonicalise(v);
        const b = canonicalise(shuffleKeys(v, seed));
        expect(a.ok).toBe(true);
        expect(b).toEqual(a);
        if (a.ok) expect(JSON.parse(a.value)).toEqual(JSON.parse(JSON.stringify(v)));
      }),
      opts(),
    );
  });

  // Validates: history-audit 3.1, 3.2, 3.3
  it('P-H3 tamper evidence', () => {
    const tampers: ((c: Commit) => void)[] = [
      (c) => { c.message += ' edited'; },
      (c) => { c.at = '1999-01-01T00:00:00Z'; },
      (c) => { c.parentId = c.parentId === null ? 'x' : null; },
      (c) => { c.id = c.id.slice(1) + c.id.slice(0, 1) === c.id ? c.id + '0' : c.id.slice(1) + c.id.slice(0, 1); },
      (c) => { const e = c.entries[0]; if (e) e.status = e.status === 'active' ? 'stopped' : 'active'; else c.entries.push({ drugKey: 'x', displayName: 'x', strength: null, frequency: null, status: 'active', flags: [] }); },
      (c) => { const r = c.resolutions[0]; if (r) r.reasonCode = r.reasonCode === 'CLINICAL_JUDGEMENT' ? 'PER_DISCHARGE_SUMMARY' : 'CLINICAL_JUDGEMENT'; else c.author = { role: 'clinician' }; },
    ];
    fc.assert(
      fc.property(genChain({ min: 1, max: 4 }), fc.nat(), fc.constantFrom(...tampers.keys()), (history, pick, t) => {
        expect(verifyChain(history).ok).toBe(true);
        const copy = JSON.parse(JSON.stringify(history)) as Commit[];
        const index = pick % copy.length;
        const target = copy[index];
        if (!target) return;
        tampers[t]?.(target);
        expect(verifyChain(copy)).toEqual({ ok: false, error: { code: 'CHAIN_BROKEN', index } });
      }),
      opts(),
    );
  });

  // Validates: history-audit 5.1, 5.2, 5.3, 5.4, 5.5
  it('P-H4 diff consistency', () => {
    fc.assert(
      fc.property(genChain({ min: 1, max: 4 }), (history) => {
        history.forEach((c, i) => {
          const parent = history[i - 1] ?? null;
          const d = diffCommits(parent, c);
          const applied = strings(parent);
          for (const k of d.removed) applied.delete(k);
          for (const k of d.added) applied.set(k, strings(c).get(k) ?? {});
          for (const ch of d.changed) {
            const row = applied.get(ch.drugKey);
            expect(row?.[ch.field]).toBe(ch.from);
            if (row) row[ch.field] = ch.to;
          }
          expect(applied).toEqual(strings(c));
          expect(diffCommits(c, c)).toEqual({ added: [], removed: [], changed: [] });
        });
      }),
      opts(),
    );
  });

  // Validates: history-audit 6.2
  it('P-H5 blame consistency', () => {
    fc.assert(
      fc.property(genChain({ min: 1, max: 5 }), (history) => {
        const head = history[history.length - 1];
        if (!head) return;
        for (const line of blame(history)) {
          const value = head.entries.find((e) => e.drugKey === line.drugKey);
          const bi = history.findIndex((c) => c.id === line.blamedCommitId);
          expect(bi).toBeGreaterThanOrEqual(0);
          for (let i = bi; i < history.length; i++) {
            const e = history[i]?.entries.find((x) => x.drugKey === line.drugKey);
            expect(e && value && equalValues(e, value)).toBe(true);
          }
          const before = bi > 0 ? history[bi - 1]?.entries.find((x) => x.drugKey === line.drugKey) : undefined;
          if (before && value) expect(equalValues(before, value)).toBe(false);
        }
      }),
      opts(),
    );
  });

  // Validates: history-audit 8.1, 8.2
  it('P-H6 immutability', () => {
    fc.assert(
      fc.property(genChain({ min: 1, max: 3 }), genAgreed, (history, sources) => {
        const snapshot = JSON.parse(JSON.stringify(history)) as Commit[];
        const frozen = deepFreeze(history);
        log(frozen);
        blame(frozen);
        verifyChain(frozen);
        frozen.forEach((c, i) => diffCommits(frozen[i - 1] ?? null, c));
        const head = frozen[frozen.length - 1] ?? null;
        const m = mergeSources(sources, head);
        if (!m.ok) throw new Error();
        const next = commitDraft({ merge: m.value, draft: applyResolutions(m.value, []), parent: head, message: 'next', author: { role: 'pharmacist' }, clock: fixedClock('2027-01-01T00:00:00Z') });
        expect(next.ok).toBe(true);
        const appended = next.ok ? [...frozen, next.value] : frozen;
        expect(verifyChain(appended).ok).toBe(true);
        expect(JSON.parse(JSON.stringify(frozen))).toEqual(snapshot);
      }),
      opts(),
    );
  });
});
