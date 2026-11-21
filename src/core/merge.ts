/**
 * N-way merge under the unanimity rule (docs/MERGE_SEMANTICS.md section 3).
 * A medicine is clean only if every source lists it with equal strength, frequency and status.
 * Nothing here chooses between values.
 * Validates merge-engine 1.x, 2.x, 3.x, 4.x, 5.x.
 */

import { err, ok, type MergeError, type Result } from './errors';
import { formatFrequency, formatStrength } from './normalise/index';
import { compareCodeUnits } from './text';
import type {
  ChangeVsBase,
  Claim,
  CleanEntry,
  Commit,
  Conflict,
  ConflictKind,
  EntryFlag,
  Frequency,
  MedEntry,
  MergeResult,
  SourceList,
  Strength,
} from './types';

export const KIND_ORDER: Readonly<Record<ConflictKind, number>> = { OMISSION: 0, DOSE: 1, FREQUENCY: 2, STATUS: 3 };

export const FIELD_KINDS = [
  { kind: 'DOSE', field: 'strength' },
  { kind: 'FREQUENCY', field: 'frequency' },
  { kind: 'STATUS', field: 'status' },
] as const;

export type FieldKind = (typeof FIELD_KINDS)[number]['kind'];
export type EntryField = (typeof FIELD_KINDS)[number]['field'];

export function fieldOfKind(kind: FieldKind): EntryField {
  return kind === 'DOSE' ? 'strength' : kind === 'FREQUENCY' ? 'frequency' : 'status';
}

export function equalStrength(a: Strength | null, b: Strength | null): boolean {
  if (a === null || b === null) return a === b;
  return a.unit === b.unit && a.values.length === b.values.length && a.values.every((v, i) => v === b.values[i]);
}

export function equalFrequency(a: Frequency | null, b: Frequency | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'prn' || (b.kind === 'scheduled' && a.perDay === b.perDay);
}

export function equalField(field: EntryField, a: MedEntry, b: MedEntry): boolean {
  if (field === 'strength') return equalStrength(a.strength, b.strength);
  if (field === 'frequency') return equalFrequency(a.frequency, b.frequency);
  return a.status === b.status;
}

/** Strength, frequency and status equal. Display names, flags and notes are never compared. */
export function equalValues(a: MedEntry, b: MedEntry): boolean {
  return FIELD_KINDS.every(({ field }) => equalField(field, a, b));
}

/** Value string of one field: "500 mg", "2/day", "prn", "stopped", "null". */
export function formatField(field: EntryField, e: MedEntry): string {
  if (field === 'strength') return formatStrength(e.strength);
  if (field === 'frequency') return formatFrequency(e.frequency);
  return e.status;
}

export function cloneEntry(e: MedEntry): MedEntry {
  return {
    drugKey: e.drugKey,
    displayName: e.displayName,
    strength: e.strength === null ? null : { values: [...e.strength.values], unit: e.strength.unit },
    frequency: e.frequency === null ? null : { ...e.frequency },
    status: e.status,
    flags: [...e.flags],
  };
}

/** Entry built from the first listing source (by id), flags unioned across all listing sources. */
export function templateEntry(listed: MedEntry[]): MedEntry {
  const first = listed[0];
  if (first === undefined) throw new Error('templateEntry needs at least one entry');
  const e = cloneEntry(first);
  e.flags = [...new Set(listed.flatMap((x) => x.flags))].sort(compareCodeUnits) as EntryFlag[];
  return e;
}

export function mergeSources(sources: SourceList[], base: Commit | null): Result<MergeResult, MergeError> {
  if (sources.length < 2) return err({ code: 'TOO_FEW_SOURCES' });
  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.id)) return err({ code: 'DUPLICATE_SOURCE_ID', id: s.id });
    seen.add(s.id);
  }
  const sorted = [...sources].sort((a, b) => compareCodeUnits(a.id, b.id));
  for (const s of sorted) if (!s.valid) return err({ code: 'INVALID_SOURCE', id: s.id });

  const ids = sorted.map((s) => s.id);
  const index = new Map<string, Map<string, MedEntry>>();
  for (const s of sorted) index.set(s.id, new Map(s.entries.map((e) => [e.drugKey, e])));
  const keys = [...new Set(sorted.flatMap((s) => s.entries.map((e) => e.drugKey)))].sort(compareCodeUnits);
  const baseMap = base ? new Map(base.entries.map((e) => [e.drugKey, e])) : null;

  const clean: CleanEntry[] = [];
  const conflicts: Conflict[] = [];
  for (const k of keys) {
    const listing: { id: string; entry: MedEntry }[] = [];
    for (const id of ids) {
      const e = index.get(id)?.get(k);
      if (e) listing.push({ id, entry: e });
    }
    const found: Conflict[] = [];
    if (listing.length < ids.length) {
      const claims: Claim[] = ids.map((id) => {
        const e = index.get(id)?.get(k);
        return { source: id, entry: e ? cloneEntry(e) : null };
      });
      found.push({ id: `${k}::OMISSION`, drugKey: k, kind: 'OMISSION', claims });
    }
    for (const { kind, field } of FIELD_KINDS) {
      const distinct = new Set(listing.map((l) => formatField(field, l.entry)));
      if (distinct.size > 1) {
        found.push({
          id: `${k}::${kind}`,
          drugKey: k,
          kind,
          claims: listing.map((l) => ({ source: l.id, entry: cloneEntry(l.entry) })),
        });
      }
    }
    if (found.length === 0) {
      const entry = templateEntry(listing.map((l) => l.entry));
      let changeVsBase: ChangeVsBase = null;
      if (baseMap) {
        const b = baseMap.get(k);
        changeVsBase = b === undefined ? 'added' : equalValues(b, entry) ? 'unchanged' : 'changed';
      }
      clean.push({ entry, agreedBy: [...ids], changeVsBase });
    } else {
      conflicts.push(...found);
    }
  }
  conflicts.sort((a, b) => compareCodeUnits(a.drugKey, b.drugKey) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const keySet = new Set(keys);
  const removedVsBase = base ? [...new Set(base.entries.map((e) => e.drugKey))].filter((k) => !keySet.has(k)).sort(compareCodeUnits) : [];

  return ok({
    baseCommitId: base?.id ?? null,
    sources: sorted.map((s) => ({ id: s.id, label: s.label, kind: s.kind, asOf: s.asOf })),
    clean,
    conflicts,
    removedVsBase,
  });
}
